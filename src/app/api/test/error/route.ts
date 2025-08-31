import { NextRequest, NextResponse } from 'next/server'
import { log } from '@/lib/utils/logger'
import { createAppError, ErrorCategory, withErrorHandler } from '@/lib/errors/error-handler'

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const testType = searchParams.get('type') || 'all'
  
  const results = {
    loggerTest: false,
    errorHandlerTest: false,
    vercelLogsUrl: 'Check Vercel Dashboard > Functions > Logs',
    tests: [] as any[]
  }
  
  try {
    // Test 1: Logger functions
    if (testType === 'all' || testType === 'logger') {
      log.debug('Debug log test', { timestamp: new Date().toISOString() })
      log.info('Info log test', { feature: 'error-testing' })
      log.warn('Warning log test', { warning: 'This is a test warning' })
      log.error('Error log test', new Error('Test error for logging'))
      
      results.loggerTest = true
      results.tests.push({
        name: 'Logger Test',
        status: 'success',
        message: 'All log levels tested'
      })
      
      console.log('📝 Logger test completed - check Vercel logs')
    }
    
    // Test 2: Error handler with different categories
    if (testType === 'all' || testType === 'error') {
      const errorTypes = [
        { 
          category: ErrorCategory.VALIDATION, 
          message: 'Test validation error',
          userMessage: 'This is a user-friendly validation message'
        },
        { 
          category: ErrorCategory.DATABASE, 
          message: 'Test database error',
          context: { query: 'SELECT * FROM test', table: 'sessions' }
        },
        { 
          category: ErrorCategory.AUTHENTICATION, 
          message: 'Test auth error',
          context: { userId: 'test-user-123' }
        }
      ]
      
      for (const errorType of errorTypes) {
        try {
          throw createAppError(
            errorType.message,
            errorType.category,
            { 
              userMessage: errorType.userMessage,
              context: errorType.context 
            }
          )
        } catch (error) {
          log.error(`Testing ${errorType.category} error`, error)
          results.tests.push({
            name: `${errorType.category} Error`,
            status: 'tested',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      results.errorHandlerTest = true
      console.log('🚨 Error handler test completed - check Vercel logs')
    }
    
    // Test 3: Trigger a real error for withErrorHandler
    if (testType === 'throw') {
      throw createAppError(
        'Intentional test error to verify error handling',
        ErrorCategory.INTERNAL,
        {
          userMessage: 'This error was triggered intentionally for testing',
          context: {
            testType: 'throw',
            timestamp: new Date().toISOString()
          }
        }
      )
    }
    
    return NextResponse.json({
      success: true,
      ...results,
      message: 'Error logging tests completed. Check Vercel Dashboard logs.',
      instructions: {
        vercel: 'Go to Vercel Dashboard > Your Project > Functions tab > Logs',
        testTypes: {
          all: 'Test all logging features',
          logger: 'Test only logger functions',
          error: 'Test error handler categories',
          throw: 'Throw a real error (returns 500)'
        }
      }
    })
    
  } catch (error) {
    // This will be caught by withErrorHandler
    throw error
  }
})

// Test POST endpoint to simulate different error scenarios
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json()
  
  if (body.triggerError) {
    throw createAppError(
      'POST endpoint test error',
      ErrorCategory.VALIDATION,
      {
        userMessage: 'Test error from POST endpoint',
        context: { body }
      }
    )
  }
  
  log.info('POST test successful', { body })
  
  return NextResponse.json({
    success: true,
    message: 'POST test completed',
    receivedData: body
  })
})