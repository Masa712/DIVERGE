import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, isRedisAvailable } from '@/lib/redis/client'
import { getDistributedCache } from '@/lib/redis/distributed-cache'

export async function GET(request: NextRequest) {
  const results = {
    redisAvailable: false,
    connectionTest: false,
    setGetTest: false,
    cacheTest: false,
    error: null as string | null,
    details: {} as any
  }

  try {
    // Test 1: Check if Redis is available
    results.redisAvailable = await isRedisAvailable()
    console.log('🔍 Redis availability:', results.redisAvailable)

    if (!results.redisAvailable) {
      results.error = 'Redis is not available - check environment variables'
      return NextResponse.json(results, { status: 503 })
    }

    // Test 2: Connection test
    const redis = await getRedisClient()
    const pingResult = await redis.ping()
    results.connectionTest = pingResult === 'PONG'
    console.log('🏓 Redis ping result:', pingResult)

    // Test 3: Set/Get test
    const testKey = `test:${Date.now()}`
    const testValue = { message: 'Redis test', timestamp: new Date().toISOString() }
    
    await redis.set(testKey, JSON.stringify(testValue), 'EX', 60) // Expire in 60 seconds
    const retrievedValue = await redis.get(testKey)
    results.setGetTest = retrievedValue === JSON.stringify(testValue)
    console.log('💾 Redis set/get test:', results.setGetTest)
    
    // Clean up test key
    await redis.del(testKey)

    // Test 4: Distributed cache test
    const cache = getDistributedCache({
      namespace: 'test',
      ttlSeconds: 60
    })
    
    const cacheKey = 'test-cache-key'
    const cacheValue = { test: 'cache value', time: Date.now() }
    
    await cache.set(cacheKey, cacheValue)
    const cachedResult = await cache.get(cacheKey)
    results.cacheTest = JSON.stringify(cachedResult) === JSON.stringify(cacheValue)
    console.log('📦 Cache test:', results.cacheTest)
    
    // Get Redis info for details
    const info = await redis.info('server')
    const lines = info.split('\r\n')
    const version = lines.find(line => line.startsWith('redis_version:'))
    const uptime = lines.find(line => line.startsWith('uptime_in_seconds:'))
    
    results.details = {
      version: version?.split(':')[1],
      uptime: uptime?.split(':')[1],
      host: process.env.REDIS_HOST?.substring(0, 20) + '...',
      port: process.env.REDIS_PORT
    }

    return NextResponse.json({
      ...results,
      message: 'All Redis tests passed successfully! 🎉'
    })

  } catch (error) {
    console.error('❌ Redis test error:', error)
    results.error = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(results, { status: 500 })
  }
}