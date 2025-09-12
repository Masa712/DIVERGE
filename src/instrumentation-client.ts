// This file configures the initialization of Sentry on the browser side.
// The config you add here will be used whenever a users loads a page in their browser.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value based on environment
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Disable debug to keep console clean
  debug: false,

  // Block events in development
  beforeSend(event, hint) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Sentry client event blocked in development:', event.event_id)
      return null // Don't send to Sentry in development
    }
    return event // Send to Sentry in production only
  },

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while in development and sample at a lower rate in production.
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    // Temporarily disable replay integration to avoid errors
    // new Sentry.replayIntegration({
    //   // Additional Replay configuration goes in here, for example:
    //   maskAllText: true,
    //   blockAllMedia: true,
    // }),
  ],

  // Environment configuration
  environment: process.env.NODE_ENV || 'development',

  // Additional context for debugging
  initialScope: {
    tags: {
      component: 'client'
    }
  }
})

// Export router transition hook as required by Sentry v10
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;