import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function GET() {
  // Use Sentry v8 API
  const client = Sentry.getClient()
  
  // Check various Sentry configurations
  const checks: any = {
    dsnConfigured: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    dsnValue: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'Set (hidden for security)' : 'Not set',
    sentryInitialized: !!client,
    sentryDsn: client?.getOptions()?.dsn || 'Not available',
    environment: process.env.NODE_ENV,
    org: process.env.SENTRY_ORG || 'Not set',
    project: process.env.SENTRY_PROJECT || 'Not set',
    authToken: process.env.SENTRY_AUTH_TOKEN ? 'Set' : 'Not set',
    
    // Test if we can send events
    canSendEvents: client ? 'Yes' : 'No',
    
    // Additional debug info
    debug: {
      nodeVersion: process.version,
      nextVersion: require('next/package.json').version,
      sentryVersion: require('@sentry/nextjs/package.json').version,
    }
  }
  
  // Try to send a test message
  if (client) {
    Sentry.captureMessage('Sentry check endpoint test message', 'info')
    checks.testMessageSent = true
  } else {
    checks.testMessageSent = false
  }
  
  return NextResponse.json({
    success: true,
    checks,
    timestamp: new Date().toISOString()
  })
}