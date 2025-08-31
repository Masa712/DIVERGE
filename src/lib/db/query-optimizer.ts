/**
 * Database Query Optimization Framework
 * Provides intelligent query batching, caching, and N+1 prevention
 */

import { withPooledConnection } from '@/lib/supabase/connection-pool'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAppError, ErrorCategory } from '@/lib/errors/error-handler'

// Query performance metrics
interface QueryMetrics {
  queryId: string
  executionTime: number
  resultCount: number
  cacheHit: boolean
  batchSize?: number
  timestamp: string
}

// Query cache for reducing duplicate requests
class QueryCache {
  private cache = new Map<string, { data: any; expires: number }>()
  private readonly defaultTTL = 30000 // 30 seconds

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl
    })
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }
  
  clearPattern(pattern: string): void {
    const keys = Array.from(this.cache.keys())
    for (const key of keys) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  size(): number {
    return this.cache.size
  }
}

// Global query cache instance
const queryCache = new QueryCache()

// Query performance tracker
class QueryPerformanceTracker {
  private metrics: QueryMetrics[] = []
  private readonly maxMetrics = 1000

  recordQuery(metric: QueryMetrics): void {
    this.metrics.push(metric)
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  getStats(): {
    totalQueries: number
    averageExecutionTime: number
    cacheHitRate: number
    slowQueries: QueryMetrics[]
  } {
    if (this.metrics.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        cacheHitRate: 0,
        slowQueries: []
      }
    }

    const totalQueries = this.metrics.length
    const averageExecutionTime = this.metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries
    const cacheHits = this.metrics.filter(m => m.cacheHit).length
    const cacheHitRate = (cacheHits / totalQueries) * 100
    const slowQueries = this.metrics
      .filter(m => m.executionTime > 1000) // > 1 second
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10)

    return {
      totalQueries,
      averageExecutionTime,
      cacheHitRate,
      slowQueries
    }
  }
}

const performanceTracker = new QueryPerformanceTracker()

/**
 * Enhanced query executor with caching and performance tracking
 */
export async function executeOptimizedQuery<T>(
  queryId: string,
  queryFn: (supabase: SupabaseClient) => Promise<T>,
  options: {
    poolKey?: string
    cacheTTL?: number
    skipCache?: boolean
  } = {}
): Promise<T> {
  const startTime = performance.now()
  const { poolKey = 'default', cacheTTL = 30000, skipCache = false } = options
  
  // Check cache first
  if (!skipCache) {
    const cached = queryCache.get(queryId)
    if (cached) {
      const executionTime = performance.now() - startTime
      performanceTracker.recordQuery({
        queryId,
        executionTime,
        resultCount: Array.isArray(cached) ? cached.length : 1,
        cacheHit: true,
        timestamp: new Date().toISOString()
      })
      return cached
    }
  }
  
  try {
    // Execute query with connection pooling
    const result = await withPooledConnection(queryFn, poolKey)
    const executionTime = performance.now() - startTime
    
    // Cache the result
    if (!skipCache) {
      queryCache.set(queryId, result, cacheTTL)
    }
    
    // Record performance metrics
    performanceTracker.recordQuery({
      queryId,
      executionTime,
      resultCount: Array.isArray(result) ? result.length : 1,
      cacheHit: false,
      timestamp: new Date().toISOString()
    })
    
    return result
    
  } catch (error) {
    const executionTime = performance.now() - startTime
    performanceTracker.recordQuery({
      queryId: `${queryId}_error`,
      executionTime,
      resultCount: 0,
      cacheHit: false,
      timestamp: new Date().toISOString()
    })
    
    // Log detailed error information
    console.error('❌ Database query failed:', {
      queryId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    })
    
    throw createAppError(
      `Optimized query failed: ${queryId}`,
      ErrorCategory.DATABASE,
      { context: { queryId }, cause: error as Error }
    )
  }
}

/**
 * Batch query executor for preventing N+1 queries
 */
export class BatchQueryLoader<K, V> {
  private pendingQueries = new Map<K, Promise<V>>()
  private batchTimeout: NodeJS.Timeout | null = null
  private readonly batchSize: number
  private readonly batchDelayMs: number
  
  constructor(
    private loadFunction: (keys: K[]) => Promise<V[]>,
    options: {
      batchSize?: number
      batchDelayMs?: number
    } = {}
  ) {
    this.batchSize = options.batchSize || 50
    this.batchDelayMs = options.batchDelayMs || 10
  }
  
  load(key: K): Promise<V> {
    // Check if we already have a pending query for this key
    const existing = this.pendingQueries.get(key)
    if (existing) {
      return existing
    }
    
    // Create a new promise for this key
    const promise = new Promise<V>((resolve, reject) => {
      // Add to batch queue
      this.enqueueBatch(key, resolve, reject)
    })
    
    this.pendingQueries.set(key, promise)
    return promise
  }
  
  private batchQueue: Array<{
    key: K
    resolve: (value: V) => void
    reject: (error: any) => void
  }> = []
  
