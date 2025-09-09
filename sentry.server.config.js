// This file configures the initialization of Sentry on the server side.
// The config you add here will be used whenever the server handles a request.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

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
    // Enable HTTP tracing
    new Sentry.httpIntegration(),
  ]
})