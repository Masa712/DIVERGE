/**
 * Unified Error Handling System
 * Provides consistent error processing, logging, and user-friendly responses
 */

import { NextResponse } from 'next/server'

// Error categories for proper classification
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  QUOTA_EXCEEDED = 'quota_exceeded',
  INTERNAL = 'internal',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
}

// Error severity levels for monitoring
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Structured error interface
export interface AppError extends Error {
  category: ErrorCategory
  severity: ErrorSeverity
  statusCode: number
  userMessage: string
  context?: Record<string, any>
  retryable?: boolean
  timestamp: string
  requestId?: string
}

// Error configuration for different error types
const ERROR_CONFIG: Record<ErrorCategory, {
  defaultStatusCode: number
  defaultSeverity: ErrorSeverity
  retryable: boolean
  userMessageTemplate: string
}> = {
  [ErrorCategory.AUTHENTICATION]: {
    defaultStatusCode: 401,
    defaultSeverity: ErrorSeverity.MEDIUM,
    retryable: false,
    userMessageTemplate: 'Authentication required. Please sign in to continue.',
  },
  [ErrorCategory.AUTHORIZATION]: {
    defaultStatusCode: 403,
    defaultSeverity: ErrorSeverity.MEDIUM,
    retryable: false,
    userMessageTemplate: 'Access denied. You do not have permission to perform this action.',
  },
  [ErrorCategory.VALIDATION]: {
    defaultStatusCode: 400,
    defaultSeverity: ErrorSeverity.LOW,
    retryable: false,
    userMessageTemplate: 'Invalid input provided. Please check your data and try again.',
  },
  [ErrorCategory.DATABASE]: {
    defaultStatusCode: 500,
    defaultSeverity: ErrorSeverity.HIGH,
    retryable: true,
    userMessageTemplate: 'Database temporarily unavailable. Please try again in a moment.',
  },
  [ErrorCategory.EXTERNAL_API]: {
    defaultStatusCode: 502,
    defaultSeverity: ErrorSeverity.MEDIUM,
    retryable: true,
    userMessageTemplate: 'External service temporarily unavailable. Please try again later.',
  },
  [ErrorCategory.NETWORK]: {
    defaultStatusCode: 503,
    defaultSeverity: ErrorSeverity.MEDIUM,
    retryable: true,
    userMessageTemplate: 'Network error occurred. Please check your connection and try again.',
  },
  [ErrorCategory.RATE_LIMIT]: {
    defaultStatusCode: 429,
    defaultSeverity: ErrorSeverity.LOW,
    retryable: true,
    userMessageTemplate: 'Too many requests. Please wait a moment before trying again.',
  },
  [ErrorCategory.QUOTA_EXCEEDED]: {
    defaultStatusCode: 403,
    defaultSeverity: ErrorSeverity.LOW,
    retryable: false,
    userMessageTemplate: 'Usage limit exceeded. Please upgrade your plan or wait for quota reset.',
  },
  [ErrorCategory.INTERNAL]: {
    defaultStatusCode: 500,
    defaultSeverity: ErrorSeverity.CRITICAL,
    retryable: false,
    userMessageTemplate: 'An unexpected error occurred. Our team has been notified.',
  },
  [ErrorCategory.NOT_FOUND]: {
    defaultStatusCode: 404,
    defaultSeverity: ErrorSeverity.LOW,
    retryable: false,
    userMessageTemplate: 'The requested resource was not found.',
  },
  [ErrorCategory.CONFLICT]: {
    defaultStatusCode: 409,
    defaultSeverity: ErrorSeverity.MEDIUM,
    retryable: false,
    userMessageTemplate: 'A conflict occurred. The resource may have been modified by another user.',
  },
}

/**
 * Create a structured application error
 */
export function createAppError(
  message: string,
  category: ErrorCategory,
  options: {
    cause?: Error
    statusCode?: number
    severity?: ErrorSeverity
    userMessage?: string
    context?: Record<string, any>
    retryable?: boolean
    requestId?: string
  } = {}
): AppError {
  const config = ERROR_CONFIG[category]
  const error = new Error(message) as AppError

  error.category = category
  error.severity = options.severity ?? config.defaultSeverity
  error.statusCode = options.statusCode ?? config.defaultStatusCode
  error.userMessage = options.userMessage ?? config.userMessageTemplate
  error.context = options.context
  error.retryable = options.retryable ?? config.retryable
  error.timestamp = new Date().toISOString()
  error.requestId = options.requestId

  if (options.cause) {
    error.cause = options.cause
    error.stack = options.cause.stack
  }

  return error
}

