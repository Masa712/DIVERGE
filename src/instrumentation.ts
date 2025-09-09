export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side initialization
    const { init } = await import('@sentry/nextjs')
    
    init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      
      // Adjust this value based on environment
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Enable debug only in development
      debug: process.env.NODE_ENV === 'development',
      
      // Performance monitoring
      beforeSend(event, hint) {
        // Filter out development errors
        if (process.env.NODE_ENV === 'development') {
          console.log('Sentry server event (dev):', event)
        }
        return event
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
      debug: process.env.NODE_ENV === 'development',
      environment: process.env.NODE_ENV || 'development',
      
      initialScope: {
        tags: {
          component: 'edge'
        }
      }
    })
  }
}