  private enqueueBatch(
    key: K, 
    resolve: (value: V) => void, 
    reject: (error: any) => void
  ): void {
    this.batchQueue.push({ key, resolve, reject })
    
    // Process batch when we reach batch size or after delay
    if (this.batchQueue.length >= this.batchSize) {
      this.processBatch()
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.processBatch()
      }, this.batchDelayMs)
    }
  }
  
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return
    
    const batch = this.batchQueue.splice(0, this.batchSize)
    const keys = batch.map(item => item.key)
    
    // Clear timeout if set
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }
    
    try {
      const startTime = performance.now()
      const results = await this.loadFunction(keys)
      const executionTime = performance.now() - startTime
      
      // Record batch performance
      performanceTracker.recordQuery({
        queryId: 'batch_query',
        executionTime,
        resultCount: results.length,
        cacheHit: false,
        batchSize: batch.length,
        timestamp: new Date().toISOString()
      })
      
      // Resolve all promises in the batch
      batch.forEach((item, index) => {
        const result = results[index]
        if (result) {
          item.resolve(result)
          // Clear from pending queries
          this.pendingQueries.delete(item.key)
        } else {
          item.reject(new Error(`No result found for key: ${item.key}`))
        }
      })
      
    } catch (error) {
      // Reject all promises in the batch
      batch.forEach(item => {
        item.reject(error)
        this.pendingQueries.delete(item.key)
      })
    }
  }
}

/**
 * Optimized chat nodes loader for preventing N+1 queries
 */
export const chatNodesLoader = new BatchQueryLoader<string, any[]>(
  async (sessionIds: string[]) => {
    return await withPooledConnection(async (supabase) => {
      const { data, error } = await supabase
        .from('chat_nodes')
        .select(`
          id,
          session_id,
          parent_id,
          model,
          prompt,
          response,
          status,
          depth,
          prompt_tokens,
          response_tokens,
          cost_usd,
          temperature,
          max_tokens,
          created_at,
          updated_at
        `)
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true })
      
      if (error) {
        throw createAppError(
          'Failed to batch load chat nodes',
          ErrorCategory.DATABASE,
          { context: { sessionIds }, cause: error }
        )
      }
      
      // Group by session_id
      const grouped = sessionIds.map(sessionId => 
        (data || []).filter(node => node.session_id === sessionId)
      )
      
      return grouped
    }, 'batch_chat_nodes')
  },
  { batchSize: 20, batchDelayMs: 5 }
)

/**
 * Optimized sessions loader with enhanced selection
 */
export async function loadOptimizedSessions(
  userId: string,
  options: {
    includeNodeCount?: boolean
    includeLastMessage?: boolean
    limit?: number
    offset?: number
    archived?: boolean
  } = {}
): Promise<any[]> {
  const {
    includeNodeCount = false,
    includeLastMessage = false,
    limit = 20,
    offset = 0,
    archived = false
  } = options
  
  const cacheKey = `sessions_${userId}_${JSON.stringify(options)}`
  
  return await executeOptimizedQuery(
    cacheKey,
    async (supabase) => {
      let selectQuery = `
        id,
        name,
        description,
        user_id,
        root_node_id,
        total_cost_usd,
        total_tokens,
        node_count,
        max_depth,
        is_archived,
        created_at,
        updated_at,
        last_accessed_at
      `
      
      // For now, remove problematic joins and use the stored node_count field
      // The node_count field should be maintained by triggers or application logic
      
      const { data, error } = await supabase
        .from('sessions')
        .select(selectQuery.trim())
        .eq('user_id', userId)
        .eq('is_archived', archived)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)
      
      if (error) {
        throw createAppError(
          'Failed to load optimized sessions',
          ErrorCategory.DATABASE,
          { context: { userId, options }, cause: error }
        )
      }
      
      return data || []
    },
    { poolKey: `sessions_${userId}`, cacheTTL: 10000 } // 10 second cache for quick UI updates
  )
}

/**
 * Get query performance statistics
 */
export function getQueryPerformanceStats() {
  return {
    ...performanceTracker.getStats(),
    cacheSize: queryCache.size()
  }
}

/**
 * Clear query cache (for testing or memory management)
 */
export function clearQueryCache(): void {
  queryCache.clear()
}

/**
 * Clear session-related caches for a user
 */
export function clearSessionCache(userId: string): void {
  queryCache.clearPattern(`sessions_${userId}`)
  queryCache.clearPattern(`count_${userId}`)
  console.log(`🧹 Cleared session cache for user: ${userId}`)
}

/**
 * Prefetch commonly accessed data
 */
export async function prefetchUserData(userId: string): Promise<void> {
  try {
    // Prefetch user sessions
    await loadOptimizedSessions(userId, { 
      includeNodeCount: true,
      limit: 10 
    })
    
    console.log(`📦 Prefetched data for user: ${userId}`)
  } catch (error) {
    console.warn('Failed to prefetch user data:', error)
  }
}

/**
 * Database index suggestions based on query patterns
 */
export const INDEX_SUGGESTIONS = {
  chat_nodes: [
    'CREATE INDEX CONCURRENTLY idx_chat_nodes_session_created ON chat_nodes(session_id, created_at);',
    'CREATE INDEX CONCURRENTLY idx_chat_nodes_parent_id ON chat_nodes(parent_id) WHERE parent_id IS NOT NULL;',
    'CREATE INDEX CONCURRENTLY idx_chat_nodes_status ON chat_nodes(status);'
  ],
  sessions: [
    'CREATE INDEX CONCURRENTLY idx_sessions_user_accessed ON sessions(user_id, last_accessed_at DESC);',
    'CREATE INDEX CONCURRENTLY idx_sessions_archived ON sessions(user_id, is_archived, last_accessed_at DESC);'
  ]
} as const