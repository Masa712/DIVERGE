import { NextRequest, NextResponse } from 'next/server'
import { testRedisConnection, getRedisHealth, isRedisAvailable } from '@/lib/redis/client'
import { getRedisEnhancedContextCache } from '@/lib/db/redis-enhanced-context-cache'

export async function GET(request: NextRequest) {
  try {
    // Test basic Redis connection
    const connectionTest = await testRedisConnection()
    
    // Get Redis health metrics
    const health = await getRedisHealth()
    
    // Get cache statistics
    const cache = getRedisEnhancedContextCache()
    const cacheStats = await cache.getCacheStats()
    
    const status = {
      redis: {
        available: await isRedisAvailable(),
        connected: connectionTest,
        health,
      },
      cache: cacheStats,
      timestamp: new Date().toISOString(),
    }
    
    // Return appropriate status code based on Redis availability
    const statusCode = status.redis.available ? 200 : 503
    
    return NextResponse.json(status, { status: statusCode })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json(
      {
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}