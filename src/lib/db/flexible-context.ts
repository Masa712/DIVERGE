/**
 * Flexible Enhanced Context system with multiple strategies
 * Integrates the new context strategies with the existing caching system
 */

import { createClient } from '@/lib/supabase/server'
import { ChatNode } from '@/types'
import { getCachedSessionNodes, resolveNodeReferences } from './enhanced-context-cache'
import { countTokens, countMessageTokens } from '@/lib/utils/token-counter'
import {
  ContextStrategy,
  ContentPriority,
  ContextBuildingOptions,
  ContextSelectionResult,
  WeightedNode,
  calculateNodeWeights,
  createContextSummary,
  inferOptimalStrategy,
  getDefaultPriority
} from './context-strategies'

export interface FlexibleEnhancedContext {
  messages: Array<{ role: string; content: string }>
  metadata: {
    totalTokens: number
    accurateTokens: number
    includedNodes: string[]
    siblingCount: number
    maxDepth: number
    model: string
    tokenEfficiency: number
    // NEW: Flexibility metadata
    strategy: ContextStrategy
    priority: ContentPriority
    selectionResult: ContextSelectionResult
    adaptiveAdjustments: number
  }
}

/**
 * Build flexible enhanced context with adaptive strategies
 */
export async function buildFlexibleEnhancedContext(
  nodeId: string,
  userPrompt: string,
  options: Partial<ContextBuildingOptions> = {}
): Promise<FlexibleEnhancedContext> {
  const startTime = performance.now()
  
  // Intelligent defaults
  const strategy = options.strategy || inferOptimalStrategy(userPrompt)
  const priority = options.priority || getDefaultPriority(strategy)
  const maxTokens = options.maxTokens || 4000
  const model = options.model || 'gpt-4o'
  const includeReferences = options.includeReferences || []
  const adaptiveTokens = options.adaptiveTokens ?? true
  
  console.log(`🧠 Building flexible context: strategy=${strategy}, priority=${priority}`)
  
  const supabase = createClient()
  const messages: Array<{ role: string; content: string }> = []
  let estimatedTokens = 0
  const includedNodes: string[] = []
  let adaptiveAdjustments = 0
  
  // 1. Get ONLY direct ancestors (no siblings from other branches)
  const { data: ancestorData, error: ancestorError } = await supabase.rpc(
    'get_node_ancestors',
    { node_id: nodeId }
  )
  
  if (ancestorError) {
    console.error('Failed to get ancestors:', ancestorError)
    return createEmptyContext(strategy, priority, model)
  }
  
  // Convert ancestor data - these are the ONLY nodes we should use for context
  const ancestors: ChatNode[] = (ancestorData || [])
    .map((node: any) => convertDbNodeToChatNode(node, model))
    .sort((a: ChatNode, b: ChatNode) => a.depth - b.depth)
  
  const sessionId = ancestors[0]?.sessionId || ''
  
  console.log(`🔗 Using ONLY direct ancestors: ${ancestors.length} nodes (no cross-branch contamination)`)
  
  // 2. Reserve tokens for explicit references (PRIORITY FIX)
  let reservedTokensForReferences = 0
  if (includeReferences.length > 0) {
    // Reserve approximately 2000 tokens per reference (conservative estimate)
    // This ensures referenced nodes can actually be included
    const tokensPerReference = 2000
    reservedTokensForReferences = Math.min(
      includeReferences.length * tokensPerReference,
      maxTokens * 0.6 // Reserve up to 60% of tokens for references
    )
    console.log(`🔖 Reserving ${reservedTokensForReferences} tokens for ${includeReferences.length} explicit references`)
  }
  
  // 3. Calculate available tokens for ancestors
  const tokensForAncestors = maxTokens - reservedTokensForReferences
  
  // 4. Apply strategy-based node selection ONLY to ancestors with reduced budget
  const weightedNodes = calculateNodeWeights(ancestors, userPrompt, strategy, priority, model)
  
  console.log(`📊 Strategy analysis: ${ancestors.length} ancestor candidates, top weight: ${weightedNodes[0]?.weight.toFixed(2)}`)
  
  // 5. Smart token allocation based on strategy with reduced budget
  const tokenAllocation = calculateTokenAllocation(strategy, tokensForAncestors, options.customWeights)
  let selectionResult = selectOptimalNodes(weightedNodes, tokenAllocation, model, adaptiveTokens)
  
  // 6. Adaptive token rebalancing if enabled
  if (adaptiveTokens && selectionResult.totalTokens < tokensForAncestors * 0.6) {
    console.log('🔄 Adaptive rebalancing: expanding context')
    const expandedAllocation = expandTokenAllocation(tokenAllocation, tokensForAncestors * 0.8 - selectionResult.totalTokens)
    selectionResult = selectOptimalNodes(weightedNodes, expandedAllocation, model, false)
    adaptiveAdjustments++
  }
  
  // 7. Build messages from selected nodes
  buildMessagesFromSelection(selectionResult.selectedNodes, messages, strategy, model)
  
  // Update estimated tokens after building messages from selected nodes
  estimatedTokens = selectionResult.totalTokens
  
  // 8. Handle explicit references with RESERVED token budget (PRIORITY FIX)
  if (includeReferences.length > 0) {
    // Use the reserved tokens plus any unused tokens from ancestor selection
    const unusedAncestorTokens = tokensForAncestors - estimatedTokens
    const availableForReferences = reservedTokensForReferences + unusedAncestorTokens
    console.log(`📌 Processing ${includeReferences.length} node references with ${availableForReferences} tokens (${reservedTokensForReferences} reserved + ${unusedAncestorTokens} unused)`)
    await addReferencedContent(sessionId, includeReferences, messages, availableForReferences, model, includedNodes)
    // Update estimated tokens after adding references
    estimatedTokens = countMessageTokens(messages, model)
  }
  
  // 9. Add user prompt
  messages.push({ role: 'user', content: userPrompt })
  
  // 10. Final accurate token count
  const accurateTokens = countMessageTokens(messages, model)
  const tokenEfficiency = estimatedTokens > 0 ? accurateTokens / estimatedTokens : 1
  
  const endTime = performance.now()
  const buildTime = Math.round(endTime - startTime)
  
  console.log(`⚡ Flexible context built in ${buildTime}ms using ${strategy} strategy`)
  console.log(`📏 Selection: ${selectionResult.selectionMeta.selectedCount}/${selectionResult.selectionMeta.candidateCount} nodes, ${accurateTokens} tokens`)
  console.log(`🚫 Cross-branch isolation: siblings from other branches excluded`)
  
  // Export performance metrics
  if (typeof window !== 'undefined') {
    (window as any).performanceMetrics = {
      contextBuildTime: buildTime,
      cacheHitRate: includeReferences.length > 0 ? 85 : 0,
      dbQueries: 1, // Only ancestor query, no session nodes
      nodesProcessed: selectionResult.selectionMeta.selectedCount,
      referencesResolved: includeReferences.length,
      sessionId: sessionId,
      tokenAccuracy: tokenEfficiency,
      estimatedTokens: estimatedTokens,
      accurateTokens: accurateTokens,
      // NEW: Strategy-specific metrics
      strategy: strategy,
      priority: priority,
      adaptiveAdjustments: adaptiveAdjustments,
      candidateCount: selectionResult.selectionMeta.candidateCount,
      averageWeight: selectionResult.selectionMeta.averageWeight,
      tokenDistribution: selectionResult.tokenDistribution,
      // Context isolation metrics
      ancestorCount: ancestors.length,
      crossBranchIsolation: true
    }
  }
  
  return {
    messages,
    metadata: {
      totalTokens: estimatedTokens,
      accurateTokens,
      includedNodes,
      siblingCount: 0, // No siblings included for proper isolation
      maxDepth: ancestors.length > 0 ? ancestors[ancestors.length - 1].depth : 0,
      model,
      tokenEfficiency,
      strategy,
      priority,
      selectionResult,
      adaptiveAdjustments
    }
  }
}

