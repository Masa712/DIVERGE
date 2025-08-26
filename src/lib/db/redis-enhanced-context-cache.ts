/**
 * Redis-based Enhanced Context Cache
 * Distributed cache implementation for Enhanced Context system
 */

import { DistributedCache, getDistributedCache } from '../redis/distributed-cache'
import { isRedisAvailableSync } from '../redis/client'
import { createClient } from '../supabase/server'

interface SessionNode {
  id: string
  sessionId: string
  parentId: string | null
  prompt: string
  response: string
  status: string
  createdAt: string
  updatedAt: string
  [key: string]: any
}

interface ShortIdMapping {
  [shortId: string]: string // short ID to full ID mapping
}

interface CacheMetadata {
  sessionId: string
  nodeCount: number
  lastUpdated: number
  version: number
}

export class RedisEnhancedContextCache {
  private cache: DistributedCache
  private supabase = createClient()
  private performanceMetrics = {
    hitCount: 0,
    missCount: 0,
    errorCount: 0,
    avgResponseTime: 0,
  }

  constructor() {
    this.cache = getDistributedCache({
      namespace: 'enhanced-context',
      ttlSeconds: 900, // 15 minutes
      compressionEnabled: true,
      localCacheTTL: 5, // 5 seconds local cache
      maxLocalCacheSize: 50,
      enablePubSub: true,
    })
  }

