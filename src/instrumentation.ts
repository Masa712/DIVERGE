export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side initialization
    const { init } = await import('@sentry/nextjs')
    
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      
      // Adjust this value based on environment
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Disable debug in development to reduce console noise
      debug: false,
      
      // Performance monitoring
      beforeSend(event, hint) {
        // Block all events in development to keep logs clean
        if (process.env.NODE_ENV === 'development') {
          console.log('Sentry event blocked in development:', event.event_id)
          return null // Don't send to Sentry in development
        }
        return event // Send to Sentry in production only
      },
      
      // Environment configuration
      environment: process.env.NODE_ENV || 'development',
      
      // Additional context for debugging
      initialScope: {
        tags: {
          component: 'server'
        }
      },
      
      // Server-specific configuration
      integrations: [
        // Enable HTTP tracing - use default integrations for now
      ]
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime initialization
    const { init } = await import('@sentry/nextjs')
    
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: false,
      environment: process.env.NODE_ENV || 'development',
      
      initialScope: {
        tags: {
          component: 'edge'
        }
      }
    })
  }
}