/**
 * Supabase Connection Pool Manager
 * Optimizes database connections by reusing client instances and managing connection lifecycle
 */

import { createClient as createServerClient } from './server'
import { createClient as createBrowserClient } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ConnectionPoolConfig {
  maxConnections: number
  idleTimeout: number // milliseconds
  connectionTimeout: number
  enableMetrics: boolean
}

interface PooledConnection {
  client: SupabaseClient
  createdAt: number
  lastUsed: number
  inUse: boolean
  requestCount: number
}

interface PoolMetrics {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  totalRequests: number
  averageResponseTime: number
  hitRate: number
}

const DEFAULT_CONFIG: ConnectionPoolConfig = {
  maxConnections: 20, // Increased for better performance
  idleTimeout: 300000, // 5 minutes
  connectionTimeout: 10000, // 10 seconds
  enableMetrics: true,
}

class SupabaseConnectionPool {
  private config: ConnectionPoolConfig
  private serverPool: Map<string, PooledConnection> = new Map()
  private browserClient: SupabaseClient | null = null
  private metrics: PoolMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    hitRate: 0,
  }
  private cleanupInterval: NodeJS.Timeout | null = null
  private requestTimes: number[] = []

  constructor(config: Partial<ConnectionPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startMaintenanceTasks()
    
    if (this.config.enableMetrics && process.env.NODE_ENV === 'development') {
      console.log('🏊 Supabase connection pool initialized:', {
        maxConnections: this.config.maxConnections,
        idleTimeout: `${this.config.idleTimeout}ms`,
      })
    }
  }

  /**
   * Get a server-side Supabase client (for API routes)
   */
  async getServerClient(poolKey: string = 'default'): Promise<SupabaseClient> {
    const startTime = performance.now()
    
    try {
      // Check for available connection in pool
      let connection = this.serverPool.get(poolKey)
      
      if (connection && !connection.inUse && this.isConnectionValid(connection)) {
        // Reuse existing connection
        connection.inUse = true
        connection.lastUsed = Date.now()
        connection.requestCount++
        this.updateMetrics(true, performance.now() - startTime)
        
        if (this.config.enableMetrics && process.env.NODE_ENV === 'development') {
          console.log(`♻️ Reusing pooled connection: ${poolKey} (${connection.requestCount} requests)`)
        }
        
        return connection.client
      }
      
      // Create new connection if pool not at capacity
      if (this.serverPool.size < this.config.maxConnections) {
        const client = await createServerClient()
        connection = {
          client,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          inUse: true,
          requestCount: 1,
        }
        
        this.serverPool.set(poolKey, connection)
        this.updateMetrics(false, performance.now() - startTime)
        
        if (this.config.enableMetrics && process.env.NODE_ENV === 'development') {
          console.log(`🆕 Created new pooled connection: ${poolKey} (pool size: ${this.serverPool.size}/${this.config.maxConnections})`)
        }
        
        return client
      }
      
      // Pool at capacity, wait for available connection or create fallback
      console.warn(`⚠️ Connection pool at capacity (${this.config.maxConnections}), creating fallback connection`)
      return await createServerClient() // Fallback to direct creation

    } catch (error) {
      console.error('Failed to get pooled connection:', error)
      return await createServerClient() // Fallback
    }
  }

  /**
   * Get a browser-side Supabase client (singleton)
   */
  getBrowserClient(): SupabaseClient {
    if (!this.browserClient) {
      this.browserClient = createBrowserClient()
      console.log('🌐 Browser client initialized')
    }
    return this.browserClient
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(poolKey: string = 'default'): void {
    const connection = this.serverPool.get(poolKey)
    if (connection) {
      connection.inUse = false
      connection.lastUsed = Date.now()
      
      if (this.config.enableMetrics && process.env.NODE_ENV === 'development') {
        console.log(`🔄 Released connection: ${poolKey}`)
      }
    }
  }

  /**
   * Execute a database operation with automatic connection management
   */
  async withConnection<T>(
    operation: (client: SupabaseClient) => Promise<T>,
    poolKey: string = 'default'
  ): Promise<T> {
    const client = await this.getServerClient(poolKey)
    
    try {
      const result = await operation(client)
      return result
    } finally {
      this.releaseConnection(poolKey)
    }
  }

  /**
   * Get pool performance metrics
   */
  getMetrics(): PoolMetrics {
    this.updatePoolMetrics()
    return { ...this.metrics }
  }

  /**
   * Get detailed pool status
   */
  getPoolStatus(): {
    connections: Array<{
      poolKey: string
      createdAt: number
      lastUsed: number
      inUse: boolean
      requestCount: number
      ageMinutes: number
    }>
    metrics: PoolMetrics
  } {
    const now = Date.now()
    const connections = Array.from(this.serverPool.entries()).map(([poolKey, conn]) => ({
      poolKey,
      createdAt: conn.createdAt,
      lastUsed: conn.lastUsed,
      inUse: conn.inUse,
      requestCount: conn.requestCount,
      ageMinutes: Math.round((now - conn.createdAt) / 60000),
    }))

    return {
      connections,
      metrics: this.getMetrics(),
    }
  }

  /**
   * Warm up the connection pool
   */
  async warmPool(keys: string[] = ['default']): Promise<void> {
    console.log(`🔥 Warming connection pool with ${keys.length} connections`)
    
    const warmPromises = keys.map(async (key) => {
      try {
        const client = await this.getServerClient(key)
        // Test the connection with a simple query
        await client.from('chat_sessions').select('id').limit(1)
        this.releaseConnection(key)
        console.log(`✅ Warmed connection: ${key}`)
      } catch (error) {
        console.error(`❌ Failed to warm connection ${key}:`, error)
      }
    })
    
    await Promise.allSettled(warmPromises)
    console.log('🏁 Connection pool warming complete')
  }

  // Private methods

  private isConnectionValid(connection: PooledConnection): boolean {
    const now = Date.now()
    const age = now - connection.lastUsed
    return age < this.config.idleTimeout
  }

  private startMaintenanceTasks(): void {
    // Cleanup idle connections every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections()
    }, 60000)
  }

  private cleanupIdleConnections(): void {
    const now = Date.now()
    let cleanedCount = 0
    
    const entries = Array.from(this.serverPool.entries())
    for (const [key, connection] of entries) {
      if (!connection.inUse && (now - connection.lastUsed) > this.config.idleTimeout) {
        this.serverPool.delete(key)
        cleanedCount++
      }
    }
    
    if (cleanedCount > 0 && this.config.enableMetrics && process.env.NODE_ENV === 'development') {
      console.log(`🧹 Cleaned up ${cleanedCount} idle connections`)
    }
  }

  private updateMetrics(wasHit: boolean, responseTime: number): void {
    this.metrics.totalRequests++
    
    if (wasHit) {
      this.metrics.hitRate = ((this.metrics.hitRate * (this.metrics.totalRequests - 1)) + 1) / this.metrics.totalRequests
    } else {
      this.metrics.hitRate = (this.metrics.hitRate * (this.metrics.totalRequests - 1)) / this.metrics.totalRequests
    }
    
    // Update average response time (rolling average)
    this.requestTimes.push(responseTime)
    if (this.requestTimes.length > 100) {
      this.requestTimes.shift() // Keep only last 100 measurements
    }
    
    this.metrics.averageResponseTime = 
      this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length
  }

  private updatePoolMetrics(): void {
    this.metrics.totalConnections = this.serverPool.size
    this.metrics.activeConnections = Array.from(this.serverPool.values())
      .filter(conn => conn.inUse).length
    this.metrics.idleConnections = this.metrics.totalConnections - this.metrics.activeConnections
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    
    // Close all pooled connections
    this.serverPool.clear()
    this.browserClient = null
    
    console.log('🛑 Connection pool shutdown complete')
  }
}

// Export singleton instance
let globalConnectionPool: SupabaseConnectionPool | null = null

export function getConnectionPool(config?: Partial<ConnectionPoolConfig>): SupabaseConnectionPool {
  if (!globalConnectionPool) {
    globalConnectionPool = new SupabaseConnectionPool(config)
  }
  return globalConnectionPool
}

// Export convenience functions
export async function getPooledServerClient(poolKey?: string): Promise<SupabaseClient> {
  const pool = getConnectionPool()
  return pool.getServerClient(poolKey)
}

export function getPooledBrowserClient(): SupabaseClient {
  const pool = getConnectionPool()
  return pool.getBrowserClient()
}

export async function withPooledConnection<T>(
  operation: (client: SupabaseClient) => Promise<T>,
  poolKey?: string
): Promise<T> {
  const pool = getConnectionPool()
  return pool.withConnection(operation, poolKey)
}

export function releasePooledConnection(poolKey?: string): void {
  const pool = getConnectionPool()
  pool.releaseConnection(poolKey)
}

// Export types
export type { ConnectionPoolConfig, PoolMetrics }