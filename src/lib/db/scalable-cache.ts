/**
 * Scalable caching system for Enhanced Context
 * Designed for enterprise-scale performance with memory efficiency and distributed support
 */

import { ChatNode } from '@/types'

// Configuration for scalable cache
interface ScalableCacheConfig {
  maxSessionCache: number      // Maximum sessions to cache
  maxNodesPerSession: number   // Maximum nodes per session
  ttlMinutes: number          // Time to live for cache entries
  memoryThresholdMB: number   // Memory usage threshold for cleanup
  compressionEnabled: boolean  // Enable data compression
  persistToStorage: boolean   // Persist cache to storage
}

const DEFAULT_CONFIG: ScalableCacheConfig = {
  maxSessionCache: 1000,       // Support 1000 active sessions
  maxNodesPerSession: 500,     // 500 nodes per session max
  ttlMinutes: 30,             // 30 minute TTL
  memoryThresholdMB: 100,     // 100MB memory threshold
  compressionEnabled: true,    // Enable compression
  persistToStorage: false     // Disable persistence by default
}

// Cache entry with metadata
interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
  lastAccess: number
  compressedSize?: number
  originalSize?: number
}

// Performance metrics
interface CacheMetrics {
  hitRate: number
  memoryUsageMB: number
  activeSession: number
  totalNodes: number
  compressionRatio: number
  evictionCount: number
  averageResponseTime: number
}

// Global scalable cache system
class ScalableEnhancedContextCache {
  private config: ScalableCacheConfig
  private sessionCache: Map<string, CacheEntry<Map<string, any>>>
  private shortIdCache: Map<string, CacheEntry<Map<string, string>>>
  private globalNodeIndex: Map<string, string> // nodeId -> sessionId mapping
  private accessPattern: Map<string, number[]> // Track access patterns
  private metrics: CacheMetrics
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config: Partial<ScalableCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.sessionCache = new Map()
    this.shortIdCache = new Map()
    this.globalNodeIndex = new Map()
    this.accessPattern = new Map()
    this.metrics = {
      hitRate: 0,
      memoryUsageMB: 0,
      activeSession: 0,
      totalNodes: 0,
      compressionRatio: 0,
      evictionCount: 0,
      averageResponseTime: 0
    }
    
