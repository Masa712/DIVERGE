import { NextRequest, NextResponse } from 'next/server'
import { getConnectionPool } from '@/lib/supabase/connection-pool'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const pool = getConnectionPool()
    const poolStatus = pool.getPoolStatus()
    
    // Test database connectivity
    let dbConnected = false
    let dbLatency = -1
    
    try {
      const startTime = performance.now()
      await pool.withConnection(async (client) => {
        await client.from('chat_sessions').select('id').limit(1)
      })
      dbLatency = performance.now() - startTime
      dbConnected = true
    } catch (error) {
      console.error('Database connectivity test failed:', error)
    }
    
    const status = {
      database: {
        connected: dbConnected,
        latency: Math.round(dbLatency),
      },
      connectionPool: {
        ...poolStatus.metrics,
        connections: poolStatus.connections.length,
        details: poolStatus.connections,
      },
      timestamp: new Date().toISOString(),
    }
    
    // Return appropriate status code
    const statusCode = dbConnected ? 200 : 503
    
    return NextResponse.json(status, { status: statusCode })
  } catch (error) {
    console.error('Supabase health check failed:', error)
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