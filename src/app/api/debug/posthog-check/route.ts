import { NextResponse } from 'next/server'

export async function GET() {
  // Dynamically import server-side PostHog to avoid client-side bundling
  const { getPostHogClient } = await import('@/lib/posthog/server')
  // Check various PostHog configurations
  const checks: any = {
    keyConfigured: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
    keyValue: process.env.NEXT_PUBLIC_POSTHOG_KEY ? 'Set (hidden for security)' : 'Not set',
    hostConfigured: !!process.env.NEXT_PUBLIC_POSTHOG_HOST,
    hostValue: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'Not set',
    environment: process.env.NODE_ENV,
    
    // Test server client initialization
    serverClientInitialized: false,
    
    // Additional debug info
    debug: {
      nodeVersion: process.version,
      nextVersion: require('next/package.json').version,
    }
  }

  // Try to initialize server client
  try {
    const client = getPostHogClient()
    checks.serverClientInitialized = !!client
    
    if (client) {
      // Try to send a test event
      client.capture({
        distinctId: 'debug-test-user',
        event: 'posthog_check_endpoint_test',
        properties: {
          source: 'api_endpoint',
          timestamp: new Date().toISOString()
        }
      })
      
      // Flush immediately for testing
      await client.flush()
      checks.testEventSent = true
    } else {
      checks.testEventSent = false
    }
  } catch (error) {
    checks.serverClientInitialized = false
    checks.testEventSent = false
    checks.error = error instanceof Error ? error.message : 'Unknown error'
  }
  
  return NextResponse.json({
    success: true,
    checks,
    timestamp: new Date().toISOString()
  })
}