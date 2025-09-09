'use client'

import { useState } from 'react'
import { reportError, reportMessage, addBreadcrumb, withSentryPerformance } from '@/lib/utils/error-reporting'

export default function SentryTestPage() {
  const [testResults, setTestResults] = useState<string[]>([])

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testClientError = () => {
    try {
      throw new Error('Test client-side error from Sentry debug page')
    } catch (error) {
      reportError(error as Error, {
        feature: 'sentry-test',
        additionalData: { testType: 'client-error' }
      })
      addResult('Client error sent to Sentry')
    }
  }

  const testServerError = async () => {
    try {
      const response = await fetch('/api/debug/sentry-test')
      if (!response.ok) {
        throw new Error('Server error test failed')
      }
      const data = await response.json()
      addResult(`Server test: ${data.message}`)
    } catch (error) {
      reportError(error as Error, {
        feature: 'sentry-test',
        additionalData: { testType: 'server-error' }
      })
      addResult('Server error sent to Sentry')
    }
  }

  const testMessage = () => {
    reportMessage('This is a test message from the debug page', 'info', {
      feature: 'sentry-test',
      additionalData: { testType: 'message' }
    })
    addResult('Message sent to Sentry')
  }

  const testBreadcrumb = () => {
    addBreadcrumb('User clicked test breadcrumb button', 'ui.click', {
      buttonId: 'test-breadcrumb'
    })
    addResult('Breadcrumb added')
  }

  const testPerformance = async () => {
    try {
      await withSentryPerformance(
        'test-performance',
        async () => {
          // Simulate some async work
          await new Promise(resolve => setTimeout(resolve, 1000))
          return 'Performance test completed'
        },
        { feature: 'sentry-test' }
      )
      addResult('Performance monitoring test completed')
    } catch (error) {
      addResult('Performance test failed')
    }
  }

  const testUnhandledError = () => {
    // This will be caught by Sentry's global error handlers
    setTimeout(() => {
      throw new Error('Unhandled error for Sentry testing')
    }, 100)
    addResult('Unhandled error triggered (check Sentry dashboard)')
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Sentry Integration Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Test Functions</h2>
          
          <button
            onClick={testClientError}
            className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Test Client Error
          </button>
          
          <button
            onClick={testServerError}
            className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Test Server Error
          </button>
          
          <button
            onClick={testMessage}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Test Message
          </button>
          
          <button
            onClick={testBreadcrumb}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Test Breadcrumb
          </button>
          
          <button
            onClick={testPerformance}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Test Performance
          </button>
          
          <button
            onClick={testUnhandledError}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Test Unhandled Error
          </button>
        </div>
        
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Test Results</h2>
          <div className="bg-gray-100 p-4 rounded-lg h-64 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-500">No tests run yet</p>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="text-sm mb-2">
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
      
      <div className="mt-8 p-4 bg-yellow-100 rounded-lg">
        <h3 className="font-semibold mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Make sure you have set the NEXT_PUBLIC_SENTRY_DSN environment variable</li>
          <li>Run the tests above and check your Sentry dashboard</li>
          <li>Each test will send different types of data to Sentry</li>
          <li>Check the console for development logs</li>
        </ol>
      </div>
    </div>
  )
}