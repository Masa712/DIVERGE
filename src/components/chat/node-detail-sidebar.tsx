'use client'

import { useState, useEffect } from 'react'
import { X, Copy, User, Bot, Settings, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react'
import { ChatNode } from '@/types'

interface Props {
  node: ChatNode | null
  allNodes: ChatNode[]
  isOpen: boolean
  onClose: () => void
}

export function NodeDetailSidebar({ node, allNodes, isOpen, onClose }: Props) {
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0)
  const [nodeChain, setNodeChain] = useState<ChatNode[]>([])

  // Build the parent chain when node changes
  useEffect(() => {
    if (!node || !allNodes.length) {
      setNodeChain([])
      setCurrentNodeIndex(0)
      return
    }

    const chain: ChatNode[] = []
    let currentNode: ChatNode | undefined = node
    const nodeMap = new Map(allNodes.map(n => [n.id, n]))

    // Build chain from current node to root
    while (currentNode) {
      chain.unshift(currentNode) // Add to beginning to maintain order
      currentNode = currentNode.parentId ? nodeMap.get(currentNode.parentId) : undefined
    }

    setNodeChain(chain)
    setCurrentNodeIndex(chain.length - 1) // Start with the clicked node
  }, [node, allNodes])

  const currentDisplayNode = nodeChain[currentNodeIndex]

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatDate = (date: Date) => {
    try {
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch (error) {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50'
      case 'streaming':
        return 'text-blue-600 bg-blue-50'
      case 'failed':
        return 'text-red-600 bg-red-50'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const navigateToParent = () => {
    if (currentNodeIndex > 0) {
      setCurrentNodeIndex(currentNodeIndex - 1)
    }
  }

  const navigateToChild = () => {
    if (currentNodeIndex < nodeChain.length - 1) {
      setCurrentNodeIndex(currentNodeIndex + 1)
    }
  }

  if (!isOpen || !currentDisplayNode) return null

  return (
    <div className={`fixed right-0 top-0 h-full w-96 bg-white border-l shadow-lg transform transition-transform duration-300 z-40 flex flex-col ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}>
      {/* Header - Fixed */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Node Details</h2>
          <span className="text-sm text-gray-500">
            ({currentNodeIndex + 1} of {nodeChain.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation - Fixed */}
      {nodeChain.length > 1 && (
        <div className="p-4 border-b bg-blue-50 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Navigate Chain:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={navigateToParent}
                disabled={currentNodeIndex === 0}
                className="p-1 hover:bg-blue-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Go to parent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-600">
                Depth {currentDisplayNode.depth}
              </span>
              <button
                onClick={navigateToChild}
                disabled={currentNodeIndex === nodeChain.length - 1}
                className="p-1 hover:bg-blue-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Go to child"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Chain visualization */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {nodeChain.map((chainNode, index) => (
              <div key={chainNode.id} className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setCurrentNodeIndex(index)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    index === currentNodeIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-200 text-blue-800 hover:bg-blue-300'
                  }`}
                  title={chainNode.prompt.substring(0, 50) + '...'}
                >
                  {index}
                </button>
                {index < nodeChain.length - 1 && (
                  <ArrowUp className="w-3 h-3 text-blue-600 rotate-90" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Node Info */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Model:</span>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {currentDisplayNode.model.split('/')[1] || currentDisplayNode.model}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Status:</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentDisplayNode.status)}`}>
                {currentDisplayNode.status}
              </span>
            </div>
          </div>

          {/* User Prompt */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-gray-900">User Prompt</h3>
              <button
                onClick={() => copyToClipboard(currentDisplayNode.prompt)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Copy prompt"
              >
                <Copy className="w-3 h-3 text-gray-500" />
              </button>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {currentDisplayNode.prompt}
              </p>
            </div>
          </div>

          {/* System Prompt */}
          {currentDisplayNode.systemPrompt && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-gray-900">System Prompt</h3>
                <button
                  onClick={() => copyToClipboard(currentDisplayNode.systemPrompt!)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Copy system prompt"
                >
                  <Copy className="w-3 h-3 text-gray-500" />
                </button>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {currentDisplayNode.systemPrompt}
                </p>
              </div>
            </div>
          )}

          {/* AI Response */}
          {currentDisplayNode.response && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-gray-900">AI Response</h3>
                <button
                  onClick={() => copyToClipboard(currentDisplayNode.response!)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                  title="Copy response"
                >
                  <Copy className="w-3 h-3 text-gray-500" />
                </button>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {currentDisplayNode.response}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {currentDisplayNode.errorMessage && (
            <div className="space-y-2">
              <h3 className="font-semibold text-red-600">Error</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{currentDisplayNode.errorMessage}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Details</h3>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Created:</span>
                  <p className="text-gray-800">{formatDate(currentDisplayNode.createdAt)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Updated:</span>
                  <p className="text-gray-800">{formatDate(currentDisplayNode.updatedAt)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Tokens:</span>
                  <p className="text-gray-800">
                    {currentDisplayNode.promptTokens + currentDisplayNode.responseTokens} 
                    <span className="text-gray-500 ml-1">
                      ({currentDisplayNode.promptTokens}+{currentDisplayNode.responseTokens})
                    </span>
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Cost:</span>
                  <p className="text-gray-800">${currentDisplayNode.costUsd.toFixed(4)}</p>
                </div>
                {currentDisplayNode.temperature && (
                  <div>
                    <span className="font-medium text-gray-600">Temperature:</span>
                    <p className="text-gray-800">{currentDisplayNode.temperature}</p>
                  </div>
                )}
                {currentDisplayNode.maxTokens && (
                  <div>
                    <span className="font-medium text-gray-600">Max Tokens:</span>
                    <p className="text-gray-800">{currentDisplayNode.maxTokens}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Fixed */}
      <div className="border-t bg-gray-50 p-3 flex-shrink-0">
        <div className="text-xs text-gray-500 font-mono">
          ID: {currentDisplayNode.id}
        </div>
      </div>
    </div>
  )
}