  /**
   * Get session nodes from distributed cache or database
   */
  async getSessionNodes(sessionId: string): Promise<SessionNode[]> {
    const startTime = performance.now()
    const cacheKey = `session:${sessionId}:nodes`
    
    try {
      // Try cache first
      const cached = await this.cache.get<SessionNode[]>(cacheKey)
      if (cached) {
        this.recordHit(performance.now() - startTime)
        console.log(`🎯 Cache hit for session ${sessionId}: ${cached.length} nodes`)
        return cached
      }
      
      // Cache miss - fetch from database
      this.recordMiss()
      const { data: nodes, error } = await this.supabase
        .from('chat_nodes')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('Failed to fetch nodes from database:', error)
        this.recordError()
        return []
      }
      
      if (nodes && nodes.length > 0) {
        // Store in distributed cache
        await this.cache.set(cacheKey, nodes)
        
        // Also store short ID mappings
        await this.updateShortIdMappings(sessionId, nodes)
        
        // Store metadata
        await this.updateCacheMetadata(sessionId, nodes.length)
      }
      
      const responseTime = performance.now() - startTime
      this.updateAvgResponseTime(responseTime)
      
      return nodes || []
    } catch (error) {
      console.error('Error getting session nodes:', error)
      this.recordError()
      return []
    }
  }

  /**
   * Get or build short ID lookup for a session
   */
  async getShortIdLookup(sessionId: string): Promise<Map<string, string>> {
    const cacheKey = `session:${sessionId}:shortids`
    
    try {
      // Try cache first
      const cached = await this.cache.get<ShortIdMapping>(cacheKey)
      if (cached) {
        console.log(`🎯 Short ID cache hit for session ${sessionId}`)
        return new Map(Object.entries(cached))
      }
      
      // Build from session nodes
      const nodes = await this.getSessionNodes(sessionId)
      const lookup = new Map<string, string>()
      
      nodes.forEach(node => {
        if (node.id) {
          // Store multiple short ID lengths for flexibility
          lookup.set(node.id.slice(-8), node.id)
          lookup.set(node.id.slice(-12), node.id)
          lookup.set(node.id.slice(-16), node.id)
        }
      })
      
      // Cache the mapping
      if (lookup.size > 0) {
        const mappingObj = Object.fromEntries(lookup.entries())
        await this.cache.set(cacheKey, mappingObj)
      }
      
      return lookup
    } catch (error) {
      console.error('Error getting short ID lookup:', error)
      return new Map()
    }
  }

  /**
   * Resolve a short ID to full ID with cross-session support
   */
  async resolveShortId(shortId: string, primarySessionId?: string): Promise<{
    fullId: string | null
    sessionId: string | null
  }> {
    // First try the primary session if provided
    if (primarySessionId) {
      const lookup = await this.getShortIdLookup(primarySessionId)
      const fullId = lookup.get(shortId)
      if (fullId) {
        return { fullId, sessionId: primarySessionId }
      }
    }
    
    // Try global resolution (search across all cached sessions)
    const globalKey = `global:shortid:${shortId}`
    const cached = await this.cache.get<{ fullId: string; sessionId: string }>(globalKey)
    
    if (cached) {
      return cached
    }
    
    // Fall back to database search
    const { data, error } = await this.supabase
      .from('chat_nodes')
      .select('id, session_id')
      .or(`id.ilike.%${shortId}`)
      .limit(1)
      .single()
    
    if (!error && data) {
      const result = { fullId: data.id, sessionId: data.session_id }
      // Cache globally for future lookups
      await this.cache.set(globalKey, result, 1800) // 30 minutes
      return result
    }
    
    return { fullId: null, sessionId: null }
  }

  /**
   * Clear cache for a specific session
   */
  async clearSessionCache(sessionId: string): Promise<void> {
    console.log(`🧹 Clearing distributed cache for session ${sessionId}`)
    
    // Clear all session-related keys
    await Promise.all([
      this.cache.delete(`session:${sessionId}:nodes`),
      this.cache.delete(`session:${sessionId}:shortids`),
      this.cache.delete(`session:${sessionId}:metadata`),
    ])
    
    // Invalidate global short ID mappings for this session
    const nodes = await this.getSessionNodes(sessionId)
    for (const node of nodes) {
      const shortIds = [
        node.id.slice(-8),
        node.id.slice(-12),
        node.id.slice(-16),
      ]
      for (const shortId of shortIds) {
        await this.cache.delete(`global:shortid:${shortId}`)
      }
    }
  }

  /**
   * Add a new node and update cache
   */
  async addNode(sessionId: string, node: SessionNode): Promise<void> {
    const cacheKey = `session:${sessionId}:nodes`
    
    // Get existing nodes
    const nodes = await this.getSessionNodes(sessionId)
    
    // Add new node
    nodes.push(node)
    
    // Update cache
    await this.cache.set(cacheKey, nodes)
    
    // Update short ID mappings
    await this.updateShortIdMappings(sessionId, nodes)
    
    // Update metadata
    await this.updateCacheMetadata(sessionId, nodes.length)
    
    console.log(`➕ Added node ${node.id} to distributed cache`)
  }

  /**
   * Warm cache for multiple sessions (batch operation)
   */
  async warmCache(sessionIds: string[]): Promise<void> {
    console.log(`🔥 Warming distributed cache for ${sessionIds.length} sessions`)
    
    const promises = sessionIds.map(async (sessionId) => {
      try {
        await this.getSessionNodes(sessionId)
      } catch (error) {
        console.error(`Failed to warm cache for session ${sessionId}:`, error)
      }
    })
    
    await Promise.allSettled(promises)
    console.log('✅ Cache warming complete')
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    performance: any
    cache: any
    redis: {
      available: boolean
      health: any
    }
  }> {
    const cacheStats = await this.cache.getStats()
    
    // Get Redis health
    let redisHealth = null
    if (isRedisAvailableSync()) {
      const { getRedisHealth } = await import('../redis/client')
      redisHealth = await getRedisHealth()
    }
    
    return {
      performance: {
        ...this.performanceMetrics,
        hitRate: this.calculateHitRate(),
      } as any,
      cache: cacheStats,
      redis: {
        available: isRedisAvailableSync(),
        health: redisHealth,
      },
    }
  }

  /**
   * Subscribe to session updates
   */
  subscribeToSession(sessionId: string, callback: (nodes: SessionNode[]) => void): () => void {
    const cacheKey = `session:${sessionId}:nodes`
    return this.cache.subscribe(cacheKey, callback)
  }

  // Private helper methods

  private async updateShortIdMappings(sessionId: string, nodes: SessionNode[]): Promise<void> {
    const cacheKey = `session:${sessionId}:shortids`
    const mapping: ShortIdMapping = {}
    
    nodes.forEach(node => {
      if (node.id) {
        mapping[node.id.slice(-8)] = node.id
        mapping[node.id.slice(-12)] = node.id
        mapping[node.id.slice(-16)] = node.id
      }
    })
    
    await this.cache.set(cacheKey, mapping)
  }

  private async updateCacheMetadata(sessionId: string, nodeCount: number): Promise<void> {
    const metadata: CacheMetadata = {
      sessionId,
      nodeCount,
      lastUpdated: Date.now(),
      version: 1,
    }
    
    await this.cache.set(`session:${sessionId}:metadata`, metadata)
  }

  private recordHit(responseTime: number): void {
    this.performanceMetrics.hitCount++
    this.updateAvgResponseTime(responseTime)
  }

  private recordMiss(): void {
    this.performanceMetrics.missCount++
  }

  private recordError(): void {
    this.performanceMetrics.errorCount++
  }

  private updateAvgResponseTime(responseTime: number): void {
    const alpha = 0.1 // Exponential moving average factor
    this.performanceMetrics.avgResponseTime = 
      this.performanceMetrics.avgResponseTime * (1 - alpha) + responseTime * alpha
  }

  private calculateHitRate = (): number => {
    const total = this.performanceMetrics.hitCount + this.performanceMetrics.missCount
    if (total === 0) return 0
    return (this.performanceMetrics.hitCount / total) * 100
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.cache.destroy()
  }
}

// Export singleton instance
let globalRedisCache: RedisEnhancedContextCache | null = null

export function getRedisEnhancedContextCache(): RedisEnhancedContextCache {
  if (!globalRedisCache) {
    globalRedisCache = new RedisEnhancedContextCache()
  }
  return globalRedisCache
}

// Export for backwards compatibility
export const clearSessionCache = async (sessionId: string) => {
  const cache = getRedisEnhancedContextCache()
  await cache.clearSessionCache(sessionId)
}

export const getSessionNodes = async (sessionId: string) => {
  const cache = getRedisEnhancedContextCache()
  return cache.getSessionNodes(sessionId)
}

export const getShortIdLookup = async (sessionId: string) => {
  const cache = getRedisEnhancedContextCache()
  return cache.getShortIdLookup(sessionId)
}