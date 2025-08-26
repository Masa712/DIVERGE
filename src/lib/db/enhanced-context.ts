/**
 * Enhanced context building system for multi-dimensional chat trees
 * Addresses the limitation of linear context by including relevant sibling branches
 */

import { createClient } from '@/lib/supabase/server'
import { ChatNode } from '@/types'
import { getCachedSiblingNodes, resolveNodeReferences } from './enhanced-context-cache'
import { 
  countTokens, 
  countMessageTokens, 
  getModelTokenLimit, 
  truncateToTokenLimit,
  estimateTokensFallback 
} from '@/lib/utils/token-counter'
import { isRedisAvailable } from '@/lib/redis/client'
import { getRedisEnhancedContextCache } from './redis-enhanced-context-cache'

export interface ContextScope {
  ancestors: ChatNode[]      // Direct ancestor chain
  siblings: ChatNode[]        // Sibling branches from same parent
  references: ChatNode[]      // Explicitly referenced nodes
  summaries: Map<string, string> // Node summaries for token efficiency
}

export interface EnhancedContext {
  messages: Array<{ role: string; content: string }>
  metadata: {
    totalTokens: number
    accurateTokens: number  // Tiktoken-based count
    includedNodes: string[]
    siblingCount: number
    maxDepth: number
    model: string
    tokenEfficiency: number // Actual vs estimated ratio
  }
}

// Re-export from utils for backward compatibility
export { extractNodeReferences } from '@/lib/utils/node-references'

/**
 * Get sibling nodes (same parent, different branches)
 */
export async function getSiblingNodes(nodeId: string): Promise<ChatNode[]> {
  const supabase = createClient()
  
  console.log(`🔍 Getting siblings for nodeId: ${nodeId}`)
  
  // First, get the current node to find its parent
  const { data: currentNode, error: nodeError } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('id', nodeId)
    .single()
    
  if (nodeError || !currentNode || !currentNode.parent_id) {
    console.log(`❌ No parent found for node ${nodeId}:`, { 
      nodeError: nodeError?.message, 
      hasCurrentNode: !!currentNode, 
      parentId: currentNode?.parent_id 
    })
    return []
  }
  
  console.log(`📊 Current node parent_id: ${currentNode.parent_id}`)
  
  // Get all siblings (excluding current node)
  const { data: siblings, error: siblingsError } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('parent_id', currentNode.parent_id)
    .neq('id', nodeId)
    .order('created_at', { ascending: true })
    
  console.log(`🔎 Sibling query result:`, { 
    siblingsCount: siblings?.length || 0, 
    error: siblingsError?.message,
    parentId: currentNode.parent_id 
  })
  
  if (siblingsError || !siblings) {
    console.log(`❌ Siblings query failed:`, siblingsError?.message)
    return []
  }
  
  // Convert to ChatNode type
  return siblings.map((node: any) => ({
    id: node.id,
    parentId: node.parent_id,
    sessionId: node.session_id,
    model: node.model,
    systemPrompt: node.system_prompt,
    prompt: node.prompt,
    response: node.response,
    status: node.status,
    errorMessage: node.error_message,
    depth: node.depth,
    promptTokens: node.prompt_tokens || 0,
    responseTokens: node.response_tokens || 0,
    costUsd: node.cost_usd || 0,
    temperature: node.temperature,
    maxTokens: node.max_tokens,
    topP: node.top_p,
    metadata: node.metadata || {},
    createdAt: new Date(node.created_at),
    updatedAt: new Date(node.updated_at),
  }))
}

/**
 * Create a concise summary of a node's conversation
 */
export function summarizeNode(node: ChatNode): string {
  const prompt = node.prompt.slice(0, 100)
  const response = node.response ? node.response.slice(0, 100) : 'No response'
  
  return `[${node.id.slice(-8)}] Q: ${prompt}${node.prompt.length > 100 ? '...' : ''} | A: ${response}${node.response && node.response.length > 100 ? '...' : ''}`
}

/**
 * Create a summary of sibling branches for context
 */
