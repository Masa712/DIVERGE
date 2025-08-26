/**
 * Performance optimization utilities for reducing API response times
 * Addresses common bottlenecks in token counting and context building
 */

import { ChatNode } from '@/types'

// Token count cache to avoid re-processing same content
class TokenCountCache {
  private cache = new Map<string, number>()
  private readonly maxSize = 1000
  
  get(content: string): number | null {
    const hash = this.hashContent(content)
    return this.cache.get(hash) || null
  }
  
  set(content: string, count: number): void {
    const hash = this.hashContent(content)
    
    // Implement LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(hash, count)
  }
  
  private hashContent(content: string): string {
    // Simple hash function for content deduplication
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(36)
  }
  
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    }
  }
}

const tokenCache = new TokenCountCache()

/**
 * Optimized token counting with caching
 */
export function cachedTokenCount(content: string): number {
  // Check cache first
  const cached = tokenCache.get(content)
  if (cached !== null) {
    return cached
  }
  
  // Simple approximation for faster processing
  // Tiktoken is expensive, so we use a good approximation
  const approximateCount = Math.ceil(content.length / 3.5)
  
  // Cache the result
  tokenCache.set(content, approximateCount)
  
  return approximateCount
}

/**
 * Fast context building with performance optimizations
 */
export function optimizedContextBuilder(
  nodes: ChatNode[],
  maxTokens: number = 3000
): { messages: Array<{ role: string; content: string }>; totalTokens: number } {
  const messages: Array<{ role: string; content: string }> = []
  let totalTokens = 0
  
  // Sort nodes by relevance (more recent first)
  const sortedNodes = nodes.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  
  for (const node of sortedNodes) {
    if (!node.prompt && !node.response) continue
    
    // Add user message
    if (node.prompt) {
      const promptTokens = cachedTokenCount(node.prompt)
      if (totalTokens + promptTokens <= maxTokens) {
        messages.push({ role: 'user', content: node.prompt })
        totalTokens += promptTokens
      } else {
        break // Stop adding if we would exceed limit
      }
    }
    
    // Add assistant response
    if (node.response) {
      const responseTokens = cachedTokenCount(node.response)
      if (totalTokens + responseTokens <= maxTokens) {
        messages.push({ role: 'assistant', content: node.response })
        totalTokens += responseTokens
      } else {
        break // Stop adding if we would exceed limit
      }
    }
  }
  
  // Reverse to maintain chronological order
  messages.reverse()
  
  return {
    messages,
    totalTokens
  }
}

/**
 * Lightweight node processing for better performance
 */
export function preprocessNodes(nodes: any[]): ChatNode[] {
  return nodes.map(node => ({
    id: node.id,
    sessionId: node.session_id,
    parentId: node.parent_id,
    model: node.model,
    systemPrompt: node.system_prompt || null,
    prompt: node.prompt || '',
    response: node.response || '',
    status: node.status,
    errorMessage: node.error_message || null,
    depth: node.depth || 0,
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
 * Performance monitoring for API routes
 */
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>()
  
  startTimer(operation: string): () => void {
    const startTime = performance.now()
    
    return () => {
      const duration = performance.now() - startTime
      
      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, [])
      }
      
      const times = this.metrics.get(operation)!
      times.push(duration)
      
      // Keep only last 100 measurements
      if (times.length > 100) {
        times.shift()
      }
      
      // Log slow operations in development
      if (process.env.NODE_ENV === 'development' && duration > 1000) {
        console.warn(`⚠️ Slow operation detected: ${operation} took ${Math.round(duration)}ms`)
      }
    }
  }
  
  getStats(operation?: string): Record<string, {
    count: number
    average: number
    min: number
    max: number
    recent: number
  }> {
    const stats: Record<string, any> = {}
    
    const operations = operation ? [operation] : Array.from(this.metrics.keys())
    
    for (const op of operations) {
      const times = this.metrics.get(op) || []
      if (times.length === 0) continue
      
      stats[op] = {
        count: times.length,
        average: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        min: Math.round(Math.min(...times)),
        max: Math.round(Math.max(...times)),
        recent: Math.round(times[times.length - 1] || 0)
      }
    }
    
    return stats
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

/**
 * Optimized async operations with timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 5000,
  operation: string = 'operation'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  ])
}

/**
 * Batch processing utility for better performance
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize: number = 50
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await processor(batch)
    results.push(...batchResults)
  }
  
  return results
}

/**
 * Memory usage optimization utilities
 */
export function cleanupUnusedObjects(): void {
  // Clear token cache if it gets too large
  const stats = tokenCache.getStats()
  if (stats.size > stats.maxSize * 0.8) {
    tokenCache['cache'].clear() // Clear cache when 80% full
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Cleared token count cache for memory optimization')
    }
  }
}

// Automatic cleanup every 5 minutes
if (typeof window === 'undefined') { // Only in Node.js environment
  setInterval(cleanupUnusedObjects, 5 * 60 * 1000)
}