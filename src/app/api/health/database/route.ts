import { NextRequest, NextResponse } from 'next/server'
import { getConnectionPool } from '@/lib/supabase/connection-pool'
import { getQueryPerformanceStats, INDEX_SUGGESTIONS } from '@/lib/db/query-optimizer'
import {
  withErrorHandler,
  createAppError,
  ErrorCategory
} from '@/lib/errors/error-handler'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const includeIndexSuggestions = searchParams.get('includeIndexSuggestions') === 'true'
  const includePoolStats = searchParams.get('includePoolStats') === 'true'
  
  // Get query performance statistics
  const queryStats = getQueryPerformanceStats()
  
  // Get connection pool statistics if requested
  let poolStats = null
  if (includePoolStats) {
    try {
      const pool = getConnectionPool()
      const poolStatus = pool.getPoolStatus()
      poolStats = {
        totalConnections: poolStatus.connections.length,
        activeConnections: poolStatus.connections.filter(c => c.inUse).length,
        metrics: poolStatus.metrics,
        connectionDetails: poolStatus.connections.map(conn => ({
          poolKey: conn.poolKey,
          ageMinutes: conn.ageMinutes,
          requestCount: conn.requestCount,
          inUse: conn.inUse
        }))
      }
    } catch (error) {
      console.warn('Failed to get pool statistics:', error)
    }
  }
  
  // Test database connectivity with performance measurement
  let dbLatency = -1
  let dbConnected = false
  
  try {
    const startTime = performance.now()
    const pool = getConnectionPool()
    await pool.withConnection(async (client) => {
      await client.from('sessions').select('id').limit(1)
    })
    dbLatency = Math.round(performance.now() - startTime)
    dbConnected = true
  } catch (error) {
    console.warn('Database connectivity test failed:', error)
  }
  
  // Calculate database health score
  const calculateHealthScore = () => {
    let score = 100
    
    // Deduct points for slow queries
    if (queryStats.slowQueries.length > 0) {
      score -= queryStats.slowQueries.length * 10
    }
    
    // Deduct points for low cache hit rate
    if (queryStats.cacheHitRate < 50) {
      score -= (50 - queryStats.cacheHitRate) * 0.5
    }
    
    // Deduct points for high average execution time
    if (queryStats.averageExecutionTime > 100) {
      score -= (queryStats.averageExecutionTime - 100) * 0.1
    }
    
    // Deduct points for high database latency
    if (dbLatency > 200) {
      score -= (dbLatency - 200) * 0.05
    }
    
    return Math.max(0, Math.round(score))
  }
  
  const healthScore = calculateHealthScore()
  const healthStatus = healthScore >= 80 ? 'excellent' : 
                      healthScore >= 60 ? 'good' : 
                      healthScore >= 40 ? 'fair' : 'poor'
  
  const response = {
    success: true,
    data: {
      database: {
        connected: dbConnected,
        latency: dbLatency,
        health: {
          score: healthScore,
          status: healthStatus,
          lastUpdate: new Date().toISOString()
        }
      },
      queryPerformance: {
        totalQueries: queryStats.totalQueries,
        averageExecutionTime: Math.round(queryStats.averageExecutionTime * 100) / 100,
        cacheHitRate: Math.round(queryStats.cacheHitRate * 100) / 100,
        slowQueriesCount: queryStats.slowQueries.length,
        cacheSize: queryStats.cacheSize,
        ...(queryStats.slowQueries.length > 0 && {
          slowQueries: queryStats.slowQueries.slice(0, 5).map(q => ({
            queryId: q.queryId,
            executionTime: Math.round(q.executionTime * 100) / 100,
            resultCount: q.resultCount,
            timestamp: q.timestamp
          }))
        })
      },
      ...(poolStats && { connectionPool: poolStats }),
      ...(includeIndexSuggestions && {
        indexSuggestions: {
          description: 'Recommended database indexes for optimal performance',
          suggestions: INDEX_SUGGESTIONS
        }
      }),
      timestamp: new Date().toISOString()
    }
  }
  
  // Set appropriate headers based on health status
  const headers: Record<string, string> = {
    'X-Database-Health': healthStatus,
    'X-Cache-Hit-Rate': queryStats.cacheHitRate.toFixed(2),
    'X-Query-Count': queryStats.totalQueries.toString()
  }
  
  // Add warning header if performance is degraded
  if (healthScore < 60) {
    headers['X-Performance-Warning'] = 'Database performance is below optimal levels'
  }
  
  return NextResponse.json(response, { headers })
})

// POST endpoint for performance testing
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json()
  const { action, queryCount = 5 } = body
  
  if (action !== 'performanceTest') {
    throw createAppError(
      'Invalid action specified',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Only "performanceTest" action is supported.',
        context: { providedAction: action }
      }
    )
  }
  
  if (queryCount < 1 || queryCount > 20) {
    throw createAppError(
      'Invalid query count',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Query count must be between 1 and 20.',
        context: { queryCount }
      }
    )
  }
  
  // Run performance test
  const testResults = []
  const pool = getConnectionPool()
  
  for (let i = 0; i < queryCount; i++) {
    const startTime = performance.now()
    
    try {
      await pool.withConnection(async (client) => {
        // Test various query types
        const queries = [
          () => client.from('sessions').select('id, name').limit(5),
          () => client.from('chat_nodes').select('id, prompt').limit(10),
          () => client.from('sessions').select('*', { count: 'exact', head: true }).limit(1)
        ]
        
        const randomQuery = queries[Math.floor(Math.random() * queries.length)]
        await randomQuery()
      })
      
      const executionTime = performance.now() - startTime
      testResults.push({
        queryIndex: i + 1,
        executionTime: Math.round(executionTime * 100) / 100,
        status: 'success'
      })
      
    } catch (error) {
      const executionTime = performance.now() - startTime
      testResults.push({
        queryIndex: i + 1,
        executionTime: Math.round(executionTime * 100) / 100,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  
  const successfulQueries = testResults.filter(r => r.status === 'success')
  const averageTime = successfulQueries.length > 0 
    ? successfulQueries.reduce((sum, r) => sum + r.executionTime, 0) / successfulQueries.length
    : 0
  
  return NextResponse.json({
    success: true,
    data: {
      testSummary: {
        totalQueries: queryCount,
        successfulQueries: successfulQueries.length,
        failedQueries: testResults.length - successfulQueries.length,
        averageExecutionTime: Math.round(averageTime * 100) / 100,
        timestamp: new Date().toISOString()
      },
      results: testResults
    }
  })
})