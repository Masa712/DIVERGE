'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface ContextStrategyMetrics {
  strategy: string
  priority: string
  selectedCount: number
  candidateCount: number
  averageWeight: number
  tokenDistribution: {
    ancestors: number
    siblings: number
    references: number
    summaries: number
  }
  adaptiveAdjustments: number
  buildTime: number
  timestamp: number
}

const strategyDescriptions = {
  comprehensive: '🎯 Balanced approach with all context types',
  focused: '🔍 Direct ancestors + key references only',
  exploratory: '🌳 Heavy emphasis on alternative approaches',
  'reference-heavy': '🔗 Prioritizes explicitly referenced content',
  minimal: '⚡ Essential context, maximize new content',
  analytical: '📊 Comparative analysis from multiple sources',
  creative: '🎨 Diverse examples and creative alternatives'
}

const priorityDescriptions = {
  recency: '⏰ Prefer recent conversations',
  relevance: '🎯 Semantically similar content',
  completeness: '✅ Complete Q&A pairs',
  depth: '📚 Detailed discussions',
  breadth: '🌐 Diverse topics and approaches'
}

export function ContextStrategyDashboard() {
  const [strategyMetrics, setStrategyMetrics] = useState<ContextStrategyMetrics[]>([])
  const [currentStrategy, setCurrentStrategy] = useState<ContextStrategyMetrics | null>(null)

  // Monitor for context strategy metrics
  useEffect(() => {
    const interval = setInterval(() => {
      const metrics = (window as any).performanceMetrics
      if (metrics && metrics.strategy) {
        const strategyData: ContextStrategyMetrics = {
          strategy: metrics.strategy,
          priority: metrics.priority || 'relevance',
          selectedCount: metrics.nodesProcessed || 0,
          candidateCount: metrics.candidateCount || 0,
          averageWeight: metrics.averageWeight || 0,
          tokenDistribution: metrics.tokenDistribution || {
            ancestors: 0,
            siblings: 0,
            references: 0,
            summaries: 0
          },
          adaptiveAdjustments: metrics.adaptiveAdjustments || 0,
          buildTime: metrics.contextBuildTime || 0,
          timestamp: Date.now()
        }

        setCurrentStrategy(strategyData)
        setStrategyMetrics(prev => [strategyData, ...prev.slice(0, 9)]) // Keep last 10
        
        // Clear metrics
        delete (window as any).performanceMetrics
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const getStrategyColor = (strategy: string) => {
    const colors = {
      comprehensive: 'bg-blue-50 border-blue-200 text-blue-800',
      focused: 'bg-green-50 border-green-200 text-green-800',
      exploratory: 'bg-purple-50 border-purple-200 text-purple-800',
      'reference-heavy': 'bg-orange-50 border-orange-200 text-orange-800',
      minimal: 'bg-gray-50 border-gray-200 text-gray-800',
      analytical: 'bg-red-50 border-red-200 text-red-800',
      creative: 'bg-pink-50 border-pink-200 text-pink-800'
    }
    return colors[strategy as keyof typeof colors] || 'bg-gray-50 border-gray-200 text-gray-800'
  }

  const formatPercent = (value: number) => `${Math.round(value * 100)}%`
  const formatTime = (ms: number) => `${Math.round(ms)}ms`

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Context Strategy Intelligence Dashboard</h2>
        {currentStrategy && (
          <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getStrategyColor(currentStrategy.strategy)}`}>
            {currentStrategy.strategy} + {currentStrategy.priority}
          </div>
        )}
      </div>

      {/* Current Strategy Analysis */}
      {currentStrategy && (
        <Card>
          <CardHeader>
            <CardTitle>🔬 Current Strategy Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className={`p-4 rounded-lg border ${getStrategyColor(currentStrategy.strategy)}`}>
                  <div className="font-semibold text-lg mb-2">{currentStrategy.strategy.toUpperCase()}</div>
                  <div className="text-sm">{strategyDescriptions[currentStrategy.strategy as keyof typeof strategyDescriptions]}</div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="font-semibold mb-2">Priority: {currentStrategy.priority}</div>
                  <div className="text-sm text-gray-600">{priorityDescriptions[currentStrategy.priority as keyof typeof priorityDescriptions]}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {currentStrategy.selectedCount}/{currentStrategy.candidateCount}
                    </div>
                    <div className="text-sm text-gray-600">Nodes Selected</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatPercent(currentStrategy.averageWeight)}
                    </div>
                    <div className="text-sm text-gray-600">Avg Weight</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatTime(currentStrategy.buildTime)}
                    </div>
                    <div className="text-sm text-gray-600">Build Time</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {currentStrategy.adaptiveAdjustments}
                    </div>
                    <div className="text-sm text-gray-600">Adaptations</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Token Distribution */}
      {currentStrategy && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Token Distribution Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(currentStrategy.tokenDistribution).map(([type, tokens]) => {
                const total = Object.values(currentStrategy.tokenDistribution).reduce((a, b) => a + b, 0)
                const percentage = total > 0 ? (tokens / total) * 100 : 0
                
                return (
                  <div key={type} className="flex items-center space-x-4">
                    <div className="w-20 text-sm font-medium capitalize">{type}:</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-6">
                      <div 
                        className="bg-blue-500 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      >
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-16 text-sm text-gray-600 text-right">{tokens} tokens</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy History */}
      <Card>
        <CardHeader>
          <CardTitle>📈 Recent Strategy Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {strategyMetrics.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No strategy metrics yet. Try creating a new chat message to see intelligent strategy selection.
            </p>
          ) : (
            <div className="space-y-3">
              {strategyMetrics.map((metric, index) => (
                <div key={index} className={`p-3 rounded-lg border ${getStrategyColor(metric.strategy)} flex items-center justify-between`}>
                  <div className="flex items-center space-x-4">
                    <div className="font-medium">{metric.strategy}</div>
                    <div className="text-sm">
                      {metric.selectedCount}/{metric.candidateCount} nodes
                    </div>
                    <div className="text-sm">
                      {formatTime(metric.buildTime)}
                    </div>
                    {metric.adaptiveAdjustments > 0 && (
                      <div className="text-xs bg-white bg-opacity-70 px-2 py-1 rounded">
                        {metric.adaptiveAdjustments} adaptations
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(metric.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strategy Effectiveness Chart */}
      {strategyMetrics.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>⚡ Strategy Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-32 flex items-end justify-between bg-gray-50 rounded p-4">
                {strategyMetrics.slice(0, 8).reverse().map((metric, index) => {
                  const efficiency = metric.selectedCount / Math.max(metric.candidateCount, 1)
                  return (
                    <div
                      key={index}
                      className="bg-blue-500 rounded-t flex-1 mx-1"
                      style={{ height: `${Math.max(efficiency * 100, 5)}%` }}
                      title={`${metric.strategy}: ${(efficiency * 100).toFixed(1)}% efficiency`}
                    />
                  )
                })}
              </div>
              <p className="text-sm text-gray-600 text-center">
                Selection Efficiency Over Time (Higher bars = better node selection)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy Guide */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Strategy Selection Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(strategyDescriptions).map(([strategy, description]) => (
              <div key={strategy} className={`p-3 rounded-lg border ${getStrategyColor(strategy)}`}>
                <div className="font-semibold capitalize mb-1">{strategy}</div>
                <div className="text-sm">{description}</div>
                
                {/* Show usage examples */}
                <div className="mt-2 text-xs">
                  <strong>Best for:</strong>{' '}
                  {strategy === 'comprehensive' && 'General questions and explanations'}
                  {strategy === 'focused' && 'Direct how-to questions'}
                  {strategy === 'exploratory' && 'Brainstorming and ideation'}
                  {strategy === 'reference-heavy' && 'Questions with explicit references'}
                  {strategy === 'minimal' && 'Quick queries with space constraints'}
                  {strategy === 'analytical' && 'Comparisons and analysis'}
                  {strategy === 'creative' && 'Design and creative tasks'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}