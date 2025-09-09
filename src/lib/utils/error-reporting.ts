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
  const transaction = Sentry.startTransaction({
    name: operation,
    op: 'api'
  })

  // Add context to transaction
  if (context?.feature) {
    transaction.setTag('feature', context.feature)
  }
  if (context?.model) {
    transaction.setTag('model', context.model)
  }

  return fn()
    .then((result) => {
      transaction.setStatus('ok')
      return result
    })
    .catch((error) => {
      transaction.setStatus('internal_error')
      reportError(error, { ...context, feature: operation })
      throw error
    })
    .finally(() => {
      transaction.finish()
    })
}

/**
 * Capture user feedback for errors
 */
export function captureUserFeedback(eventId: string, name: string, email: string, comments: string) {
  Sentry.captureUserFeedback({
    event_id: eventId,
    name,
    email,
    comments
  })
}