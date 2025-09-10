'use client'

import { useState } from 'react'
import { analytics, featureFlags } from '@/lib/posthog/analytics'
import posthog from '@/lib/posthog/client'

export default function PostHogTestPage() {
  const [testResults, setTestResults] = useState<string[]>([])

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testBasicTracking = () => {
    try {
      posthog?.capture('test_basic_event', {
        test_property: 'test_value',
        timestamp: new Date().toISOString()
      })
      addResult('✅ Basic event sent to PostHog')
    } catch (error) {
      addResult('❌ Failed to send basic event')
    }
  }

  const testChatAnalytics = () => {
    try {
      analytics.trackChatStart({
        sessionId: 'test-session-123',
        model: 'gpt-4',
        nodeId: 'test-node-456'
      })
      
      analytics.trackMessageSent({
        sessionId: 'test-session-123',
        model: 'gpt-4',
        messageCount: 5
      })
      
      analytics.trackAIResponse({
        sessionId: 'test-session-123',
        model: 'gpt-4',
        tokenCount: 150,
        responseTime: 2500
      })
      
      addResult('✅ Chat analytics events sent')
    } catch (error) {
      addResult('❌ Failed to send chat analytics')
    }
  }

  const testFeatureUsage = () => {
    try {
      analytics.trackFeatureUsage('node_editor', {
        action: 'create_node',
        node_type: 'chat'
      })
      
      analytics.trackNodeInteraction('click', 'test-node-789', {
        interaction_type: 'expand'
      })
      
      addResult('✅ Feature usage events sent')
    } catch (error) {
      addResult('❌ Failed to send feature usage events')
    }
  }

  const testPerformanceTracking = () => {
    try {
      analytics.trackPerformance({
        component: 'tree_view',
        loadTime: 1200,
        interactionType: 'resize'
      })
      
      addResult('✅ Performance tracking event sent')
    } catch (error) {
      addResult('❌ Failed to send performance event')
    }
  }

  const testUserProperties = () => {
    try {
      analytics.setUserProperties({
        plan: 'free',
        features_used: ['chat', 'node_editor'],
        last_active: new Date().toISOString()
      })
      
      addResult('✅ User properties set')
    } catch (error) {
      addResult('❌ Failed to set user properties')
    }
  }

  const testErrorTracking = () => {
    try {
      analytics.trackError({
        sessionId: 'test-session-123',
        model: 'gpt-4',
        errorType: 'api_timeout',
        errorMessage: 'Request timed out after 30 seconds'
      })
      
      addResult('✅ Error tracking event sent')
    } catch (error) {
      addResult('❌ Failed to send error event')
    }
  }

  const testFeatureFlags = () => {
    try {
      const flagEnabled = featureFlags.isEnabled('test_feature_flag')
      const flagVariant = featureFlags.getVariant('test_variant_flag')
      
      addResult(`✅ Feature flags tested - Enabled: ${flagEnabled}, Variant: ${flagVariant}`)
    } catch (error) {
      addResult('❌ Failed to check feature flags')
    }
  }

  const checkPostHogStatus = async () => {
    try {
      const response = await fetch('/api/debug/posthog-check')
      if (response.ok) {
        const data = await response.json()
        addResult(`✅ PostHog Status: ${JSON.stringify(data.checks, null, 2)}`)
      } else {
        addResult('❌ Failed to check PostHog status')
      }
    } catch (error) {
      addResult('❌ Error checking PostHog status')
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">PostHog Analytics Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Test Functions</h2>
          
          <button
            onClick={testBasicTracking}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Basic Event Tracking
          </button>
          
          <button
            onClick={testChatAnalytics}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Test Chat Analytics
          </button>
          
          <button
            onClick={testFeatureUsage}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Test Feature Usage
          </button>
          
          <button
            onClick={testPerformanceTracking}
            className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Test Performance Tracking
          </button>
          
          <button
            onClick={testUserProperties}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Test User Properties
          </button>
          
          <button
            onClick={testErrorTracking}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Test Error Tracking
          </button>
          
          <button
            onClick={testFeatureFlags}
            className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Test Feature Flags
          </button>
          
          <button
            onClick={checkPostHogStatus}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Check PostHog Status
          </button>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Test Results</h2>
          <div className="bg-gray-100 p-4 rounded-lg h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-500">No tests run yet</p>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="text-sm mb-2 font-mono">
                  {result}
                </div>
              ))
            )}
          </div>
          
          <button
            onClick={() => setTestResults([])}
            className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Clear Results
          </button>
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-blue-100 rounded-lg">
        <h3 className="font-semibold mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Make sure you have set the NEXT_PUBLIC_POSTHOG_KEY environment variable</li>
          <li>Create a PostHog project and get your API key</li>
          <li>Run the tests above and check your PostHog dashboard</li>
          <li>Each test will send different types of analytics data</li>
          <li>Check the browser console for development logs</li>
        </ol>
      </div>
    </div>
  )
}