/**
 * Enhanced error logger with context and structured data
 */
export function logError(error: AppError | Error, additionalContext?: Record<string, any>) {
  const isAppError = 'category' in error
  const logLevel = isAppError 
    ? (error as AppError).severity 
    : ErrorSeverity.MEDIUM

  const logData = {
    timestamp: new Date().toISOString(),
    message: error.message,
    stack: error.stack,
    ...(isAppError && {
      category: (error as AppError).category,
      severity: (error as AppError).severity,
      statusCode: (error as AppError).statusCode,
      userMessage: (error as AppError).userMessage,
      context: (error as AppError).context,
      retryable: (error as AppError).retryable,
      requestId: (error as AppError).requestId,
    }),
    ...(additionalContext && { additionalContext }),
  }

  // Log with appropriate level
  switch (logLevel) {
    case ErrorSeverity.CRITICAL:
      console.error('🚨 CRITICAL ERROR:', logData)
      break
    case ErrorSeverity.HIGH:
      console.error('🔴 HIGH SEVERITY ERROR:', logData)
      break
    case ErrorSeverity.MEDIUM:
      console.warn('🟡 MEDIUM SEVERITY ERROR:', logData)
      break
    case ErrorSeverity.LOW:
      console.info('🟢 LOW SEVERITY ERROR:', logData)
      break
    default:
      console.error('❓ UNKNOWN ERROR:', logData)
  }

  // TODO: In production, send to external monitoring service
  // await sendToMonitoring(logData)
}

/**
 * Convert various error types to AppError
 */
export function normalizeError(
  error: unknown,
  fallbackCategory: ErrorCategory = ErrorCategory.INTERNAL,
  context?: Record<string, any>
): AppError {
  // Already an AppError
  if (error && typeof error === 'object' && 'category' in error) {
    return error as AppError
  }

  // Standard Error object
  if (error instanceof Error) {
    return createAppError(
      error.message,
      fallbackCategory,
      { cause: error, context }
    )
  }

  // String error
  if (typeof error === 'string') {
    return createAppError(
      error,
      fallbackCategory,
      { context }
    )
  }

  // Unknown error type
  return createAppError(
    'An unknown error occurred',
    ErrorCategory.INTERNAL,
    { 
      context: { 
        ...context, 
        originalError: String(error) 
      } 
    }
  )
}

/**
 * Create standardized API error response
 */
export function createErrorResponse(error: AppError | Error): NextResponse {
  const appError = normalizeError(error)
  logError(appError)

  const responseBody = {
    success: false,
    error: {
      message: appError.userMessage,
      code: appError.category,
      retryable: appError.retryable,
      timestamp: appError.timestamp,
      ...(process.env.NODE_ENV === 'development' && {
        developerMessage: appError.message,
        stack: appError.stack,
        context: appError.context,
      }),
    },
  }

  return NextResponse.json(responseBody, { 
    status: appError.statusCode,
    headers: {
      'X-Error-Category': appError.category,
      'X-Error-Retryable': (appError.retryable ?? false).toString(),
    }
  })
}

/**
 * Wrapper for API route handlers with automatic error handling
 */
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return createErrorResponse(error as Error)
    }
  }
}

/**
 * Database error classifier
 */
export function classifyDatabaseError(error: any): ErrorCategory {
  if (!error) return ErrorCategory.DATABASE

  const errorMessage = error.message?.toLowerCase() || ''
  const errorCode = error.code || ''

  // Supabase/PostgreSQL specific error codes
  if (errorCode === 'PGRST116' || errorMessage.includes('not found')) {
    return ErrorCategory.NOT_FOUND
  }
  
  if (errorCode === 'PGRST301' || errorMessage.includes('duplicate')) {
    return ErrorCategory.CONFLICT
  }

  if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
    return ErrorCategory.AUTHORIZATION
  }

  if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
    return ErrorCategory.NETWORK
  }

  if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    return ErrorCategory.RATE_LIMIT
  }

  return ErrorCategory.DATABASE
}

/**
 * Retry configuration for retryable errors
 */
export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
}

/**
 * Execute function with retry logic for retryable errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxAttempts, baseDelay, maxDelay, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  }

  let lastError: Error | undefined
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      const appError = normalizeError(error)

      // Don't retry if error is not retryable
      if (!appError.retryable || attempt === maxAttempts) {
        throw appError
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      )

      console.warn(`🔄 Retry attempt ${attempt}/${maxAttempts} in ${delay}ms for error:`, error)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // This should never be reached due to the logic above, but TypeScript needs it
  throw normalizeError(lastError || new Error('Retry operation failed'))
}