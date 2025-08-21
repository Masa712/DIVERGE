/**
 * Advanced performance profiling and monitoring system
 * Real-time performance tracking with bottleneck detection and optimization recommendations
 */

export interface PerformanceProfile {
  operationName: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
  children?: PerformanceProfile[]
  memoryUsage?: {
    before: number
    after: number
    delta: number
  }
}

export interface PerformanceMetrics {
  totalOperations: number
  averageExecutionTime: number
  p95ExecutionTime: number
  p99ExecutionTime: number
  memoryEfficiency: number
  cacheHitRate: number
  errorRate: number
  throughputOpsPerSecond: number
  bottlenecks: Array<{
    operation: string
    impact: number
    recommendation: string
  }>
}

export interface SystemHealthMetrics {
  cpuUsage?: number
  memoryUsage: number
  gcPressure?: number
  eventLoopDelay?: number
  activeConnections?: number
  queueDepth?: number
}

class PerformanceProfiler {
  private profiles: Map<string, PerformanceProfile> = new Map()
  private completedProfiles: PerformanceProfile[] = []
  private metrics: PerformanceMetrics
  private systemHealth: SystemHealthMetrics
  private readonly maxProfileHistory = 1000
  private metricsInterval: NodeJS.Timeout | null = null

  constructor() {
    this.metrics = {
      totalOperations: 0,
      averageExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      memoryEfficiency: 1.0,
      cacheHitRate: 0,
      errorRate: 0,
      throughputOpsPerSecond: 0,
      bottlenecks: []
    }
    
    this.systemHealth = {
      memoryUsage: 0,
      gcPressure: 0,
      eventLoopDelay: 0,
      queueDepth: 0
    }
    
    this.startSystemMonitoring()
  }

  /**
   * Start profiling an operation
   */
  startProfile(operationName: string, metadata?: Record<string, any>): string {
    const profileId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const profile: PerformanceProfile = {
      operationName,
      startTime: performance.now(),
      metadata: metadata || {},
      children: [],
      memoryUsage: {
        before: this.getMemoryUsage(),
        after: 0,
        delta: 0
      }
    }
    
    this.profiles.set(profileId, profile)
    return profileId
  }

  /**
   * End profiling an operation
   */
  endProfile(profileId: string, additionalMetadata?: Record<string, any>): PerformanceProfile | null {
    const profile = this.profiles.get(profileId)
    if (!profile) {
      console.warn(`Profile not found: ${profileId}`)
      return null
    }

    const endTime = performance.now()
    const memoryAfter = this.getMemoryUsage()
    
    profile.endTime = endTime
    profile.duration = endTime - profile.startTime
    profile.memoryUsage!.after = memoryAfter
    profile.memoryUsage!.delta = memoryAfter - profile.memoryUsage!.before

    if (additionalMetadata) {
      profile.metadata = { ...profile.metadata, ...additionalMetadata }
    }

    // Move to completed profiles
    this.completedProfiles.push(profile)
    this.profiles.delete(profileId)

    // Maintain history limit
    if (this.completedProfiles.length > this.maxProfileHistory) {
      this.completedProfiles.shift()
    }

    // Update metrics
    this.updateMetrics(profile)

    return profile
  }

  /**
   * Create a child profile
   */
  startChildProfile(parentProfileId: string, operationName: string, metadata?: Record<string, any>): string {
    const parentProfile = this.profiles.get(parentProfileId)
    if (!parentProfile) {
      console.warn(`Parent profile not found: ${parentProfileId}`)
      return this.startProfile(operationName, metadata)
    }

    const childProfileId = this.startProfile(operationName, metadata)
    const childProfile = this.profiles.get(childProfileId)
    
    if (childProfile) {
      parentProfile.children!.push(childProfile)
    }

    return childProfileId
  }

  /**
   * Measure function execution with automatic profiling
   */
  async measureAsync<T>(
    operationName: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; profile: PerformanceProfile }> {
    const profileId = this.startProfile(operationName, metadata)
    
    try {
      const result = await fn()
      const profile = this.endProfile(profileId, { success: true })!
      return { result, profile }
    } catch (error) {
      const profile = this.endProfile(profileId, { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      })!
      throw error
    }
  }