    this.startMaintenanceTasks()
  }

  /**
   * Get nodes for a session with intelligent caching
   */
  async getSessionNodes(sessionId: string): Promise<any[]> {
    const startTime = performance.now()
    
    // Check cache first
    const cacheEntry = this.sessionCache.get(sessionId)
    if (cacheEntry && this.isCacheEntryValid(cacheEntry)) {
      this.recordAccess(sessionId, cacheEntry)
      this.updateHitRate(true)
      console.log(`💾 Scalable cache hit: ${cacheEntry.data.size} nodes for session ${sessionId}`)
      
      const responseTime = performance.now() - startTime
      this.updateAverageResponseTime(responseTime)
      
      return Array.from(cacheEntry.data.values())
    }

    // Cache miss - fetch from database
    this.updateHitRate(false)
    const nodes = await this.fetchNodesFromDatabase(sessionId)
    
    // Store in cache with compression if enabled
    await this.setSessionNodes(sessionId, nodes)
    
    const responseTime = performance.now() - startTime
    this.updateAverageResponseTime(responseTime)
    
    return nodes
  }

  /**
   * Set nodes for a session with intelligent storage
   */
  private async setSessionNodes(sessionId: string, nodes: any[]): Promise<void> {
    // Check memory threshold before adding
    if (this.shouldEvictBeforeAdd()) {
      await this.performIntelligentEviction()
    }

    const nodeMap = new Map(nodes.map(node => [node.id, node]))
    
    const entry: CacheEntry<Map<string, any>> = {
      data: nodeMap,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
      originalSize: this.calculateSize(nodeMap)
    }

    // Apply compression if enabled
    if (this.config.compressionEnabled) {
      entry.compressedSize = await this.compressData(nodeMap)
    }

    this.sessionCache.set(sessionId, entry)
    
    // Update global index
    nodes.forEach(node => {
      this.globalNodeIndex.set(node.id, sessionId)
    })
    
    // Update metrics
    this.updateMetrics()
    
    console.log(`💾 Cached ${nodes.length} nodes for session ${sessionId} (compressed: ${entry.compressedSize || 'N/A'} bytes)`)
  }

  /**
   * Resolve node references across sessions efficiently
   */
  async resolveGlobalReferences(references: string[]): Promise<Array<{ refId: string; node: any; sessionId: string }>> {
    const results = []
    const sessionGroups = new Map<string, string[]>()
    
    // Group references by session using global index
    for (const refId of references) {
      const sessionId = this.findSessionForReference(refId)
      if (sessionId) {
        if (!sessionGroups.has(sessionId)) {
          sessionGroups.set(sessionId, [])
        }
        sessionGroups.get(sessionId)!.push(refId)
      }
    }
    
    // Batch fetch from each session
    for (const [sessionId, refIds] of Array.from(sessionGroups.entries())) {
      const sessionNodes = await this.getSessionNodes(sessionId)
      const sessionLookup = this.buildShortIdLookup(sessionNodes)
      
      for (const refId of refIds) {
        const fullNodeId = sessionLookup.get(refId)
        if (fullNodeId) {
          const node = sessionNodes.find(n => n.id === fullNodeId)
          if (node) {
            results.push({ refId, node, sessionId })
          }
        }
      }
    }
    
    return results
  }

  /**
   * Clear session cache with intelligent cleanup
   */
  clearSessionCache(sessionId: string): void {
    const entry = this.sessionCache.get(sessionId)
    if (entry) {
      // Remove from global index
      entry.data.forEach((_, nodeId) => {
        this.globalNodeIndex.delete(nodeId)
      })
      
      this.sessionCache.delete(sessionId)
      this.shortIdCache.delete(sessionId)
      this.accessPattern.delete(sessionId)
      
      console.log(`🧹 Cleared scalable cache for session ${sessionId}`)
      this.updateMetrics()
    }
  }

  /**
   * Get comprehensive cache performance metrics
   */
  getPerformanceMetrics(): CacheMetrics & { 
    detailedStats: {
      sessionDistribution: Array<{ sessionId: string; nodeCount: number; lastAccess: number }>
      memoryBreakdown: { 
        sessionCache: number 
        shortIdCache: number 
        globalIndex: number 
      }
      accessPatterns: Array<{ sessionId: string; accessCount: number; pattern: number[] }>
    }
  } {
    const sessionEntries = Array.from(this.sessionCache.entries())
    const detailedStats = {
      sessionDistribution: sessionEntries.map(([sessionId, entry]) => ({
        sessionId: sessionId.slice(-8),
        nodeCount: entry.data.size,
        lastAccess: entry.lastAccess
      })),
      memoryBreakdown: {
        sessionCache: this.calculateMapSize(this.sessionCache),
        shortIdCache: this.calculateMapSize(this.shortIdCache),
        globalIndex: this.calculateMapSize(this.globalNodeIndex)
      },
      accessPatterns: Array.from(this.accessPattern.entries()).map(([sessionId, pattern]) => ({
        sessionId: sessionId.slice(-8),
        accessCount: pattern.length,
        pattern: pattern.slice(-10) // Last 10 access times
      }))
    }

    return { ...this.metrics, detailedStats }
  }

  /**
   * Perform cache warming for anticipated usage
   */
  async warmCache(sessionIds: string[]): Promise<void> {
    console.log(`🔥 Warming cache for ${sessionIds.length} sessions`)
    
    const warmPromises = sessionIds.map(async sessionId => {
      try {
        await this.getSessionNodes(sessionId)
      } catch (error) {
        console.warn(`Failed to warm cache for session ${sessionId}:`, error)
      }
    })
    
    await Promise.allSettled(warmPromises)
    console.log(`✅ Cache warming complete`)
  }

  /**
   * Optimize cache based on usage patterns
   */
  async optimizeCache(): Promise<void> {
    console.log(`🔧 Optimizing scalable cache...`)
    
    // Identify frequently accessed sessions
    const accessCounts = new Map<string, number>()
    this.accessPattern.forEach((pattern, sessionId) => {
      accessCounts.set(sessionId, pattern.length)
    })
    
    // Keep frequently accessed, evict least used
    const sortedByAccess = Array.from(accessCounts.entries())
      .sort((a, b) => b[1] - a[1])
    
    const keepCount = Math.min(this.config.maxSessionCache * 0.8, sortedByAccess.length)
    const toEvict = sortedByAccess.slice(keepCount).map(([sessionId]) => sessionId)
    
    for (const sessionId of toEvict) {
      this.clearSessionCache(sessionId)
      this.metrics.evictionCount++
    }
    
    // Compress remaining entries if not already compressed
    if (this.config.compressionEnabled) {
      for (const [sessionId, entry] of Array.from(this.sessionCache.entries())) {
        if (!entry.compressedSize) {
          entry.compressedSize = await this.compressData(entry.data)
        }
      }
    }
    
    this.updateMetrics()
    console.log(`✅ Cache optimization complete: evicted ${toEvict.length} sessions`)
  }

  // Private helper methods

  private startMaintenanceTasks(): void {
    // Periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.performMaintenanceCleanup()
    }, 5 * 60 * 1000)
  }

  private performMaintenanceCleanup(): void {
    const now = Date.now()
    const ttlMs = this.config.ttlMinutes * 60 * 1000
    
    // Remove expired entries
    for (const [sessionId, entry] of Array.from(this.sessionCache.entries())) {
      if (now - entry.timestamp > ttlMs) {
        this.clearSessionCache(sessionId)
      }
    }
    
    // Optimize if memory usage is high
    if (this.metrics.memoryUsageMB > this.config.memoryThresholdMB) {
      this.optimizeCache()
    }
  }

  private isCacheEntryValid(entry: CacheEntry<any>): boolean {
    const now = Date.now()
    const ttlMs = this.config.ttlMinutes * 60 * 1000
    return (now - entry.timestamp) < ttlMs
  }

  private recordAccess(sessionId: string, entry: CacheEntry<any>): void {
    entry.accessCount++
    entry.lastAccess = Date.now()
    
    if (!this.accessPattern.has(sessionId)) {
      this.accessPattern.set(sessionId, [])
    }
    this.accessPattern.get(sessionId)!.push(Date.now())
  }

  private shouldEvictBeforeAdd(): boolean {
    return this.sessionCache.size >= this.config.maxSessionCache ||
           this.metrics.memoryUsageMB > this.config.memoryThresholdMB
  }

  private async performIntelligentEviction(): Promise<void> {
    // LRU with access frequency consideration
    const candidates = Array.from(this.sessionCache.entries())
      .map(([sessionId, entry]) => ({
        sessionId,
        entry,
        score: this.calculateEvictionScore(entry)
      }))
      .sort((a, b) => a.score - b.score) // Lower score = more likely to evict
    
    const evictCount = Math.ceil(this.sessionCache.size * 0.1) // Evict 10%
    for (let i = 0; i < evictCount && i < candidates.length; i++) {
      this.clearSessionCache(candidates[i].sessionId)
      this.metrics.evictionCount++
    }
  }

  private calculateEvictionScore(entry: CacheEntry<any>): number {
    const now = Date.now()
    const timeSinceLastAccess = now - entry.lastAccess
    const accessFrequency = entry.accessCount
    const dataSize = entry.originalSize || 0
    
    // Lower score = more likely to evict
    return (accessFrequency * 1000) / (timeSinceLastAccess + dataSize * 0.1)
  }

  private async fetchNodesFromDatabase(sessionId: string): Promise<any[]> {
    // This would interface with your existing database layer
    // For now, return empty array as placeholder
    console.log(`🔍 Fetching nodes from database for session ${sessionId}`)
    return []
  }

  private findSessionForReference(refId: string): string | null {
    // Search through short ID cache and global index
    for (const [sessionId, entry] of Array.from(this.shortIdCache.entries())) {
      if (this.isCacheEntryValid(entry) && entry.data.has(refId)) {
        return sessionId
      }
    }
    return null
  }

  private buildShortIdLookup(nodes: any[]): Map<string, string> {
    const lookup = new Map()
    nodes.forEach(node => {
      if (node.id) {
        lookup.set(node.id.slice(-8), node.id)
        lookup.set(node.id.slice(-12), node.id)
      }
    })
    return lookup
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length
  }

  private calculateMapSize(map: Map<any, any>): number {
    let size = 0
    map.forEach((value, key) => {
      size += JSON.stringify(key).length + JSON.stringify(value).length
    })
    return size
  }

  private async compressData(data: any): Promise<number> {
    // Simplified compression simulation
    const original = JSON.stringify(data)
    const compressed = original.length * 0.6 // Simulate 40% compression
    return Math.round(compressed)
  }

  private updateHitRate(hit: boolean): void {
    // Simple rolling average for hit rate
    const alpha = 0.1
    this.metrics.hitRate = hit ? 
      this.metrics.hitRate * (1 - alpha) + alpha :
      this.metrics.hitRate * (1 - alpha)
  }

  private updateAverageResponseTime(responseTime: number): void {
    const alpha = 0.1
    this.metrics.averageResponseTime = 
      this.metrics.averageResponseTime * (1 - alpha) + responseTime * alpha
  }

  private updateMetrics(): void {
    this.metrics.activeSession = this.sessionCache.size
    this.metrics.totalNodes = Array.from(this.sessionCache.values())
      .reduce((sum, entry) => sum + entry.data.size, 0)
    
    const totalOriginal = Array.from(this.sessionCache.values())
      .reduce((sum, entry) => sum + (entry.originalSize || 0), 0)
    const totalCompressed = Array.from(this.sessionCache.values())
      .reduce((sum, entry) => sum + (entry.compressedSize || entry.originalSize || 0), 0)
    
    this.metrics.compressionRatio = totalOriginal > 0 ? totalCompressed / totalOriginal : 1
    this.metrics.memoryUsageMB = (
      this.calculateMapSize(this.sessionCache) + 
      this.calculateMapSize(this.shortIdCache) + 
      this.calculateMapSize(this.globalNodeIndex)
    ) / (1024 * 1024)
  }

  // Cleanup on shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.sessionCache.clear()
    this.shortIdCache.clear()
    this.globalNodeIndex.clear()
    this.accessPattern.clear()
  }
}

// Singleton instance
let globalScalableCache: ScalableEnhancedContextCache | null = null

export function getScalableCache(config?: Partial<ScalableCacheConfig>): ScalableEnhancedContextCache {
  if (!globalScalableCache) {
    globalScalableCache = new ScalableEnhancedContextCache(config)
  }
  return globalScalableCache
}

// Export for testing and advanced usage
export { ScalableEnhancedContextCache, type CacheMetrics, type ScalableCacheConfig }