import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function GET() {
  // Check if Sentry is operational by attempting to capture a message
  let sentryOperational = false
  let eventId = null
  
  try {
    eventId = Sentry.captureMessage('Sentry operational check', 'debug')
    sentryOperational = !!eventId
  } catch (error) {
    sentryOperational = false
  }
  
  // Check various Sentry configurations
  const checks: any = {
    dsnConfigured: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    dsnValue: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'Set (hidden for security)' : 'Not set',
    sentryInitialized: sentryOperational,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'Configured' : 'Not available',
    environment: process.env.NODE_ENV,
    org: process.env.SENTRY_ORG || 'Not set',
    project: process.env.SENTRY_PROJECT || 'Not set',
    authToken: process.env.SENTRY_AUTH_TOKEN ? 'Set' : 'Not set',
    
    // Test if we can send events
    canSendEvents: sentryOperational ? 'Yes' : 'No',
    checkEventId: eventId || 'Not generated',
    
    // Additional debug info
    debug: {
      nodeVersion: process.version,
      nextVersion: require('next/package.json').version,
      sentryVersion: require('@sentry/nextjs/package.json').version,
    }
  }
  
  // Try to send a test message
  if (sentryOperational) {
    const testEventId = Sentry.captureMessage('Sentry check endpoint test message', 'info')
    checks.testMessageSent = !!testEventId
    checks.testEventId = testEventId || 'Not generated'
  } else {
    checks.testMessageSent = false
    checks.testEventId = 'Not generated'
  }
  
  return NextResponse.json({
    success: true,
    checks,
    timestamp: new Date().toISOString()
  })
}