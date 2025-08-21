/**
 * Flexible context building strategies for Enhanced Context system
 * Provides multiple approaches for different use cases and content types
 */

import { ChatNode } from '@/types'
import { countTokens, truncateToTokenLimit } from '@/lib/utils/token-counter'

export type ContextStrategy = 
  | 'comprehensive'    // Full ancestor + sibling + references (default)
  | 'focused'          // Only direct ancestors + key references
  | 'exploratory'      // Heavy emphasis on siblings and alternatives
  | 'reference-heavy'  // Prioritize explicitly referenced content
  | 'minimal'          // Only essential context, maximize new content space
  | 'analytical'       // Include comparative analysis from siblings
  | 'creative'         // Diverse examples and alternative approaches

export type ContentPriority = 
  | 'recency'          // Prefer recent conversations
  | 'relevance'        // Prefer semantically similar content
  | 'completeness'     // Prefer nodes with full Q&A pairs
  | 'depth'           // Prefer deeper, more detailed discussions
  | 'breadth'         // Prefer diverse topics and approaches

export interface ContextBuildingOptions {
  strategy: ContextStrategy
  priority: ContentPriority
  maxTokens: number
  model: string
  includeReferences: string[]
  customWeights?: {
    ancestors: number     // 0-1, weight for ancestor content
    siblings: number      // 0-1, weight for sibling content
    references: number    // 0-1, weight for reference content
    summaries: number     // 0-1, weight for summary content
  }
  adaptiveTokens?: boolean  // Dynamically adjust token allocation
  includeMeta?: boolean     // Include metadata about content selection
}

export interface WeightedNode {
  node: ChatNode
  weight: number
  reason: string
  tokenCount: number
}

export interface ContextSelectionResult {
  selectedNodes: WeightedNode[]
  strategy: ContextStrategy
  totalTokens: number
  tokenDistribution: {
    ancestors: number
    siblings: number
    references: number
    summaries: number
  }
  selectionMeta: {
    candidateCount: number
    selectedCount: number
    averageWeight: number
    primaryReason: string
  }
}

/**
 * Calculate relevance score based on content similarity
 */
export function calculateRelevanceScore(
  targetPrompt: string,
  candidatePrompt: string
): number {
  // Simple keyword-based relevance (could be enhanced with embeddings)
  const targetKeywords = extractKeywords(targetPrompt.toLowerCase())
  const candidateKeywords = extractKeywords(candidatePrompt.toLowerCase())
  
  const intersection = targetKeywords.filter(kw => 
    candidateKeywords.some(ckw => 
      ckw.includes(kw) || kw.includes(ckw) || levenshteinSimilarity(kw, ckw) > 0.7
    )
  )
  
  return intersection.length / Math.max(targetKeywords.length, candidateKeywords.length, 1)
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by'])
  return text
    .split(/\W+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10) // Top 10 keywords
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function levenshteinSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1
  
  const distance = levenshteinDistance(str1, str2)
  return (maxLen - distance) / maxLen
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,         // deletion
        matrix[j - 1][i] + 1,         // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      )
    }
  }
  
  return matrix[str2.length][str1.length]
}

/**
 * Assign weights to nodes based on strategy and priority
 */
