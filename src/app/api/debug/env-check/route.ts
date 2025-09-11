import { NextResponse } from 'next/server'

export async function GET() {
  // Check all environment variables for debugging
  const envCheck = {
    // Sentry variables
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'Set' : 'Not set',
    SENTRY_ORG: process.env.SENTRY_ORG ? 'Set' : 'Not set',
    SENTRY_PROJECT: process.env.SENTRY_PROJECT ? 'Set' : 'Not set', 
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN ? 'Set' : 'Not set',
    
    // PostHog variables
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ? 'Set' : 'Not set',
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST ? 'Set' : 'Not set',
    
    // Environment
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV || 'Not set',
    
    // Values (first few chars for debugging)
    DSN_PREFIX: process.env.NEXT_PUBLIC_SENTRY_DSN ? process.env.NEXT_PUBLIC_SENTRY_DSN.substring(0, 20) + '...' : 'Not available',
    POSTHOG_PREFIX: process.env.NEXT_PUBLIC_POSTHOG_KEY ? process.env.NEXT_PUBLIC_POSTHOG_KEY.substring(0, 10) + '...' : 'Not available'
  }
  
  return NextResponse.json({
    success: true,
    envCheck,
    timestamp: new Date().toISOString()
  })
}