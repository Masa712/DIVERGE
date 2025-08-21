'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface ScalabilityMetrics {
  cache: {
    hitRate: number
    memoryUsageMB: number
    activeSession: number
    totalNodes: number
    compressionRatio: number
    evictionCount: number
    averageResponseTime: number
  }
  profiler: {
    totalOperations: number
    averageExecutionTime: number
    p95ExecutionTime: number
    throughputOpsPerSecond: number
    memoryEfficiency: number
    errorRate: number
    bottlenecks: Array<{
      operation: string
      impact: number
      recommendation: string
    }>
  }
  buildQueue: {
    activeBuilds: number
    queuedRequests: string[]
  }
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  score: number
  issues: string[]
  recommendations: string[]
}

export function ScalabilityDashboard() {
  const [metrics, setMetrics] = useState<ScalabilityMetrics | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: 'healthy',
    score: 100,
    issues: [],
    recommendations: []
  })
  const [optimizationHistory, setOptimizationHistory] = useState<Array<{
    timestamp: number
    optimizations: string[]
    performanceGain: number
  }>>([])

  // Simulate metrics fetching (in real implementation, this would call your API)
  useEffect(() => {
    const interval = setInterval(async () => {
      // In real implementation, fetch from your scalable context builder
      const mockMetrics: ScalabilityMetrics = {
        cache: {
          hitRate: 0.85 + Math.random() * 0.1,
          memoryUsageMB: 45 + Math.random() * 20,
          activeSession: Math.floor(150 + Math.random() * 100),
          totalNodes: Math.floor(2500 + Math.random() * 500),
          compressionRatio: 0.6 + Math.random() * 0.1,
          evictionCount: Math.floor(Math.random() * 10),
          averageResponseTime: 15 + Math.random() * 10
        },
        profiler: {
          totalOperations: Math.floor(10000 + Math.random() * 5000),
          averageExecutionTime: 45 + Math.random() * 20,
          p95ExecutionTime: 120 + Math.random() * 50,
          throughputOpsPerSecond: 25 + Math.random() * 10,
          memoryEfficiency: 0.8 + Math.random() * 0.15,
          errorRate: Math.random() * 0.05,
          bottlenecks: [
            { operation: 'buildEnhancedContext', impact: 85, recommendation: 'Consider caching strategy' },
            { operation: 'resolveReferences', impact: 65, recommendation: 'Optimize database queries' }
          ]
        },
        buildQueue: {
          activeBuilds: Math.floor(Math.random() * 5),
          queuedRequests: Array.from({ length: Math.floor(Math.random() * 3) }, (_, i) => `node_${i}`)
        }
      }

      setMetrics(mockMetrics)
      updateSystemHealth(mockMetrics)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const updateSystemHealth = (metrics: ScalabilityMetrics) => {
    const issues: string[] = []
    const recommendations: string[] = []
    let score = 100

    // Cache health checks
    if (metrics.cache.hitRate < 0.7) {
      issues.push('Low cache hit rate')
      recommendations.push('Consider cache warming or TTL optimization')
      score -= 15
    }

    if (metrics.cache.memoryUsageMB > 80) {
      issues.push('High memory usage')
      recommendations.push('Consider cache cleanup or scaling')
      score -= 20
    }

    // Performance health checks
    if (metrics.profiler.averageExecutionTime > 100) {
      issues.push('High average execution time')
      recommendations.push('Optimize slow operations')
      score -= 10
    }

    if (metrics.profiler.errorRate > 0.02) {
      issues.push('Elevated error rate')
      recommendations.push('Review error patterns and fix underlying issues')
      score -= 25
    }

    if (metrics.profiler.throughputOpsPerSecond < 10) {
      issues.push('Low throughput')
      recommendations.push('Consider horizontal scaling or optimization')
      score -= 15
    }

    // Queue health checks
    if (metrics.buildQueue.activeBuilds > 8) {
      issues.push('High build queue utilization')
      recommendations.push('Consider increasing concurrency limits')
      score -= 10
    }

    const status: SystemHealth['status'] = 
      score >= 85 ? 'healthy' : 
      score >= 60 ? 'warning' : 
      'critical'

    setSystemHealth({
      status,
      score: Math.max(0, score),
      issues,
      recommendations
    })
  }

  const runOptimization = () => {
    // Simulate optimization
    const optimizations = ['cache_optimization', 'profiler_cleanup', 'memory_cleanup']
    const performanceGain = Math.floor(15 + Math.random() * 20)
    
    setOptimizationHistory(prev => [
      { timestamp: Date.now(), optimizations, performanceGain },
      ...prev.slice(0, 4)
    ])
  }

  const getStatusColor = (status: SystemHealth['status']) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200'
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
    }
  }

  const formatPercent = (value: number) => `${Math.round(value * 100)}%`
  const formatNumber = (value: number) => Math.round(value).toLocaleString()
  const formatTime = (ms: number) => `${Math.round(ms)}ms`

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading scalability metrics...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Enterprise Scalability Dashboard</h2>
        <div className="flex items-center space-x-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(systemHealth.status)}`}>
            {systemHealth.status.toUpperCase()} ({systemHealth.score}/100)
          </div>
          <button
            onClick={runOptimization}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Optimize System
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>🏥 System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Health Score</span>
                <span className={`font-bold ${systemHealth.score >= 85 ? 'text-green-600' : systemHealth.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {systemHealth.score}/100
                </span>
              </div>
              
              {systemHealth.issues.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-red-600 mb-2">Issues:</div>
                  <ul className="text-sm text-red-600 space-y-1">
                    {systemHealth.issues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {systemHealth.recommendations.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-blue-600 mb-2">Recommendations:</div>
                  <ul className="text-sm text-blue-600 space-y-1">
                    {systemHealth.recommendations.map((rec, i) => (
                      <li key={i}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🚀 Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatTime(metrics.profiler.averageExecutionTime)}
                </div>
                <div className="text-sm text-gray-600">Avg Execution</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(metrics.profiler.throughputOpsPerSecond)}
                </div>
                <div className="text-sm text-gray-600">Ops/Second</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatPercent(metrics.profiler.memoryEfficiency)}
                </div>
                <div className="text-sm text-gray-600">Memory Efficiency</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatPercent(metrics.profiler.errorRate)}
                </div>
                <div className="text-sm text-gray-600">Error Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💾 Cache Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatPercent(metrics.cache.hitRate)}
                </div>
                <div className="text-sm text-gray-600">Hit Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.cache.memoryUsageMB.toFixed(1)}MB
                </div>
                <div className="text-sm text-gray-600">Memory Usage</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatNumber(metrics.cache.activeSession)}
                </div>
                <div className="text-sm text-gray-600">Active Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatTime(metrics.cache.averageResponseTime)}
                </div>
                <div className="text-sm text-gray-600">Response Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Performance Bottlenecks */}
        <Card>
          <CardHeader>
            <CardTitle>🔍 Performance Bottlenecks</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.profiler.bottlenecks.length === 0 ? (
              <p className="text-green-600 text-center py-4">No significant bottlenecks detected</p>
            ) : (
              <div className="space-y-4">
                {metrics.profiler.bottlenecks.map((bottleneck, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{bottleneck.operation}</span>
                      <span className="text-red-600 font-bold">Impact: {bottleneck.impact}</span>
                    </div>
                    <p className="text-sm text-gray-600">{bottleneck.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Build Queue Status */}
        <Card>
          <CardHeader>
            <CardTitle>⚙️ Build Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Active Builds:</span>
                <span className="font-bold text-blue-600">{metrics.buildQueue.activeBuilds}</span>
              </div>
              
              {metrics.buildQueue.queuedRequests.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">Queued Requests:</div>
                  <div className="space-y-1">
                    {metrics.buildQueue.queuedRequests.map((request, i) => (
                      <div key={i} className="text-sm bg-gray-100 p-2 rounded">
                        {request}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {metrics.buildQueue.activeBuilds === 0 && metrics.buildQueue.queuedRequests.length === 0 && (
                <p className="text-green-600 text-center py-4">All build queues clear</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cache Details */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Cache Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-lg font-semibold mb-2">Compression</div>
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {formatPercent(metrics.cache.compressionRatio)}
              </div>
              <div className="text-sm text-gray-600">Compression Ratio</div>
            </div>

            <div>
              <div className="text-lg font-semibold mb-2">Evictions</div>
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {metrics.cache.evictionCount}
              </div>
              <div className="text-sm text-gray-600">Total Evicted</div>
            </div>

            <div>
              <div className="text-lg font-semibold mb-2">Capacity</div>
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {formatNumber(metrics.cache.totalNodes)}
              </div>
              <div className="text-sm text-gray-600">Total Nodes</div>
            </div>

            <div>
              <div className="text-lg font-semibold mb-2">Efficiency</div>
              <div className="text-2xl font-bold text-green-600 mb-1">
                {((metrics.cache.hitRate * 100) / Math.max(metrics.cache.memoryUsageMB, 1)).toFixed(1)}
              </div>
              <div className="text-sm text-gray-600">Hit/MB Ratio</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimization History */}
      {optimizationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🔧 Recent Optimizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {optimizationHistory.map((opt, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">
                      {new Date(opt.timestamp).toLocaleString()}
                    </span>
                    <span className="text-green-600 font-bold">
                      +{opt.performanceGain}% performance gain
                    </span>
                  </div>
                  <div className="text-sm">
                    <strong>Applied:</strong> {opt.optimizations.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}