  /**
   * Measure synchronous function execution
   */
  measureSync<T>(
    operationName: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): { result: T; profile: PerformanceProfile } {
    const profileId = this.startProfile(operationName, metadata)
    
    try {
      const result = fn()
      const profile = this.endProfile(profileId, { success: true })!
      return { result, profile }
    } catch (error) {
      const profile = this.endProfile(profileId, { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      })!
      throw error
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Get system health metrics
   */
  getSystemHealth(): SystemHealthMetrics {
    return { ...this.systemHealth }
  }

  /**
   * Get detailed performance report
   */
  getPerformanceReport(): {
    summary: PerformanceMetrics
    systemHealth: SystemHealthMetrics
    topOperations: Array<{
      operation: string
      count: number
      avgDuration: number
      totalTime: number
    }>
    recentProfiles: PerformanceProfile[]
    recommendations: string[]
  } {
    const operationStats = new Map<string, { count: number; totalTime: number; durations: number[] }>()
    
    // Analyze completed profiles
    this.completedProfiles.forEach(profile => {
      if (profile.duration !== undefined) {
        const stats = operationStats.get(profile.operationName) || { count: 0, totalTime: 0, durations: [] }
        stats.count++
        stats.totalTime += profile.duration
        stats.durations.push(profile.duration)
        operationStats.set(profile.operationName, stats)
      }
    })

    const topOperations = Array.from(operationStats.entries())
      .map(([operation, stats]) => ({
        operation,
        count: stats.count,
        avgDuration: stats.totalTime / stats.count,
        totalTime: stats.totalTime
      }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 10)

    const recommendations = this.generateRecommendations()

    return {
      summary: this.metrics,
      systemHealth: this.systemHealth,
      topOperations,
      recentProfiles: this.completedProfiles.slice(-20),
      recommendations
    }
  }

  /**
   * Identify performance bottlenecks
   */
  identifyBottlenecks(): Array<{
    operation: string
    impact: number
    recommendation: string
    evidence: {
      avgDuration: number
      frequency: number
      memoryImpact: number
    }
  }> {
    const operationStats = new Map<string, { 
      durations: number[]
      memoryDeltas: number[]
      frequency: number 
    }>()

    this.completedProfiles.forEach(profile => {
      if (profile.duration !== undefined) {
        const stats = operationStats.get(profile.operationName) || { 
          durations: [], 
          memoryDeltas: [], 
          frequency: 0 
        }
        stats.durations.push(profile.duration)
        stats.memoryDeltas.push(profile.memoryUsage?.delta || 0)
        stats.frequency++
        operationStats.set(profile.operationName, stats)
      }
    })

    const bottlenecks = Array.from(operationStats.entries())
      .map(([operation, stats]) => {
        const avgDuration = stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
        const avgMemoryDelta = stats.memoryDeltas.reduce((a, b) => a + b, 0) / stats.memoryDeltas.length
        const p95Duration = this.calculatePercentile(stats.durations, 95)
        
        // Impact score: frequency * duration * memory impact
        const impact = stats.frequency * avgDuration * Math.max(1, avgMemoryDelta / 1000000) // MB

        let recommendation = ''
        if (avgDuration > 100) recommendation += 'Consider optimizing algorithm. '
        if (avgMemoryDelta > 10000000) recommendation += 'High memory usage detected. '
        if (p95Duration > avgDuration * 2) recommendation += 'High variance in execution time. '
        if (stats.frequency > 100) recommendation += 'Consider caching results. '

        return {
          operation,
          impact,
          recommendation: recommendation || 'Monitor for changes.',
          evidence: {
            avgDuration,
            frequency: stats.frequency,
            memoryImpact: avgMemoryDelta
          }
        }
      })
      .filter(bottleneck => bottleneck.impact > 10) // Filter significant bottlenecks
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5)

    return bottlenecks
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): {
    timestamp: number
    profiles: PerformanceProfile[]
    metrics: PerformanceMetrics
    systemHealth: SystemHealthMetrics
  } {
    return {
      timestamp: Date.now(),
      profiles: [...this.completedProfiles],
      metrics: { ...this.metrics },
      systemHealth: { ...this.systemHealth }
    }
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.completedProfiles = []
    this.profiles.clear()
    console.log('🧹 Performance profiler history cleared')
  }

  // Private methods

  private updateMetrics(profile: PerformanceProfile): void {
    this.metrics.totalOperations++

    if (profile.duration !== undefined) {
      const alpha = 0.1 // Smoothing factor for rolling averages
      this.metrics.averageExecutionTime = 
        this.metrics.averageExecutionTime * (1 - alpha) + profile.duration * alpha

      // Update percentiles
      const recentDurations = this.completedProfiles
        .slice(-100)
        .map(p => p.duration)
        .filter(d => d !== undefined) as number[]
      
      this.metrics.p95ExecutionTime = this.calculatePercentile(recentDurations, 95)
      this.metrics.p99ExecutionTime = this.calculatePercentile(recentDurations, 99)

      // Update throughput (operations per second)
      const recentProfiles = this.completedProfiles.slice(-100)
      if (recentProfiles.length > 1) {
        const timeSpan = recentProfiles[recentProfiles.length - 1].startTime - recentProfiles[0].startTime
        this.metrics.throughputOpsPerSecond = (recentProfiles.length * 1000) / timeSpan
      }
    }

    // Update memory efficiency
    if (profile.memoryUsage?.delta !== undefined) {
      const memoryEfficiency = profile.memoryUsage.delta > 0 ? 
        Math.max(0, 1 - (profile.memoryUsage.delta / 10000000)) : 1 // 10MB threshold
      this.metrics.memoryEfficiency = 
        this.metrics.memoryEfficiency * 0.9 + memoryEfficiency * 0.1
    }

    // Update error rate
    const isError = profile.metadata?.success === false
    this.metrics.errorRate = this.metrics.errorRate * 0.95 + (isError ? 1 : 0) * 0.05

    // Update bottlenecks
    this.metrics.bottlenecks = this.identifyBottlenecks()
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0
    
    const sorted = [...values].sort((a, b) => a - b)
    const index = (percentile / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    
    if (upper >= sorted.length) return sorted[sorted.length - 1]
    
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
  }

  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }

  private startSystemMonitoring(): void {
    this.metricsInterval = setInterval(() => {
      this.updateSystemHealth()
    }, 5000) // Update every 5 seconds
  }

  private updateSystemHealth(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memInfo = process.memoryUsage()
      this.systemHealth.memoryUsage = memInfo.heapUsed
      this.systemHealth.gcPressure = memInfo.heapUsed / memInfo.heapTotal
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.metrics.averageExecutionTime > 100) {
      recommendations.push('Consider optimizing slow operations (avg > 100ms)')
    }

    if (this.metrics.memoryEfficiency < 0.8) {
      recommendations.push('Memory usage could be optimized')
    }

    if (this.metrics.errorRate > 0.05) {
      recommendations.push('Error rate is elevated (>5%)')
    }

    if (this.systemHealth.gcPressure && this.systemHealth.gcPressure > 0.8) {
      recommendations.push('High GC pressure detected')
    }

    if (this.metrics.cacheHitRate < 0.7) {
      recommendations.push('Consider improving cache strategy')
    }

    return recommendations
  }

  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }
    this.clearHistory()
  }
}

// Singleton instance
let globalProfiler: PerformanceProfiler | null = null

export function getPerformanceProfiler(): PerformanceProfiler {
  if (!globalProfiler) {
    globalProfiler = new PerformanceProfiler()
  }
  return globalProfiler
}

// Convenient decorators for automatic profiling
export function ProfileAsync(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const opName = operationName || `${target.constructor.name}.${propertyKey}`

    descriptor.value = async function (...args: any[]) {
      const profiler = getPerformanceProfiler()
      return await profiler.measureAsync(opName, () => originalMethod.apply(this, args))
    }

    return descriptor
  }
}

export function ProfileSync(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const opName = operationName || `${target.constructor.name}.${propertyKey}`

    descriptor.value = function (...args: any[]) {
      const profiler = getPerformanceProfiler()
      return profiler.measureSync(opName, () => originalMethod.apply(this, args))
    }

    return descriptor
  }
}

export { PerformanceProfiler }