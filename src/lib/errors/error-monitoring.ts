/**
 * Error Monitoring and Metrics Collection System
 * Tracks error patterns, frequency, and system health
 */

import { ErrorCategory, ErrorSeverity, AppError } from './error-handler'

// Error metrics interface
export interface ErrorMetrics {
  totalErrors: number
  errorsByCategory: Record<ErrorCategory, number>
  errorsBySeverity: Record<ErrorSeverity, number>
  errorRate: number // errors per minute
  topErrors: Array<{
    message: string
    category: ErrorCategory
    count: number
    lastOccurrence: string
  }>
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical'
    score: number // 0-100
    lastUpdate: string
  }
}

// In-memory error tracking (in production, use Redis or database)
class ErrorMonitor {
  private errors: AppError[] = []
  private readonly maxErrors = 1000 // Keep last 1000 errors
  private readonly metricsWindow = 60 * 1000 // 1 minute window
  
  /**
   * Record an error occurrence
   */
  recordError(error: AppError): void {
    this.errors.push(error)
    
    // Keep only recent errors to prevent memory leaks
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors)
    }
    
    // Trigger alerts for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.triggerCriticalAlert(error)
    }
  }
  
  /**
   * Get comprehensive error metrics
   */
  getMetrics(): ErrorMetrics {
    const now = Date.now()
    const recentErrors = this.errors.filter(
      error => now - new Date(error.timestamp).getTime() < this.metricsWindow
    )
    
    // Count errors by category
    const errorsByCategory = Object.values(ErrorCategory).reduce(
      (acc, category) => {
        acc[category] = recentErrors.filter(e => e.category === category).length
        return acc
      },
      {} as Record<ErrorCategory, number>
    )
    
    // Count errors by severity
    const errorsBySeverity = Object.values(ErrorSeverity).reduce(
      (acc, severity) => {
        acc[severity] = recentErrors.filter(e => e.severity === severity).length
        return acc
      },
      {} as Record<ErrorSeverity, number>
    )
    
    // Calculate error rate (errors per minute)
    const errorRate = recentErrors.length
    
    // Get top error messages
    const errorGroups = new Map<string, {
      category: ErrorCategory
      count: number
      lastOccurrence: string
    }>()
    
    recentErrors.forEach(error => {
      const key = `${error.category}:${error.message}`
      const existing = errorGroups.get(key)
      
      if (existing) {
        existing.count++
        existing.lastOccurrence = error.timestamp
      } else {
        errorGroups.set(key, {
          category: error.category,
          count: 1,
          lastOccurrence: error.timestamp
        })
      }
    })
    
    const topErrors = Array.from(errorGroups.entries())
      .map(([message, data]) => ({
        message: message.split(':')[1],
        ...data
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
    
    // Calculate system health score
    const systemHealth = this.calculateSystemHealth(recentErrors)
    
    return {
      totalErrors: recentErrors.length,
      errorsByCategory,
      errorsBySeverity,
      errorRate,
      topErrors,
      systemHealth
    }
  }
  
  /**
   * Calculate overall system health score
   */
  private calculateSystemHealth(recentErrors: AppError[]): ErrorMetrics['systemHealth'] {
    let score = 100
    
    // Deduct points for errors by severity
    const criticalErrors = recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length
    const highErrors = recentErrors.filter(e => e.severity === ErrorSeverity.HIGH).length
    const mediumErrors = recentErrors.filter(e => e.severity === ErrorSeverity.MEDIUM).length
    
    score -= criticalErrors * 20 // -20 per critical error
    score -= highErrors * 10     // -10 per high severity error
    score -= mediumErrors * 2    // -2 per medium severity error
    
    // Ensure score doesn't go below 0
    score = Math.max(0, score)
    
    // Determine status based on score
    let status: 'healthy' | 'degraded' | 'critical'
    if (score >= 80) {
      status = 'healthy'
    } else if (score >= 40) {
      status = 'degraded'
    } else {
      status = 'critical'
    }
    
    return {
      status,
      score,
      lastUpdate: new Date().toISOString()
    }
  }
  
  /**
   * Trigger critical error alert
   */
  private triggerCriticalAlert(error: AppError): void {
    console.error('🚨 CRITICAL ERROR ALERT:', {
      message: error.message,
      category: error.category,
      timestamp: error.timestamp,
      context: error.context,
      requestId: error.requestId
    })
    
    // TODO: In production, send to alerting system
    // - Send Slack notification
    // - Send email to on-call engineer
    // - Create PagerDuty incident
    // - Log to external monitoring service
  }
  
  /**
   * Get error trends over time
   */
  getErrorTrends(timeRangeMs: number = 60 * 60 * 1000): Array<{
    timestamp: string
    errorCount: number
    criticalCount: number
  }> {
    const now = Date.now()
    const bucketSize = 5 * 60 * 1000 // 5-minute buckets
    const buckets = Math.ceil(timeRangeMs / bucketSize)
    
    const trends: Array<{
      timestamp: string
      errorCount: number
      criticalCount: number
    }> = []
    
    for (let i = buckets; i >= 0; i--) {
      const bucketStart = now - (i * bucketSize)
      const bucketEnd = bucketStart + bucketSize
      
      const bucketErrors = this.errors.filter(error => {
        const errorTime = new Date(error.timestamp).getTime()
        return errorTime >= bucketStart && errorTime < bucketEnd
      })
      
      const criticalCount = bucketErrors.filter(
        e => e.severity === ErrorSeverity.CRITICAL
      ).length
      
      trends.push({
        timestamp: new Date(bucketStart).toISOString(),
        errorCount: bucketErrors.length,
        criticalCount
      })
    }
    
    return trends
  }
  
  /**
   * Clear old error records (for cleanup)
   */
  cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs
    const initialCount = this.errors.length
    
    this.errors = this.errors.filter(
      error => new Date(error.timestamp).getTime() > cutoff
    )
    
    const removedCount = initialCount - this.errors.length
    if (removedCount > 0) {
      console.log(`🧹 Cleaned up ${removedCount} old error records`)
    }
  }
}

// Global error monitor instance
const errorMonitor = new ErrorMonitor()

// Start periodic cleanup
setInterval(() => {
  errorMonitor.cleanup()
}, 60 * 60 * 1000) // Clean up every hour

// Export functions
export function recordError(error: AppError): void {
  errorMonitor.recordError(error)
}

export function getErrorMetrics(): ErrorMetrics {
  return errorMonitor.getMetrics()
}

export function getErrorTrends(timeRangeMs?: number) {
  return errorMonitor.getErrorTrends(timeRangeMs)
}

// Error monitoring middleware for API routes
export function attachErrorMonitoring() {
  // Enhance console.error to automatically track errors
  const originalConsoleError = console.error
  console.error = (...args) => {
    // Call original console.error
    originalConsoleError(...args)
    
    // Try to extract error information
    const firstArg = args[0]
    if (typeof firstArg === 'string' && firstArg.includes('ERROR')) {
      // Create a basic AppError for monitoring
      // This is a fallback for errors not using the unified system
      const error = {
        message: args.join(' '),
        category: ErrorCategory.INTERNAL,
        severity: ErrorSeverity.MEDIUM,
        statusCode: 500,
        userMessage: 'An unexpected error occurred',
        retryable: false,
        timestamp: new Date().toISOString()
      } as AppError
      
      recordError(error)
    }
  }
}

// Initialize monitoring
attachErrorMonitoring()