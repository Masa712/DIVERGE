'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface PerformanceMetrics {
  contextBuildTime: number
  cacheHitRate: number
  dbQueries: number
  nodesProcessed: number
  referencesResolved: number
  sessionId: string
  timestamp: number
  // NEW: Token accuracy metrics
  tokenAccuracy?: number
  estimatedTokens?: number
  accurateTokens?: number
}

interface PerformanceTestResult {
  testName: string
  withCache: PerformanceMetrics
  withoutCache: PerformanceMetrics
  improvement: {
    speedup: number
    cacheHitRate: number
    queryReduction: number
  }
}

export function PerformanceDashboard() {
  const [isRunning, setIsRunning] = useState(false)
  const [testResults, setTestResults] = useState<PerformanceTestResult[]>([])
  const [realTimeMetrics, setRealTimeMetrics] = useState<PerformanceMetrics[]>([])

  // リアルタイムメトリクス監視
  useEffect(() => {
    const interval = setInterval(() => {
      // ブラウザのグローバル変数からメトリクスを取得
      const metrics = (window as any).performanceMetrics
      if (metrics) {
        setRealTimeMetrics(prev => [
          ...prev.slice(-10), // 直近10件を保持
          {
            ...metrics,
            timestamp: Date.now()
          }
        ])
        // グローバル変数をクリア
        delete (window as any).performanceMetrics
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const runPerformanceTest = async () => {
    setIsRunning(true)
    try {
      const response = await fetch('/api/debug/performance-test-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'simple' })
      })
      
      if (response.ok) {
        const result = await response.json()
        setTestResults(prev => [result, ...prev.slice(0, 4)]) // 直近5件を保持
      }
    } catch (error) {
      console.error('Performance test failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const getPerformanceColor = (improvement: number) => {
    if (improvement > 70) return 'text-green-600 bg-green-50'
    if (improvement > 40) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const formatTime = (ms: number) => `${Math.round(ms)}ms`
  const formatPercent = (value: number) => `${Math.round(value)}%`

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Enhanced Context Performance Dashboard</h2>
        <button
          onClick={runPerformanceTest}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? 'Testing...' : 'Run Performance Test'}
        </button>
      </div>

      {/* Real-time Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>🔴 Live Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          {realTimeMetrics.length > 0 ? (
            <div className="grid grid-cols-5 gap-4">
              {realTimeMetrics.slice(-1).map((metric, index) => (
                <div key={index} className="space-y-2">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatTime(metric.contextBuildTime)}
                    </div>
                    <div className="text-sm text-gray-600">Context Build Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatPercent(metric.cacheHitRate)}
                    </div>
                    <div className="text-sm text-gray-600">Cache Hit Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {metric.dbQueries}
                    </div>
                    <div className="text-sm text-gray-600">DB Queries</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {metric.referencesResolved}
                    </div>
                    <div className="text-sm text-gray-600">References Resolved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-teal-600">
                      {metric.tokenAccuracy ? formatPercent(metric.tokenAccuracy * 100) : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">Token Accuracy</div>
                    {metric.estimatedTokens && metric.accurateTokens && (
                      <div className="text-xs text-gray-500">
                        Est: {metric.estimatedTokens} | Actual: {metric.accurateTokens}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Waiting for performance data... Try creating a new chat message with references.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Performance Test Results */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">📊 Performance Test Results</h3>
        {testResults.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">No performance tests run yet. Click "Run Performance Test" to start!</p>
            </CardContent>
          </Card>
        ) : (
          testResults.map((result, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>🧪 {result.testName}</span>
                  <span className={`px-3 py-1 rounded-full text-sm ${getPerformanceColor(result.improvement.speedup)}`}>
                    {result.improvement.speedup}% faster
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  {/* Without Cache */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-red-600">❌ Without Cache</h4>
                    <div className="space-y-2 text-sm">
                      <div>Build Time: {formatTime(result.withoutCache.contextBuildTime)}</div>
                      <div>DB Queries: {result.withoutCache.dbQueries}</div>
                      <div>Nodes: {result.withoutCache.nodesProcessed}</div>
                      <div>References: {result.withoutCache.referencesResolved}</div>
                    </div>
                  </div>

                  {/* With Cache */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-green-600">✅ With Cache</h4>
                    <div className="space-y-2 text-sm">
                      <div>Build Time: {formatTime(result.withCache.contextBuildTime)}</div>
                      <div>DB Queries: {result.withCache.dbQueries}</div>
                      <div>Nodes: {result.withCache.nodesProcessed}</div>
                      <div>References: {result.withCache.referencesResolved}</div>
                      <div>Cache Hit: {formatPercent(result.withCache.cacheHitRate)}</div>
                    </div>
                  </div>

                  {/* Improvement */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-blue-600">📈 Improvements</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Speed:</span>
                        <span className="font-bold text-green-600">
                          +{formatPercent(result.improvement.speedup)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cache Hit:</span>
                        <span className="font-bold text-blue-600">
                          {formatPercent(result.improvement.cacheHitRate)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Query Reduction:</span>
                        <span className="font-bold text-purple-600">
                          -{formatPercent(result.improvement.queryReduction)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Performance Chart */}
      {realTimeMetrics.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Performance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-32 flex items-end justify-between bg-gray-50 rounded p-4">
                {realTimeMetrics.slice(-8).map((metric, index) => (
                  <div
                    key={index}
                    className="bg-blue-500 rounded-t"
                    style={{
                      height: `${Math.min(metric.contextBuildTime / 5, 100)}%`,
                      width: '10%'
                    }}
                    title={`${formatTime(metric.contextBuildTime)} - ${new Date(metric.timestamp).toLocaleTimeString()}`}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-600 text-center">
                Context Build Time Trend (Lower is Better)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}