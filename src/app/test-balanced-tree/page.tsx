'use client'

import { useState } from 'react'
import { CompactTreeView, generateCompactTestData } from '@/components/tree/BalancedTreeView'
import { ChatNode } from '@/types'

export default function TestBalancedTreePage() {
  const [testNodes] = useState<ChatNode[]>(() => generateCompactTestData())
  const [currentNodeId, setCurrentNodeId] = useState<string>()

  const handleNodeClick = (nodeId: string) => {
    setCurrentNodeId(nodeId)
    console.log('Node clicked:', nodeId)
  }


  return (
    <div className="h-screen w-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Compact Tree Layout Test
        </h1>
        <p className="text-gray-600 mt-1">
          Testing unbalanced tree structures with compact layout
        </p>
        
        {/* Test Case Info */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h2 className="font-semibold text-blue-900 mb-2">Test Case Structure:</h2>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Root:</strong> ホテル経営について教えてください</li>
            <li>• <strong>Child A:</strong> 顧客サービスについて詳しく (5個の孫ノード)</li>
            <li>• <strong>Child B:</strong> 運営効率について (1個の孫ノード)</li>
            <li>• <strong>Child C:</strong> 財務管理について (孫ノードなし)</li>
          </ul>
          <div className="mt-2 text-xs text-blue-600">
            This unbalanced structure tests the compact layout algorithm's efficiency.
          </div>
        </div>

        {/* Current Selection */}
        {currentNodeId && (
          <div className="mt-3 p-2 bg-green-50 rounded">
            <span className="text-sm text-green-800">
              Selected Node: <code className="font-mono">{currentNodeId}</code>
            </span>
          </div>
        )}
      </div>

      {/* Tree View */}
      <div className="flex-1">
        <CompactTreeView
          nodes={testNodes}
          currentNodeId={currentNodeId}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 border-t px-6 py-3">
        <div className="text-sm text-gray-600">
          <strong>Instructions:</strong> 
          Click on nodes to select them and see the compact layout in action. 
          Enable debug info to see coordinate details and layout calculations.
        </div>
      </div>
    </div>
  )
}
