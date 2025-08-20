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
    // Get siblings that have the same parent as nodeId (which is the parent node)
    // We need to find all nodes that have nodeId as their parent
    const { data: siblingNodes, error: siblingError } = await supabase
      .from('chat_nodes')
      .select('*')
      .eq('parent_id', nodeId)
      .order('created_at', { ascending: true })
    
    const siblings = siblingNodes ? siblingNodes.map((node: any) => ({
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
    })) : []
    
    siblingCount = siblings.length
    console.log(`🔍 Found ${siblings.length} existing children of parent ${nodeId}`)
    
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
    // Get all nodes in the session to match short IDs
    const { data: allNodes, error: allNodesError } = await supabase
      .from('chat_nodes')
      .select('*')
      .eq('session_id', ancestors[0]?.sessionId || '')
    
    if (!allNodesError && allNodes) {
      for (const refId of includeReferences) {
        if (totalTokens >= maxTokens * 0.95) break
        
        // Find node by matching the last 8 characters of the ID
        const refNode = allNodes.find(node => node.id.slice(-8) === refId)
        
        if (refNode) {
          console.log(`📎 Found referenced node: ${refNode.id} (${refId})`)
          
          // Create detailed context for the referenced node
          const referenceContext = `
REFERENCED CONVERSATION [${refId}]:
User: "${refNode.prompt}"
Assistant: "${refNode.response || 'No response yet'}"
---`
          
          const summaryTokens = estimateTokens(referenceContext)
          
          if (totalTokens + summaryTokens < maxTokens) {
            messages.push({
              role: 'system',
              content: referenceContext
            })
            totalTokens += summaryTokens
            includedNodes.push(refNode.id)
            console.log(`✅ Added reference context for ${refId}: ${summaryTokens} tokens`)
          } else {
            console.log(`⚠️ Skipping reference ${refId}: would exceed token limit`)
          }
        } else {
          console.log(`❌ Referenced node ${refId} not found in session`)
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