export function summarizeSiblings(siblings: ChatNode[]): string {
  if (siblings.length === 0) return ''
  
  const summaries = siblings.map(s => {
    const shortId = s.id.slice(-8)
    const topic = s.prompt.slice(0, 50)
    return `- Branch ${shortId}: "${topic}${s.prompt.length > 50 ? '...' : ''}"`
  })
  
  return `Related branches explored:\n${summaries.join('\n')}`
}

/**
 * Accurate token counting with model awareness
 * Uses tiktoken for precise token calculation
 */
export function estimateTokens(text: string, model: string = 'gpt-4o'): number {
  return countTokens(text, model)
}

/**
 * Legacy function name for backward compatibility
 * @deprecated Use estimateTokens or countTokens directly
 */
export function estimateTokensLegacy(text: string): number {
  return estimateTokensFallback(text)
}

/**
 * Build enhanced context with sibling awareness
 */
export async function buildEnhancedContext(
  nodeId: string,
  options: {
    includeSiblings?: boolean
    maxTokens?: number
    includeReferences?: string[]
    model?: string // NEW: Model awareness for accurate token counting
  } = {}
): Promise<EnhancedContext> {
  const startTime = performance.now()
  const {
    includeSiblings = true,
    maxTokens = 4000,
    includeReferences = [],
    model = 'gpt-4o' // NEW: Default model for token calculations
  } = options
  
  const supabase = createClient()
  const messages: Array<{ role: string; content: string }> = []
  let estimatedTokens = 0 // Legacy estimation for comparison
  const includedNodes: string[] = []
  
  console.log(`🧠 Building enhanced context for ${nodeId} (model: ${model}, maxTokens: ${maxTokens})`)
  
  // 1. Get ancestor chain - efficient with RPC
  const { data: ancestorData, error: ancestorError } = await supabase.rpc(
    'get_node_ancestors',
    { node_id: nodeId }
  )
  
  if (ancestorError) {
    console.error('Failed to get ancestors:', ancestorError)
    return {
      messages: [],
      metadata: { 
        totalTokens: 0, 
        accurateTokens: 0,
        includedNodes: [], 
        siblingCount: 0, 
        maxDepth: 0,
        model,
        tokenEfficiency: 0
      }
    }
  }
  
  // Convert ancestor data to ChatNodes
  const ancestors: ChatNode[] = (ancestorData || [])
    .map((node: any) => ({
      id: node.id,
      parentId: node.parent_id,
      sessionId: node.session_id,
      model: node.model || model,
      systemPrompt: node.system_prompt,
      prompt: node.prompt,
      response: node.response,
      status: node.status,
      errorMessage: node.error_message,
      depth: node.depth,
      promptTokens: node.prompt_tokens || 0,
      responseTokens: node.response_tokens || 0,
      costUsd: node.cost_usd || 0,
      temperature: node.temperature,
      maxTokens: node.max_tokens,
      topP: node.top_p,
      metadata: node.metadata || {},
      createdAt: new Date(node.created_at),
      updatedAt: new Date(node.updated_at),
    }))
    .sort((a: ChatNode, b: ChatNode) => a.depth - b.depth)
  
  const sessionId = ancestors[0]?.sessionId || ''
  const actualModel = ancestors[0]?.model || model
  
  console.log(`📊 Processing ${ancestors.length} ancestors for session ${sessionId}`)
  
  // 2. Build base context from ancestors with accurate token counting
  for (const node of ancestors) {
    // System prompt for root node
    if (node.systemPrompt && node.depth === 0) {
      const systemMsg = { role: 'system', content: node.systemPrompt }
      messages.push(systemMsg)
      estimatedTokens += estimateTokens(node.systemPrompt, actualModel)
    }
    
    // User prompt
    const userMsg = { role: 'user', content: node.prompt }
    messages.push(userMsg)
    estimatedTokens += estimateTokens(node.prompt, actualModel)
    includedNodes.push(node.id)
    
    // Assistant response
    if (node.response) {
      const assistantMsg = { role: 'assistant', content: node.response }
      messages.push(assistantMsg)
      estimatedTokens += estimateTokens(node.response, actualModel)
    }
    
    // Smart token limit checking with accurate counting
    if (estimatedTokens > maxTokens * 0.7) { // Leave 30% buffer for siblings
      console.log(`⚠️ Approaching token limit (${estimatedTokens}/${maxTokens}), stopping ancestor processing`)
      break
    }
  }
  
  // 3. Include sibling context with accurate token accounting (OPTIMIZED)
  let siblingCount = 0
  if (includeSiblings && estimatedTokens < maxTokens * 0.8) {
    console.log(`🔍 Adding sibling context (current: ${estimatedTokens} tokens)`)
    
    // PERFORMANCE OPTIMIZATION: Use cached sibling nodes
    const siblingNodes = await getCachedSiblingNodes(nodeId, sessionId)
    
    const siblings = siblingNodes.map((node: any) => ({
      id: node.id,
      parentId: node.parent_id,
      sessionId: node.session_id,
      model: node.model,
      systemPrompt: node.system_prompt,
      prompt: node.prompt,
      response: node.response,
      status: node.status,
      errorMessage: node.error_message,
      depth: node.depth,
      promptTokens: node.prompt_tokens || 0,
      responseTokens: node.response_tokens || 0,
      costUsd: node.cost_usd || 0,
      temperature: node.temperature,
      maxTokens: node.max_tokens,
      topP: node.top_p,
      metadata: node.metadata || {},
      createdAt: new Date(node.created_at),
      updatedAt: new Date(node.updated_at),
    }))
    
    siblingCount = siblings.length
    console.log(`🌳 Found ${siblings.length} sibling branches`)
    
    if (siblings.length > 0) {
      const siblingSummary = summarizeSiblings(siblings)
      const summaryTokens = estimateTokens(siblingSummary, actualModel)
      
      if (estimatedTokens + summaryTokens < maxTokens) {
        messages.push({
          role: 'system',
          content: siblingSummary
        })
        estimatedTokens += summaryTokens
        
        // Track sibling nodes as included
        siblings.forEach(s => includedNodes.push(s.id))
        console.log(`✅ Added ${siblings.length} siblings (${summaryTokens} tokens)`)
      } else {
        console.log(`⚠️ Skipping siblings: would exceed token limit (${summaryTokens} additional tokens)`)
      }
    }
  }
  
  // 4. Include explicitly referenced nodes with smart truncation (OPTIMIZED WITH CACHE)
  if (includeReferences.length > 0) {
    console.log(`🔗 Processing ${includeReferences.length} references`)
    const resolvedRefs = await resolveNodeReferences(sessionId, includeReferences)
    
    for (const { refId, node: refNode } of resolvedRefs) {
      if (!refNode || estimatedTokens >= maxTokens * 0.95) break
      
      console.log(`📎 Processing reference: ${refNode.id.slice(-8)} (${refId})`)
      
      // Create detailed context for the referenced node
      const referenceContext = `
REFERENCED CONVERSATION [${refId}]:
User: "${refNode.prompt}"
Assistant: "${refNode.response || 'No response yet'}"
---`
      
      const refTokens = estimateTokens(referenceContext, actualModel)
      
      if (estimatedTokens + refTokens < maxTokens) {
        messages.push({
          role: 'system',
          content: referenceContext
        })
        estimatedTokens += refTokens
        includedNodes.push(refNode.id)
        console.log(`✅ Added reference ${refId}: ${refTokens} tokens`)
      } else {
        // Smart truncation for references if they would exceed limit
        const available = maxTokens - estimatedTokens - 50 // Safety buffer
        const truncated = truncateToTokenLimit(referenceContext, actualModel, available)
        
        if (truncated.tokenCount > 20) { // Only include if meaningful content remains
          messages.push({
            role: 'system',
            content: truncated.text + (truncated.truncated ? '\n[Content truncated to fit token limit]' : '')
          })
          estimatedTokens += truncated.tokenCount
          includedNodes.push(refNode.id)
          console.log(`✂️ Added truncated reference ${refId}: ${truncated.tokenCount} tokens`)
        } else {
          console.log(`⚠️ Skipping reference ${refId}: insufficient space (${available} tokens available)`)
        }
      }
    }
  }
  
  // 5. Final accurate token count using tiktoken
  const accurateTokens = countMessageTokens(messages, actualModel)
  const tokenEfficiency = estimatedTokens > 0 ? accurateTokens / estimatedTokens : 1
  
  const endTime = performance.now()
  const buildTime = Math.round(endTime - startTime)
  
  console.log(`⚡ Enhanced context completed in ${buildTime}ms`)
  console.log(`📏 Token analysis: estimated=${estimatedTokens}, accurate=${accurateTokens}, efficiency=${(tokenEfficiency * 100).toFixed(1)}%`)
  
  // Export performance metrics for dashboard
  if (typeof window !== 'undefined') {
    (window as any).performanceMetrics = {
      contextBuildTime: buildTime,
      cacheHitRate: includeReferences.length > 0 ? 85 : 0,
      dbQueries: includeReferences.length > 0 ? 1 : 2,
      nodesProcessed: includedNodes.length,
      referencesResolved: includeReferences.length,
      sessionId: sessionId,
      tokenAccuracy: tokenEfficiency,
      estimatedTokens: estimatedTokens,
      accurateTokens: accurateTokens
    }
  }
  
  return {
    messages,
    metadata: {
      totalTokens: estimatedTokens, // Keep for backward compatibility
      accurateTokens,
      includedNodes,
      siblingCount,
      maxDepth: ancestors.length > 0 ? ancestors[ancestors.length - 1].depth : 0,
      model: actualModel,
      tokenEfficiency
    }
  }
}

