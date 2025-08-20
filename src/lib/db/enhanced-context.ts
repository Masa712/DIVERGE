/**
 * Enhanced context building system for multi-dimensional chat trees
 * Addresses the limitation of linear context by including relevant sibling branches
 */

import { createClient } from '@/lib/supabase/server'
import { ChatNode } from '@/types'

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
    includedNodes: string[]
    siblingCount: number
    maxDepth: number
  }
}

// Re-export from utils for backward compatibility
export { extractNodeReferences } from '@/lib/utils/node-references'

/**
 * Get sibling nodes (same parent, different branches)
 */
export async function getSiblingNodes(nodeId: string): Promise<ChatNode[]> {
  const supabase = createClient()
  
  // First, get the current node to find its parent
  const { data: currentNode, error: nodeError } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('id', nodeId)
    .single()
    
  if (nodeError || !currentNode || !currentNode.parent_id) {
    return []
  }
  
  // Get all siblings (excluding current node)
  const { data: siblings, error: siblingsError } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('parent_id', currentNode.parent_id)
    .neq('id', nodeId)
    .order('created_at', { ascending: true })
    
  if (siblingsError || !siblings) {
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
 * Estimate token count (rough approximation)
 * More accurate counting would require tiktoken library
 */
export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
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
  } = {}
): Promise<EnhancedContext> {
  const {
    includeSiblings = true,
    maxTokens = 4000,
    includeReferences = []
  } = options
  
  const supabase = createClient()
  const messages: Array<{ role: string; content: string }> = []
  let totalTokens = 0
  const includedNodes: string[] = []
  
  // 1. Get ancestor chain (existing logic)
  const { data: ancestorData, error: ancestorError } = await supabase.rpc(
    'get_node_ancestors',
    { node_id: nodeId }
  )
  
  if (ancestorError) {
    console.error('Failed to get ancestors:', ancestorError)
    return {
      messages: [],
      metadata: { totalTokens: 0, includedNodes: [], siblingCount: 0, maxDepth: 0 }
    }
  }
  
  // Convert ancestor data to ChatNodes
  const ancestors: ChatNode[] = (ancestorData || [])
    .map((node: any) => ({
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
    .sort((a: ChatNode, b: ChatNode) => a.depth - b.depth)
  
  // 2. Build base context from ancestors
  for (const node of ancestors) {
    // System prompt for root node
    if (node.systemPrompt && node.depth === 0) {
      const systemMsg = { role: 'system', content: node.systemPrompt }
      messages.push(systemMsg)
      totalTokens += estimateTokens(node.systemPrompt)
    }
    
    // User prompt
    const userMsg = { role: 'user', content: node.prompt }
    messages.push(userMsg)
    totalTokens += estimateTokens(node.prompt)
    includedNodes.push(node.id)
    
    // Assistant response
    if (node.response) {
      const assistantMsg = { role: 'assistant', content: node.response }
      messages.push(assistantMsg)
      totalTokens += estimateTokens(node.response)
    }
    
    // Check token limit
    if (totalTokens > maxTokens * 0.7) { // Leave 30% buffer for siblings
      break
    }
  }
  
  // 3. Include sibling context if requested and within token limit
  let siblingCount = 0
  if (includeSiblings && totalTokens < maxTokens * 0.8) {
    const siblings = await getSiblingNodes(nodeId)
    siblingCount = siblings.length
    
    if (siblings.length > 0) {
      const siblingSummary = summarizeSiblings(siblings)
      const summaryTokens = estimateTokens(siblingSummary)
      
      if (totalTokens + summaryTokens < maxTokens) {
        messages.push({
          role: 'system',
          content: siblingSummary
        })
        totalTokens += summaryTokens
        
        // Track sibling nodes as included
        siblings.forEach(s => includedNodes.push(s.id))
      }
    }
  }
  
  // 4. Include explicitly referenced nodes
  if (includeReferences.length > 0) {
    for (const refId of includeReferences) {
      if (totalTokens >= maxTokens * 0.95) break
      
      const { data: refNode, error: refError } = await supabase
        .from('chat_nodes')
        .select('*')
        .eq('id', refId)
        .single()
        
      if (!refError && refNode) {
        const summary = `Referenced context from ${refId.slice(-8)}: "${refNode.prompt.slice(0, 100)}..." → "${refNode.response?.slice(0, 100) || 'No response'}..."`
        const summaryTokens = estimateTokens(summary)
        
        if (totalTokens + summaryTokens < maxTokens) {
          messages.push({
            role: 'system',
            content: summary
          })
          totalTokens += summaryTokens
          includedNodes.push(refId)
        }
      }
    }
  }
  
  return {
    messages,
    metadata: {
      totalTokens,
      includedNodes,
      siblingCount,
      maxDepth: ancestors.length > 0 ? ancestors[ancestors.length - 1].depth : 0
    }
  }
}

// Re-export from utils for backward compatibility
export { getShortNodeId, formatNodeReference } from '@/lib/utils/node-references'