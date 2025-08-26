/**
 * Distributed cache implementation using Redis
 * Extends the existing scalable cache with Redis backend
 */

import { getRedisClient, getRedlock, isRedisAvailableSync, type Redis } from './client'
// @ts-ignore - Redlock types issue with ESM
import type { Redlock, Lock } from 'redlock'

interface DistributedCacheEntry<T = any> {
  data: T
  timestamp: number
  accessCount: number
  lastAccess: number
  originalSize?: number
  compressedSize?: number
  version: number
}

interface DistributedCacheConfig {
  namespace: string
  ttlSeconds: number
  compressionEnabled: boolean
  localCacheTTL: number // Seconds to cache in memory before checking Redis
  maxLocalCacheSize: number
  enablePubSub: boolean
}

const DEFAULT_CONFIG: DistributedCacheConfig = {
  namespace: 'diverge',
  ttlSeconds: 900, // 15 minutes
  compressionEnabled: true,
  localCacheTTL: 10, // 10 seconds local cache
  maxLocalCacheSize: 100,
  enablePubSub: true,
}

export class DistributedCache {
  private config: DistributedCacheConfig
  private redis: Redis | null = null
  private redlock: Redlock | null = null
  private localCache: Map<string, { data: any; expires: number }> = new Map()
  private pubSubClient: Redis | null = null
  private subClient: Redis | null = null
  private instanceId: string
  private subscriptions: Map<string, Set<(data: any) => void>> = new Map()

  constructor(config: Partial<DistributedCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.instanceId = `instance_${Date.now()}_${Math.random().toString(36).substring(7)}`
    this.initializeRedis()
  }

