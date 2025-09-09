import { NextRequest, NextResponse } from 'next/server'
import { reportError, reportMessage } from '@/lib/utils/error-reporting'

export async function GET(request: NextRequest) {
  try {
    // Add a breadcrumb for the API call
    reportMessage('Sentry test API called', 'info', {
      feature: 'sentry-test-api',
      additionalData: {
        method: 'GET',
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      }
    })

    // Simulate potential server error (20% chance)
    if (Math.random() < 0.2) {
      throw new Error('Random server error for Sentry testing')
    }

    return NextResponse.json({
      success: true,
      message: 'Sentry server test completed successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    // Report the error to Sentry
    reportError(error as Error, {
      feature: 'sentry-test-api',
      url: request.url,
      userAgent: request.headers.get('user-agent') || undefined,
      additionalData: {
        method: 'GET',
        timestamp: new Date().toISOString()
      }
    })

    return NextResponse.json(
      {
        success: false,
        message: 'Server error occurred during Sentry test',
        error: (error as Error).message
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    reportMessage('Sentry test API POST called', 'info', {
      feature: 'sentry-test-api',
      additionalData: {
        method: 'POST',
        bodyKeys: Object.keys(body),
        timestamp: new Date().toISOString()
      }
    })

    // Force an error if requested
    if (body.forceError) {
      throw new Error('Forced server error for Sentry testing')
    }

    return NextResponse.json({
      success: true,
      message: 'POST test completed',
      receivedData: body
    })

  } catch (error) {
    reportError(error as Error, {
      feature: 'sentry-test-api',
      url: request.url,
      userAgent: request.headers.get('user-agent') || undefined,
      additionalData: {
        method: 'POST',
        timestamp: new Date().toISOString()
      }
    })

    return NextResponse.json(
      {
        success: false,
        message: 'POST test failed',
        error: (error as Error).message
      },
      { status: 500 }
    )
  }
}