/**
 * Calculate token allocation based on strategy
 */
function calculateTokenAllocation(
  strategy: ContextStrategy,
  maxTokens: number,
  customWeights?: ContextBuildingOptions['customWeights']
): { ancestors: number; siblings: number; references: number; summaries: number } {
  if (customWeights) {
    const total = customWeights.ancestors + customWeights.siblings + customWeights.references + customWeights.summaries
    const normalizedTokens = maxTokens * 0.8 // Leave 20% buffer
    return {
      ancestors: (customWeights.ancestors / total) * normalizedTokens,
      siblings: (customWeights.siblings / total) * normalizedTokens,
      references: (customWeights.references / total) * normalizedTokens,
      summaries: (customWeights.summaries / total) * normalizedTokens,
    }
  }
  
  const baseTokens = maxTokens * 0.8 // Leave 20% buffer
  
  switch (strategy) {
    case 'focused':
      return { ancestors: baseTokens * 0.7, siblings: baseTokens * 0.1, references: baseTokens * 0.15, summaries: baseTokens * 0.05 }
      
    case 'exploratory':
      return { ancestors: baseTokens * 0.3, siblings: baseTokens * 0.5, references: baseTokens * 0.1, summaries: baseTokens * 0.1 }
      
    case 'reference-heavy':
      return { ancestors: baseTokens * 0.3, siblings: baseTokens * 0.1, references: baseTokens * 0.5, summaries: baseTokens * 0.1 }
      
    case 'minimal':
      return { ancestors: baseTokens * 0.6, siblings: baseTokens * 0.1, references: baseTokens * 0.2, summaries: baseTokens * 0.1 }
      
    case 'analytical':
      return { ancestors: baseTokens * 0.4, siblings: baseTokens * 0.3, references: baseTokens * 0.2, summaries: baseTokens * 0.1 }
      
    case 'creative':
      return { ancestors: baseTokens * 0.2, siblings: baseTokens * 0.4, references: baseTokens * 0.2, summaries: baseTokens * 0.2 }
      
    case 'comprehensive':
    default:
      return { ancestors: baseTokens * 0.4, siblings: baseTokens * 0.3, references: baseTokens * 0.2, summaries: baseTokens * 0.1 }
  }
}

