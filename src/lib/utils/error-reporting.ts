import * as Sentry from '@sentry/nextjs'

export interface ErrorContext {
  userId?: string
  sessionId?: string
  nodeId?: string
  model?: string
  feature?: string
  url?: string
  userAgent?: string
  timestamp?: Date
  additionalData?: Record<string, any>
}

/**
 * Report an error to Sentry with additional context
 */
export function reportError(error: Error, context?: ErrorContext) {
  // Add user context if available
  if (context?.userId) {
    Sentry.setUser({ id: context.userId })
  }

  // Add tags for categorization
  Sentry.withScope((scope) => {
    if (context?.sessionId) {
      scope.setTag('sessionId', context.sessionId)
    }
    if (context?.nodeId) {
      scope.setTag('nodeId', context.nodeId)
    }
    if (context?.model) {
      scope.setTag('model', context.model)
    }
    if (context?.feature) {
      scope.setTag('feature', context.feature)
    }

    // Add extra context data
    if (context?.additionalData) {
      scope.setContext('additionalData', context.additionalData)
    }

    // Add request context
    if (context?.url) {
      scope.setContext('request', {
        url: context.url,
        userAgent: context.userAgent,
        timestamp: context.timestamp?.toISOString()
      })
    }

    // Capture the error
    Sentry.captureException(error)
  })

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error reported to Sentry:', error, context)
  }
}

/**
 * Report a custom message to Sentry
 */
export function reportMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext) {
  Sentry.withScope((scope) => {
    if (context?.userId) {
      Sentry.setUser({ id: context.userId })
    }

    if (context?.sessionId) {
      scope.setTag('sessionId', context.sessionId)
    }
    if (context?.feature) {
      scope.setTag('feature', context.feature)
    }

    if (context?.additionalData) {
      scope.setContext('additionalData', context.additionalData)
    }

    Sentry.captureMessage(message, level)
  })
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    timestamp: Date.now() / 1000
  })
}

/**
 * Performance monitoring for API calls
 */
export function withSentryPerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  // Use the new Sentry v8 API with startSpan
  return Sentry.startSpan(
    {
      name: operation,
      op: 'api',
      attributes: {
        feature: context?.feature || '',
        model: context?.model || ''
      }
    },
    async () => {
      try {
        const result = await fn()
        Sentry.setTag('status', 'success')
        return result
      } catch (error) {
        Sentry.setTag('status', 'error')
        reportError(error as Error, { ...context, feature: operation })
        throw error
      }
    }
  )
}

/**
 * Capture user feedback for errors
 */
export function captureUserFeedback(eventId: string, name: string, email: string, comments: string) {
  // User feedback is now handled through the User Feedback Widget
  // or can be sent as a custom event
  Sentry.captureMessage('User Feedback', {
    tags: {
      type: 'user_feedback',
      event_id: eventId
    },
    extra: {
      name,
      email,
      comments,
      event_id: eventId
    }
  })
}