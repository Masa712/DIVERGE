/**
 * AI-powered node summarization system
 * Reduces token usage while preserving conversation context
 */

import { ChatNode } from '@/types'
import { OpenRouterClient } from '@/lib/openrouter/client'
import { countTokens } from '@/lib/utils/token-counter'

// In-memory cache for summarized nodes
const summaryCache = new Map<string, { summary: string; tokens: number; createdAt: Date }>()

// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000

/**
 * Summarize a node using AI (with caching)
 */
export async function summarizeNodeWithAI(
  node: ChatNode,
  targetTokens: number = 200,
  model: string = 'gpt-4o'
): Promise<{ summary: string; tokens: number }> {
  const cacheKey = `${node.id}_${targetTokens}`

  // Check cache first
  const cached = summaryCache.get(cacheKey)
  if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_MS) {
    console.log(`📦 Using cached summary for node ${node.id.substring(0, 8)}`)
    return { summary: cached.summary, tokens: cached.tokens }
  }

  console.log(`🤖 Generating AI summary for node ${node.id.substring(0, 8)} (target: ${targetTokens} tokens)`)

  try {
    // Construct summarization prompt
    const promptText = `以下の会話のやり取りを${targetTokens}トークン以内で簡潔に要約してください。
重要なポイントと結論のみを含めてください。

ユーザーの質問: ${node.prompt}

AIの回答: ${node.response || '(回答なし)'}

要約（${targetTokens}トークン以内）:`

    // Use fast, cost-effective model for summarization
    const client = new OpenRouterClient()
    const response = await client.createChatCompletion({
      model: 'openai/gpt-5-nano', // Fast and cheap
      messages: [{ role: 'user', content: promptText }],
      max_tokens: targetTokens,
      temperature: 0.3, // Lower temperature for consistent summaries
      stream: false
    })

    const summary = response.choices[0]?.message?.content || ''
    const tokens = countTokens(summary, model)

    // Cache the result
    summaryCache.set(cacheKey, {
      summary,
      tokens,
      createdAt: new Date()
    })

    console.log(`✅ Summary generated: ${tokens} tokens (original: ${countTokens(node.prompt + node.response, model)})`)

    return { summary, tokens }
  } catch (error) {
    console.error('❌ Failed to generate summary:', error)

    // Fallback to simple truncation
    return simpleTruncation(node, targetTokens, model)
  }
}

/**
 * Simple truncation fallback (no AI)
 */
function simpleTruncation(
  node: ChatNode,
  targetTokens: number,
  model: string
): { summary: string; tokens: number } {
  const combined = `Q: ${node.prompt}\nA: ${node.response || '(回答なし)'}`
  const charLimit = Math.floor(targetTokens * 3.5) // Rough token estimation

  if (combined.length <= charLimit) {
    return {
      summary: combined,
      tokens: countTokens(combined, model)
    }
  }

  // Keep first 60% and last 30%
  const firstPart = combined.substring(0, Math.floor(charLimit * 0.6))
  const lastPart = combined.substring(combined.length - Math.floor(charLimit * 0.3))
  const summary = `${firstPart}...[中略]...${lastPart}`

  return {
    summary,
    tokens: countTokens(summary, model)
  }
}

/**
 * Batch summarize multiple nodes
 */
export async function summarizeNodes(
  nodes: ChatNode[],
  targetTokensPerNode: number = 200,
  model: string = 'gpt-4o'
): Promise<Map<string, { summary: string; tokens: number }>> {
  const results = new Map<string, { summary: string; tokens: number }>()

  // Process in parallel with concurrency limit
  const concurrency = 3
  for (let i = 0; i < nodes.length; i += concurrency) {
    const batch = nodes.slice(i, i + concurrency)
    const promises = batch.map(node =>
      summarizeNodeWithAI(node, targetTokensPerNode, model)
        .then(result => ({ nodeId: node.id, result }))
    )

    const batchResults = await Promise.all(promises)
    batchResults.forEach(({ nodeId, result }) => {
      results.set(nodeId, result)
    })
  }

  return results
}

/**
 * Clear summary cache (for testing/debugging)
 */
export function clearSummaryCache(): void {
  summaryCache.clear()
  console.log('🧹 Summary cache cleared')
}

/**
 * Get cache statistics
 */
export function getSummaryCacheStats() {
  return {
    size: summaryCache.size,
    entries: Array.from(summaryCache.entries()).map(([key, value]) => ({
      key,
      tokens: value.tokens,
      age: Date.now() - value.createdAt.getTime()
    }))
  }
}
