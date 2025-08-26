/**
 * Redis client configuration and initialization
 * Provides singleton Redis instance for distributed caching
 */

import Redis, { RedisOptions } from 'ioredis'
// @ts-ignore - Redlock types issue with ESM
import Redlock from 'redlock'

// Redis configuration from environment variables
const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    console.log(`Redis retry attempt ${times}, waiting ${delay}ms...`)
    return delay
  },
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
  // Connection pooling
  enableReadyCheck: true,
  connectTimeout: 10000,
  disconnectTimeout: 2000,
  commandTimeout: 5000,
  // Performance optimizations
  keepAlive: 10000,
  noDelay: true,
  // Clustering support (future)
  family: 4, // IPv4
}

// Singleton Redis client instance
let redisClient: Redis | null = null
let redlockClient: Redlock | null = null

/**
 * Get or create Redis client instance
 */
export async function getRedisClient(): Promise<Redis> {
  if (!redisClient) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔴 Initializing Redis client...')
    }
    redisClient = new Redis(redisConfig)
    
    // Event handlers
    redisClient.on('connect', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Redis connected successfully')
      }
    })
    
    redisClient.on('error', (error) => {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Redis error:', error)
      }
      // Don't throw - allow graceful degradation
    })
    
    redisClient.on('ready', () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('🟢 Redis ready for commands')
      }
    })
    
    redisClient.on('reconnecting', (delay: number) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Redis reconnecting in ${delay}ms...`)
      }
    })
    
    // Connect if lazy connect is enabled
    if (redisConfig.lazyConnect) {
      await redisClient.connect()
    }
  }
  
  return redisClient
}

/**
 * Get or create Redlock instance for distributed locking
 */
export async function getRedlock(): Promise<Redlock> {
  if (!redlockClient) {
    const redis = await getRedisClient()
    
    redlockClient = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 10,
      retryDelay: 200,
      retryJitter: 200,
      automaticExtensionThreshold: 500,
    })
    
    redlockClient.on('error', (error: any) => {
      console.error('Redlock error:', error)
    })
  }
  
  return redlockClient
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    const redis = await getRedisClient()
    const pong = await redis.ping()
    console.log('🏓 Redis ping:', pong)
    return pong === 'PONG'
  } catch (error) {
    console.error('Failed to ping Redis:', error)
    return false
  }
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    redlockClient = null
    console.log('🔴 Redis connection closed')
  }
}

/**
 * Check if Redis is available (async version for proper initialization)
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const redis = await getRedisClient()
    return redis.status === 'ready'
  } catch (error) {
    console.warn('Redis not available:', error)
    return false
  }
}

/**
 * Check if Redis is available (sync version for compatibility)
 */
export function isRedisAvailableSync(): boolean {
  return redisClient?.status === 'ready'
}

/**
 * Redis health check for monitoring
 */
export async function getRedisHealth(): Promise<{
  connected: boolean
  latency: number
  memory: string
  clients: number
}> {
  try {
    const redis = await getRedisClient()
    const start = Date.now()
    await redis.ping()
    const latency = Date.now() - start
    
    const info = await redis.info('memory')
    const clientInfo = await redis.info('clients')
    
    const memoryMatch = info.match(/used_memory_human:(\S+)/)
    const clientsMatch = clientInfo.match(/connected_clients:(\d+)/)
    
    return {
      connected: true,
      latency,
      memory: memoryMatch?.[1] || 'unknown',
      clients: parseInt(clientsMatch?.[1] || '0'),
    }
  } catch (error) {
    return {
      connected: false,
      latency: -1,
      memory: '0',
      clients: 0,
    }
  }
}

// Export types
export type { Redis, RedisOptions }
export { Redlock }