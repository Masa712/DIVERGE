import { NextRequest, NextResponse } from 'next/server'
import { getErrorMetrics, getErrorTrends } from '@/lib/errors/error-monitoring'
import { 
  withErrorHandler, 
  createAppError, 
  ErrorCategory 
} from '@/lib/errors/error-handler'

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const includeTrends = searchParams.get('includeTrends') === 'true'
  const trendRange = parseInt(searchParams.get('trendRange') || '3600000') // 1 hour default
  
  // Validate trend range
  if (trendRange < 60000 || trendRange > 86400000) { // 1 minute to 24 hours
    throw createAppError(
      'Invalid trend range specified',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Trend range must be between 1 minute and 24 hours.',
        context: { trendRange }
      }
    )
  }
  
  // Get current error metrics
  const metrics = getErrorMetrics()
  
  let trends = null
  if (includeTrends) {
    trends = getErrorTrends(trendRange)
  }
  
  const response = {
    success: true,
    data: {
      metrics,
      ...(trends && { trends }),
      timestamp: new Date().toISOString()
    }
  }
  
  // Set appropriate cache headers
  const headers: Record<string, string> = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
  
  // Add warning header if system is degraded
  if (metrics.systemHealth.status !== 'healthy') {
    headers['X-System-Health'] = metrics.systemHealth.status
  }
  
  return NextResponse.json(response, { headers })
})

// POST endpoint for manual error reporting/testing
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json()
  const { errorType, testMessage, simulate } = body
  
  if (!simulate) {
    throw createAppError(
      'Manual error reporting not implemented',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'This endpoint is for testing purposes only.'
      }
    )
  }
  
  // Simulate different error types for testing
  switch (errorType) {
    case 'critical':
      throw createAppError(
        testMessage || 'Simulated critical error',
        ErrorCategory.INTERNAL,
        { 
          severity: 'critical' as any,
          userMessage: 'A critical system error has been simulated.'
        }
      )
      
    case 'database':
      throw createAppError(
        testMessage || 'Simulated database error',
        ErrorCategory.DATABASE,
        {
          userMessage: 'A database error has been simulated.'
        }
      )
      
    case 'validation':
      throw createAppError(
        testMessage || 'Simulated validation error',
        ErrorCategory.VALIDATION,
        {
          userMessage: 'A validation error has been simulated.'
        }
      )
      
    default:
      throw createAppError(
        'Unknown error type for simulation',
        ErrorCategory.VALIDATION,
        {
          userMessage: 'Please specify a valid error type: critical, database, or validation.'
        }
      )
  }
})