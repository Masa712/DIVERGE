import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export async function GET() {
  console.log('=== SENTRY FORCE INIT TEST ===')
  
  // Force initialize Sentry directly in API route
  try {
    console.log('DSN:', process.env.NEXT_PUBLIC_SENTRY_DSN ? 'Available' : 'Missing')
    console.log('NODE_ENV:', process.env.NODE_ENV)
    
    // Manual initialization
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      debug: false,
      environment: process.env.NODE_ENV || 'development',
    })
    
    console.log('Manual init completed')
    
    // Check client
    const client = Sentry.getClient()
    console.log('Client after manual init:', !!client)
    
    if (client) {
      console.log('Client DSN:', client.getOptions()?.dsn)
    }
    
    // Try to capture test message
    const eventId = Sentry.captureMessage('Force init test message', 'info')
    console.log('Event ID:', eventId)
    
    return NextResponse.json({
      success: true,
      results: {
        manualInitAttempted: true,
        clientAvailable: !!client,
        clientDsn: client?.getOptions()?.dsn || 'Not available',
        eventId: eventId || 'Not generated',
        environment: process.env.NODE_ENV,
        dsnConfigured: !!process.env.NEXT_PUBLIC_SENTRY_DSN
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Sentry force init error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}