  private async initializeRedis() {
    try {
      this.redis = await getRedisClient()
      this.redlock = await getRedlock()
      
      if (this.config.enablePubSub) {
        await this.setupPubSub()
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 Distributed cache initialized for ${this.instanceId}`)
      }
    } catch (error) {
      console.error('Failed to initialize distributed cache:', error)
      // Fall back to local cache only
    }
  }

  private async setupPubSub() {
    const { default: Redis } = await import('ioredis')
    
    // Create separate clients for pub/sub
    this.pubSubClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    })
    
    this.subClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    })
    
    // Subscribe to invalidation events
    this.subClient.on('message', (channel, message) => {
      this.handleInvalidationMessage(channel, message)
    })
    
    await this.subClient.subscribe(`${this.config.namespace}:invalidate`)
    console.log('📡 PubSub enabled for cache invalidation')
  }

  private handleInvalidationMessage(channel: string, message: string) {
    try {
      const { key, instanceId } = JSON.parse(message)
      
      // Don't invalidate if it's from this instance
      if (instanceId === this.instanceId) return
      
      // Clear local cache for this key
      const localKey = this.getLocalKey(key)
      if (this.localCache.has(localKey)) {
        this.localCache.delete(localKey)
        console.log(`🔄 Local cache invalidated for ${key} from ${instanceId}`)
      }
      
      // Notify subscribers
      const callbacks = this.subscriptions.get(key)
      if (callbacks) {
        callbacks.forEach(callback => callback(null))
      }
    } catch (error) {
      console.error('Failed to handle invalidation message:', error)
    }
  }

  /**
   * Get value from distributed cache with local caching
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key)
    const localKey = this.getLocalKey(key)
    
    // Check local cache first
    const local = this.localCache.get(localKey)
    if (local && local.expires > Date.now()) {
      console.log(`💾 Local cache hit: ${key}`)
      return local.data
    }
    
    // Fall back to Redis if available
    if (!this.redis || !isRedisAvailableSync()) {
      console.log('Redis not available, using local cache only')
      return null
    }
    
    try {
      const data = await this.redis.get(fullKey)
      if (data) {
        const entry: DistributedCacheEntry<T> = JSON.parse(data)
        
        // Update access count and last access
        entry.accessCount++
        entry.lastAccess = Date.now()
        
        // Update in Redis (fire and forget)
        this.redis.setex(
          fullKey,
          this.config.ttlSeconds,
          JSON.stringify(entry)
        ).catch(err => console.error('Failed to update access info:', err))
        
        // Store in local cache
        this.setLocalCache(localKey, entry.data)
        
        console.log(`🔴 Redis cache hit: ${key}`)
        return entry.data
      }
    } catch (error) {
      console.error(`Failed to get from Redis: ${key}`, error)
    }
    
    return null
  }

  /**
   * Set value in distributed cache with automatic invalidation
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<boolean> {
    const fullKey = this.getFullKey(key)
    const localKey = this.getLocalKey(key)
    
    // Always set in local cache
    this.setLocalCache(localKey, value)
    
    if (!this.redis || !isRedisAvailableSync()) {
      console.log('Redis not available, using local cache only')
      return true
    }
    
    try {
      const entry: DistributedCacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccess: Date.now(),
        originalSize: JSON.stringify(value).length,
        version: 1,
      }
      
      if (this.config.compressionEnabled) {
        // Simulate compression (in production, use actual compression)
        entry.compressedSize = Math.round((entry.originalSize || 0) * 0.6)
      }
      
      const ttlSeconds = ttl || this.config.ttlSeconds
      await this.redis.setex(fullKey, ttlSeconds, JSON.stringify(entry))
      
      // Broadcast invalidation to other instances
      if (this.config.enablePubSub && this.pubSubClient) {
        await this.pubSubClient.publish(
          `${this.config.namespace}:invalidate`,
          JSON.stringify({ key, instanceId: this.instanceId })
        )
      }
      
      console.log(`✅ Set in distributed cache: ${key} (TTL: ${ttlSeconds}s)`)
      return true
    } catch (error) {
      console.error(`Failed to set in Redis: ${key}`, error)
      return false
    }
  }

  /**
   * Delete from distributed cache with invalidation
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key)
    const localKey = this.getLocalKey(key)
    
    // Delete from local cache
    this.localCache.delete(localKey)
    
    if (!this.redis || !isRedisAvailableSync()) {
      return true
    }
    
    try {
      await this.redis.del(fullKey)
      
      // Broadcast invalidation
      if (this.config.enablePubSub && this.pubSubClient) {
        await this.pubSubClient.publish(
          `${this.config.namespace}:invalidate`,
          JSON.stringify({ key, instanceId: this.instanceId })
        )
      }
      
      console.log(`🗑️ Deleted from distributed cache: ${key}`)
      return true
    } catch (error) {
      console.error(`Failed to delete from Redis: ${key}`, error)
      return false
    }
  }

  /**
   * Clear all cache entries with pattern
   */
  async clear(pattern?: string): Promise<number> {
    const searchPattern = pattern 
      ? `${this.config.namespace}:${pattern}*`
      : `${this.config.namespace}:*`
    
    // Clear local cache
    if (pattern) {
      const keys = Array.from(this.localCache.keys())
      for (const key of keys) {
        if (key.includes(pattern)) {
          this.localCache.delete(key)
        }
      }
    } else {
      this.localCache.clear()
    }
    
    if (!this.redis || !isRedisAvailableSync()) {
      return 0
    }
    
    try {
      const keys = await this.redis.keys(searchPattern)
      if (keys.length > 0) {
        await this.redis.del(...keys)
        
        // Broadcast invalidation for all keys
        if (this.config.enablePubSub && this.pubSubClient) {
          for (const key of keys) {
            const shortKey = key.replace(`${this.config.namespace}:`, '')
            await this.pubSubClient.publish(
              `${this.config.namespace}:invalidate`,
              JSON.stringify({ key: shortKey, instanceId: this.instanceId })
            )
          }
        }
      }
      
      console.log(`🧹 Cleared ${keys.length} entries from distributed cache`)
      return keys.length
    } catch (error) {
      console.error('Failed to clear cache:', error)
      return 0
    }
  }

  /**
   * Acquire distributed lock for atomic operations
   */
  async acquireLock(resource: string, ttl: number = 5000): Promise<Lock | null> {
    if (!this.redlock) {
      console.warn('Redlock not available')
      return null
    }
    
    try {
      const lock = await this.redlock.acquire([`lock:${resource}`], ttl)
      console.log(`🔒 Acquired lock for ${resource}`)
      return lock
    } catch (error) {
      console.error(`Failed to acquire lock for ${resource}:`, error)
      return null
    }
  }

  /**
   * Execute function with distributed lock
   */
  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    ttl: number = 5000
  ): Promise<T | null> {
    const lock = await this.acquireLock(resource, ttl)
    if (!lock) {
      console.warn(`Could not acquire lock for ${resource}, skipping operation`)
      return null
    }
    
    try {
      const result = await fn()
      return result
    } finally {
      await lock.release()
      console.log(`🔓 Released lock for ${resource}`)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    localCacheSize: number
    redisConnected: boolean
    keyCount: number
    memoryUsage: string
  }> {
    const stats = {
      localCacheSize: this.localCache.size,
      redisConnected: isRedisAvailableSync(),
      keyCount: 0,
      memoryUsage: 'N/A',
    }
    
    if (this.redis && stats.redisConnected) {
      try {
        const keys = await this.redis.keys(`${this.config.namespace}:*`)
        stats.keyCount = keys.length
        
        const info = await this.redis.info('memory')
        const match = info.match(/used_memory_human:(\S+)/)
        if (match) {
          stats.memoryUsage = match[1]
        }
      } catch (error) {
        console.error('Failed to get Redis stats:', error)
      }
    }
    
    return stats
  }

  /**
   * Subscribe to cache changes
   */
  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set())
    }
    
    this.subscriptions.get(key)!.add(callback)
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(key)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          this.subscriptions.delete(key)
        }
      }
    }
  }

  // Helper methods
  
  private getFullKey(key: string): string {
    return `${this.config.namespace}:${key}`
  }
  
  private getLocalKey(key: string): string {
    return `local:${key}`
  }
  
  private setLocalCache(key: string, value: any): void {
    // Enforce max local cache size
    if (this.localCache.size >= this.config.maxLocalCacheSize) {
      const firstKey = Array.from(this.localCache.keys())[0]
      if (firstKey) {
        this.localCache.delete(firstKey)
      }
    }
    
    this.localCache.set(key, {
      data: value,
      expires: Date.now() + (this.config.localCacheTTL * 1000),
    })
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.subClient) {
      await this.subClient.unsubscribe()
      this.subClient.disconnect()
    }
    
    if (this.pubSubClient) {
      this.pubSubClient.disconnect()
    }
    
    this.localCache.clear()
    this.subscriptions.clear()
    
    console.log(`💀 Distributed cache destroyed for ${this.instanceId}`)
  }
}

// Export singleton instance
let globalDistributedCache: DistributedCache | null = null

export function getDistributedCache(config?: Partial<DistributedCacheConfig>): DistributedCache {
  if (!globalDistributedCache) {
    globalDistributedCache = new DistributedCache(config)
  }
  return globalDistributedCache
}

export type { DistributedCacheConfig, DistributedCacheEntry }