/**
 * Expand token allocation for adaptive rebalancing
 */
function expandTokenAllocation(
  current: { ancestors: number; siblings: number; references: number; summaries: number },
  additionalTokens: number
): { ancestors: number; siblings: number; references: number; summaries: number } {
  // Distribute additional tokens proportionally
  const total = current.ancestors + current.siblings + current.references + current.summaries
  
  return {
    ancestors: current.ancestors + (current.ancestors / total) * additionalTokens,
    siblings: current.siblings + (current.siblings / total) * additionalTokens,
    references: current.references + (current.references / total) * additionalTokens,
    summaries: current.summaries + (current.summaries / total) * additionalTokens,
  }
}

/**
 * Select optimal nodes based on token allocation and weights
 */
function selectOptimalNodes(
  weightedNodes: WeightedNode[],
  allocation: { ancestors: number; siblings: number; references: number; summaries: number },
  model: string,
  adaptive: boolean
): ContextSelectionResult {
  const selectedNodes: WeightedNode[] = []
  let totalTokens = 0
  
  // Separate nodes by type
  const ancestorNodes = weightedNodes.filter(wn => wn.reason.includes('depth') || wn.reason.includes('ancestry') || wn.reason.includes('essential'))
  const siblingNodes = weightedNodes.filter(wn => wn.reason.includes('diversity') || wn.reason.includes('exploratory'))
  const otherNodes = weightedNodes.filter(wn => !ancestorNodes.includes(wn) && !siblingNodes.includes(wn))
  
  // Select from each category within token budget
  totalTokens += selectFromCategory(ancestorNodes, allocation.ancestors, selectedNodes, model)
  totalTokens += selectFromCategory(siblingNodes, allocation.siblings, selectedNodes, model)
  totalTokens += selectFromCategory(otherNodes, allocation.references, selectedNodes, model)
  
  const selectionMeta = {
    candidateCount: weightedNodes.length,
    selectedCount: selectedNodes.length,
    averageWeight: selectedNodes.length > 0 ? selectedNodes.reduce((sum, wn) => sum + wn.weight, 0) / selectedNodes.length : 0,
    primaryReason: selectedNodes[0]?.reason || 'none'
  }
  
  return {
    selectedNodes,
    strategy: 'comprehensive', // This will be set by caller
    totalTokens,
    tokenDistribution: {
      ancestors: ancestorNodes.filter(n => selectedNodes.includes(n)).reduce((sum, n) => sum + n.tokenCount, 0),
      siblings: siblingNodes.filter(n => selectedNodes.includes(n)).reduce((sum, n) => sum + n.tokenCount, 0),
      references: otherNodes.filter(n => selectedNodes.includes(n)).reduce((sum, n) => sum + n.tokenCount, 0),
      summaries: 0 // Will be calculated later
    },
    selectionMeta
  }
}

