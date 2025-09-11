import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const testType = searchParams.get('type') || 'all'
  
  const results: any = {
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    tests: []
  }
  
  // Test 1: Capture Message (確実に記録される)
  if (testType === 'all' || testType === 'message') {
    const messageId = Sentry.captureMessage(
      `Production Test Message - ${new Date().toISOString()}`,
      'warning'
    )
    results.tests.push({
      type: 'message',
      level: 'warning',
      eventId: messageId,
      message: 'Test warning message sent'
    })
  }
  
  // Test 2: Capture Error (確実に記録される)
  if (testType === 'all' || testType === 'error') {
    const testError = new Error(`Production Test Error - ${new Date().toISOString()}`)
    testError.name = 'TestError'
    const errorId = Sentry.captureException(testError)
    results.tests.push({
      type: 'error',
      eventId: errorId,
      message: 'Test error sent'
    })
  }
  
  // Test 3: Custom Error with Context (詳細な記録)
  if (testType === 'all' || testType === 'custom') {
    Sentry.withScope((scope) => {
      scope.setLevel('error')
      scope.setTag('test', true)
      scope.setTag('environment', 'production')
      scope.setContext('test_details', {
        timestamp: new Date().toISOString(),
        source: 'api_test',
        url: request.url
      })
      scope.setUser({
        id: 'test-user-production',
        email: 'test@production.com'
      })
      
      const customError = new Error('Production Custom Error with Context')
      const customId = Sentry.captureException(customError)
      results.tests.push({
        type: 'custom_error',
        eventId: customId,
        message: 'Custom error with context sent'
      })
    })
  }
  
  // Test 4: Unhandled Error (最も確実に記録される)
  if (testType === 'throw') {
    // これは意図的にエラーを投げる
    throw new Error(`Production Unhandled Error Test - ${new Date().toISOString()}`)
  }
  
  return NextResponse.json({
    success: true,
    results,
    instructions: {
      checkDashboard: 'Check Sentry Dashboard > Issues',
      filterBy: 'environment:production',
      searchEventIds: 'Copy the eventId and search in Sentry',
      testTypes: {
        message: '/api/debug/sentry-test-error?type=message',
        error: '/api/debug/sentry-test-error?type=error',
        custom: '/api/debug/sentry-test-error?type=custom',
        throw: '/api/debug/sentry-test-error?type=throw (will show 500 error)',
        all: '/api/debug/sentry-test-error (default - sends all except throw)'
      }
    }
  })
}