export function calculateNodeWeights(
  nodes: ChatNode[],
  targetPrompt: string,
  strategy: ContextStrategy,
  priority: ContentPriority,
  model: string
): WeightedNode[] {
  return nodes.map(node => {
    let weight = 0
    let reason = ''
    
    // Base weight from strategy
    switch (strategy) {
      case 'comprehensive':
        weight = 0.5 + (node.depth * 0.1) // Prefer deeper context
        reason = 'comprehensive-depth'
        break
        
      case 'focused':
        weight = node.parentId ? 0.8 : 0.3 // Heavily favor direct ancestors
        reason = 'focused-ancestry'
        break
        
      case 'exploratory':
        weight = node.parentId ? 0.3 : 0.8 // Heavily favor siblings
        reason = 'exploratory-diversity'
        break
        
      case 'reference-heavy':
        // This will be boosted later if node is referenced
        weight = 0.2
        reason = 'reference-base'
        break
        
      case 'minimal':
        weight = node.depth === 0 ? 0.9 : Math.max(0.1, 0.8 - (node.depth * 0.2))
        reason = 'minimal-essential'
        break
        
      case 'analytical':
        weight = 0.4 + (node.response ? 0.3 : 0) // Prefer complete Q&A
        reason = 'analytical-completeness'
        break
        
      case 'creative':
        weight = 0.3 + Math.random() * 0.4 // Add randomness for diversity
        reason = 'creative-diversity'
        break
    }
    
    // Adjust weight based on priority
    switch (priority) {
      case 'recency':
        const daysSinceCreated = (Date.now() - node.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        weight *= Math.max(0.1, 1 - (daysSinceCreated * 0.1))
        break
        
      case 'relevance':
        const relevanceScore = calculateRelevanceScore(targetPrompt, node.prompt)
        weight *= (0.3 + relevanceScore * 0.7)
        break
        
      case 'completeness':
        weight *= node.response ? 1.0 : 0.3
        break
        
      case 'depth':
        const responseLength = node.response?.length || 0
        weight *= Math.min(1.5, 0.5 + (responseLength / 1000))
        break
        
      case 'breadth':
        // Prefer nodes that introduce new topics (simplified heuristic)
        const uniqueWords = extractKeywords(node.prompt).length
        weight *= Math.min(1.3, 0.7 + (uniqueWords * 0.1))
        break
    }
    
    const tokenCount = countTokens(`${node.prompt}\n${node.response || ''}`, model)
    
    return {
      node,
      weight: Math.min(1.0, weight), // Cap at 1.0
      reason,
      tokenCount
    }
  }).sort((a, b) => b.weight - a.weight) // Sort by weight descending
}

/**
 * Create intelligent summary of selected content
 */
export function createContextSummary(
  nodes: WeightedNode[],
  strategy: ContextStrategy,
  model: string,
  maxTokens: number
): string {
  if (nodes.length === 0) return ''
  
  // Strategy-specific summary approaches
  switch (strategy) {
    case 'analytical':
      return createAnalyticalSummary(nodes, maxTokens, model)
      
    case 'exploratory':
      return createExploratorySummary(nodes, maxTokens, model)
      
    case 'reference-heavy':
      return createReferenceSummary(nodes, maxTokens, model)
      
    case 'creative':
      return createCreativeSummary(nodes, maxTokens, model)
      
    default:
      return createStandardSummary(nodes, maxTokens, model)
  }
}

function createStandardSummary(nodes: WeightedNode[], maxTokens: number, model: string): string {
  const summaries = nodes.map(({ node, weight }) => {
    const shortId = node.id.slice(-8)
    const topic = node.prompt.slice(0, 60).replace(/\n/g, ' ')
    return `- [${shortId}] (${(weight * 100).toFixed(0)}%) ${topic}${node.prompt.length > 60 ? '...' : ''}`
  })
  
  const summary = `Previous context (${nodes.length} nodes):\n${summaries.join('\n')}`
  
  // Truncate if necessary
  if (countTokens(summary, model) > maxTokens) {
    return truncateToTokenLimit(summary, model, maxTokens).text
  }
  
  return summary
}

function createAnalyticalSummary(nodes: WeightedNode[], maxTokens: number, model: string): string {
  const byTopic = groupNodesByTopic(nodes)
  const summaries: string[] = []
  
  Object.entries(byTopic).forEach(([topic, topicNodes]) => {
    const nodeCount = topicNodes.length
    const avgWeight = topicNodes.reduce((sum, n) => sum + n.weight, 0) / nodeCount
    const key_points = topicNodes.slice(0, 2).map(n => n.node.prompt.slice(0, 40)).join(', ')
    
    summaries.push(`${topic} (${nodeCount} nodes, ${(avgWeight * 100).toFixed(0)}% relevance): ${key_points}...`)
  })
  
  const summary = `Analytical context:\n${summaries.join('\n')}`
  
  if (countTokens(summary, model) > maxTokens) {
    return truncateToTokenLimit(summary, model, maxTokens).text
  }
  
  return summary
}

function createExploratorySummary(nodes: WeightedNode[], maxTokens: number, model: string): string {
  const approaches = nodes.map(({ node, weight }) => {
    const approach = node.prompt.slice(0, 80).replace(/\n/g, ' ')
    return `• Alternative: ${approach}${node.prompt.length > 80 ? '...' : ''} (${(weight * 100).toFixed(0)}% relevance)`
  })
  
  const summary = `Exploratory context - Alternative approaches considered:\n${approaches.join('\n')}`
  
  if (countTokens(summary, model) > maxTokens) {
    return truncateToTokenLimit(summary, model, maxTokens).text
  }
  
  return summary
}

function createReferenceSummary(nodes: WeightedNode[], maxTokens: number, model: string): string {
  const references = nodes.map(({ node }) => {
    return `REF [${node.id.slice(-8)}]: "${node.prompt}" → "${(node.response || 'No response').slice(0, 100)}${node.response && node.response.length > 100 ? '...' : ''}"`
  })
  
  const summary = `Referenced conversations:\n${references.join('\n')}`
  
  if (countTokens(summary, model) > maxTokens) {
    return truncateToTokenLimit(summary, model, maxTokens).text
  }
  
  return summary
}

function createCreativeSummary(nodes: WeightedNode[], maxTokens: number, model: string): string {
  const examples = nodes.map(({ node }) => {
    const topic = extractKeywords(node.prompt)[0] || 'topic'
    return `💡 ${topic}: "${node.prompt.slice(0, 60)}${node.prompt.length > 60 ? '...' : ''}"`
  })
  
  const summary = `Creative context - Inspiring examples:\n${examples.join('\n')}`
  
  if (countTokens(summary, model) > maxTokens) {
    return truncateToTokenLimit(summary, model, maxTokens).text
  }
  
  return summary
}

/**
 * Group nodes by topic using keyword similarity
 */
function groupNodesByTopic(nodes: WeightedNode[]): Record<string, WeightedNode[]> {
  const topics: Record<string, WeightedNode[]> = {}
  
  nodes.forEach(node => {
    const keywords = extractKeywords(node.node.prompt)
    const primaryKeyword = keywords[0] || 'general'
    
    if (!topics[primaryKeyword]) {
      topics[primaryKeyword] = []
    }
    topics[primaryKeyword].push(node)
  })
  
  return topics
}

/**
 * Get default strategy based on prompt content
 */
export function inferOptimalStrategy(prompt: string): ContextStrategy {
  const promptLower = prompt.toLowerCase()
  
  // Reference-heavy if contains explicit references
  if (prompt.includes('@') || prompt.includes('#') || prompt.includes('[[')) {
    return 'reference-heavy'
  }
  
  // Analytical for comparison/analysis tasks
  if (promptLower.includes('compare') || promptLower.includes('analyze') || 
      promptLower.includes('difference') || promptLower.includes('versus')) {
    return 'analytical'
  }
  
  // Exploratory for brainstorming/ideation
  if (promptLower.includes('idea') || promptLower.includes('alternative') || 
      promptLower.includes('brainstorm') || promptLower.includes('option')) {
    return 'exploratory'
  }
  
  // Creative for creative tasks
  if (promptLower.includes('creative') || promptLower.includes('design') || 
      promptLower.includes('story') || promptLower.includes('imagine')) {
    return 'creative'
  }
  
  // Focused for specific questions
  if (promptLower.includes('how to') || promptLower.includes('explain') || 
      promptLower.includes('what is')) {
    return 'focused'
  }
  
  return 'comprehensive' // Default strategy
}

/**
 * Get default priority based on strategy
 */
export function getDefaultPriority(strategy: ContextStrategy): ContentPriority {
  switch (strategy) {
    case 'focused': return 'relevance'
    case 'exploratory': return 'breadth'
    case 'reference-heavy': return 'completeness'
    case 'minimal': return 'recency'
    case 'analytical': return 'depth'
    case 'creative': return 'breadth'
    case 'comprehensive':
    default: return 'relevance'
  }
}