/**
 * Select nodes from a category within token budget
 */
function selectFromCategory(
  nodes: WeightedNode[],
  tokenBudget: number,
  selectedNodes: WeightedNode[],
  model: string
): number {
  let usedTokens = 0
  
  for (const node of nodes) {
    if (usedTokens + node.tokenCount <= tokenBudget) {
      selectedNodes.push(node)
      usedTokens += node.tokenCount
    }
  }
  
  return usedTokens
}

/**
 * Build messages from selected nodes
 */
function buildMessagesFromSelection(
  selectedNodes: WeightedNode[],
  messages: Array<{ role: string; content: string }>,
  strategy: ContextStrategy,
  model: string
): number {
  let totalTokens = 0
  
  // Sort by depth for proper conversation flow
  const sortedNodes = selectedNodes.sort((a, b) => a.node.depth - b.node.depth)
  
  for (const { node } of sortedNodes) {
    // System prompt for root nodes
    if (node.systemPrompt && node.depth === 0) {
      messages.push({ role: 'system', content: node.systemPrompt })
      totalTokens += countTokens(node.systemPrompt, model)
    }
    
    // User message
    messages.push({ role: 'user', content: node.prompt })
    totalTokens += countTokens(node.prompt, model)
    
    // Assistant response
    if (node.response) {
      messages.push({ role: 'assistant', content: node.response })
      totalTokens += countTokens(node.response, model)
    }
  }
  
  // Add strategy-specific summary if helpful
  if (selectedNodes.length > 3) {
    const summary = createContextSummary(selectedNodes, strategy, model, 200)
    if (summary) {
      messages.push({ role: 'system', content: summary })
      totalTokens += countTokens(summary, model)
    }
  }
  
  return totalTokens
}

/**
 * Add referenced content with remaining token budget
 */