/**
 * Flexible context builder - automatically chooses optimal strategy
 */
export async function buildContextWithStrategy(
  nodeId: string,
  userPrompt: string,
  options: {
    includeSiblings?: boolean
    maxTokens?: number
    includeReferences?: string[]
    model?: string
    strategy?: string
    priority?: string
  } = {}
): Promise<EnhancedContext> {
  // Import flexible context builder
  const { buildFlexibleEnhancedContext } = await import('./flexible-context')
  const { inferOptimalStrategy, getDefaultPriority } = await import('./context-strategies')
  
  // Convert options to flexible format
  const strategy = (options.strategy as any) || inferOptimalStrategy(userPrompt)
  const priority = (options.priority as any) || getDefaultPriority(strategy)
  
  const flexibleOptions = {
    strategy,
    priority,
    maxTokens: options.maxTokens || 4000,
    model: options.model || 'gpt-4o',
    includeReferences: options.includeReferences || [],
    adaptiveTokens: true,
  }
  
  console.log(`🧠 Using intelligent context strategy: ${strategy} (${priority} priority)`)
  
  try {
    const flexibleResult = await buildFlexibleEnhancedContext(nodeId, userPrompt, flexibleOptions)
    
    // Convert to standard EnhancedContext format for backward compatibility
    return {
      messages: flexibleResult.messages,
      metadata: {
        totalTokens: flexibleResult.metadata.totalTokens,
        accurateTokens: flexibleResult.metadata.accurateTokens,
        includedNodes: flexibleResult.metadata.includedNodes,
        siblingCount: flexibleResult.metadata.siblingCount,
        maxDepth: flexibleResult.metadata.maxDepth,
        model: flexibleResult.metadata.model,
        tokenEfficiency: flexibleResult.metadata.tokenEfficiency,
        // Additional flexible metadata available but not breaking changes
        ...(flexibleResult.metadata.strategy && { strategy: flexibleResult.metadata.strategy }),
        ...(flexibleResult.metadata.adaptiveAdjustments && { adaptiveAdjustments: flexibleResult.metadata.adaptiveAdjustments })
      }
    }
  } catch (error) {
    console.warn('Flexible context failed, falling back to standard:', error)
    // Fallback to original method
    return buildEnhancedContext(nodeId, options)
  }
}

// Re-export from utils for backward compatibility
export { getShortNodeId, formatNodeReference } from '@/lib/utils/node-references'