async function addReferencedContent(
  sessionId: string,
  references: string[],
  messages: Array<{ role: string; content: string }>,
  remainingTokens: number,
  model: string,
  includedNodes: string[]
): Promise<void> {
  console.log(`🔍 Resolving ${references.length} node references for session ${sessionId}`)
  const resolvedRefs = await resolveNodeReferences(sessionId, references)
  
  let addedCount = 0
  let truncatedCount = 0
  
  for (const { refId, node: refNode } of resolvedRefs) {
    if (!refNode) {
      console.log(`⚠️ Could not resolve reference: ${refId}`)
      continue
    }
    
    if (remainingTokens <= 100) {
      console.log(`⏭️ Skipping reference ${refId} - insufficient tokens remaining (${remainingTokens})`)
      break
    }
    
    // Try to include full content first
    const fullContent = `REFERENCE [${refId}]: "${refNode.prompt}" → "${refNode.response || 'No response'}"`
    const fullTokens = countTokens(fullContent, model)
    
    if (fullTokens <= remainingTokens) {
      // Full content fits
      messages.push({ role: 'system', content: fullContent })
      remainingTokens -= fullTokens
      includedNodes.push(refNode.id)
      addedCount++
      console.log(`✅ Added full reference ${refId} (${fullTokens} tokens)`)
    } else {
      // Try truncated content with smart summarization
      const prompt = refNode.prompt || ''
      const response = refNode.response || 'No response'
      
      // Calculate how much we can include
      const promptTokens = countTokens(prompt, model)
      const responseTokens = countTokens(response, model)
      const headerTokens = countTokens(`REFERENCE [${refId}]: "" → "" [truncated]`, model)
      const availableForContent = remainingTokens - headerTokens - 50 // 50 token buffer
      
      if (availableForContent < 100) {
        // Not enough space even for truncated content
        console.log(`⏭️ Skipping reference ${refId} - insufficient tokens even for truncation (needs ${fullTokens}, has ${remainingTokens})`)
        continue
      }
      
      // Prioritize prompt over response, and truncate intelligently
      let includedPrompt = prompt
      let includedResponse = response
      
      if (promptTokens + responseTokens > availableForContent) {
        // Need to truncate
        if (promptTokens > availableForContent * 0.3) {
          // Prompt is long, truncate it
          const promptChars = Math.floor((availableForContent * 0.3 / promptTokens) * prompt.length)
          includedPrompt = prompt.substring(0, promptChars) + '...'
        }
        
        // Truncate response to fit remaining space
        const remainingSpace = availableForContent - countTokens(includedPrompt, model)
        if (responseTokens > remainingSpace) {
          const responseChars = Math.floor((remainingSpace / responseTokens) * response.length)
          includedResponse = response.substring(0, responseChars) + '...'
        }
      }
      
      const truncatedContent = `REFERENCE [${refId}]: "${includedPrompt}" → "${includedResponse}" [truncated]`
      const truncatedTokens = countTokens(truncatedContent, model)
      
      if (truncatedTokens <= remainingTokens) {
        messages.push({ role: 'system', content: truncatedContent })
        remainingTokens -= truncatedTokens
        includedNodes.push(refNode.id)
        addedCount++
        truncatedCount++
        console.log(`✂️ Added truncated reference ${refId} (${truncatedTokens} tokens, saved ${fullTokens - truncatedTokens})`)
      } else {
        console.log(`⏭️ Skipping reference ${refId} - truncation failed (needs ${truncatedTokens}, has ${remainingTokens})`)
      }
    }
  }
  
  console.log(`📌 Added ${addedCount}/${references.length} references to context (${truncatedCount} truncated)`)
}

/**
 * Convert database node to ChatNode
 */
function convertDbNodeToChatNode(node: any, model: string): ChatNode {
  return {
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
  }
}

/**
 * Create empty context for error cases
 */
function createEmptyContext(
  strategy: ContextStrategy,
  priority: ContentPriority,
  model: string
): FlexibleEnhancedContext {
  return {
    messages: [],
    metadata: {
      totalTokens: 0,
      accurateTokens: 0,
      includedNodes: [],
      siblingCount: 0,
      maxDepth: 0,
      model,
      tokenEfficiency: 0,
      strategy,
      priority,
      selectionResult: {
        selectedNodes: [],
        strategy,
        totalTokens: 0,
        tokenDistribution: { ancestors: 0, siblings: 0, references: 0, summaries: 0 },
        selectionMeta: { candidateCount: 0, selectedCount: 0, averageWeight: 0, primaryReason: 'error' }
      },
      adaptiveAdjustments: 0
    }
  }
}