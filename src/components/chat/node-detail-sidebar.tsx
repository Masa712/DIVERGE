'use client'

import { useState, useEffect } from 'react'
import { X, Copy, User, Bot, Settings, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react'
import { ChatNode } from '@/types'

interface Props {
  node: ChatNode | null
  allNodes: ChatNode[]
  isOpen: boolean
  onClose: () => void
  session?: { id: string; name: string } | null
  onModelChange?: (nodeId: string, model: string) => void
}

export function NodeDetailSidebar({ node, allNodes, isOpen, onClose, session, onModelChange }: Props) {
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

  const navigateToNode = (index: number) => {
    setCurrentNodeIndex(index)
  }

  const handleModelChange = (model: string) => {
    if (onModelChange && currentDisplayNode) {
      onModelChange(currentDisplayNode.id, model)
    }
  }

  if (!isOpen || !currentDisplayNode) return null

  return (
    <div className={`fixed right-[30px] top-[25px] bottom-[25px] w-[400px] z-50 
      flex flex-col glass-test glass-blur border border-white/20 
      shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem] 
      transition-all duration-300 origin-right ${
        isOpen 
          ? 'opacity-100 scale-100 pointer-events-auto' 
          : 'opacity-0 scale-95 pointer-events-none'
      }`}>
      
      {/* Header - Session Title */}
      <div className="px-6 pt-9 pb-4 border-b border-white/10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {session?.name || 'Chat Session'}
          </h1>
        </div>
      </div>

      {/* Navigation Chain */}
      {nodeChain.length > 1 && (
        <div className="px-6 py-4 border-b border-white/10">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Navigation Chain
            </h3>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sidebar-scroll">
            {nodeChain.map((chainNode, index) => (
              <div key={chainNode.id} className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => navigateToNode(index)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                    index === currentNodeIndex
                      ? 'bg-blue-600 text-white shadow-lg scale-110'
                      : 'bg-white/20 text-gray-700 hover:bg-white/30 hover:scale-105'
                  }`}
                  title={chainNode.prompt.substring(0, 50) + '...'}
                >
                  {index + 1}
                </button>
                {index < nodeChain.length - 1 && (
                  <div className="w-4 h-0.5 bg-gray-400 rounded-full" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 sidebar-scroll">
        <div className="space-y-6">
          
          {/* User Prompt Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">User Prompt</h3>
              <button
                onClick={() => copyToClipboard(currentDisplayNode.prompt)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Copy prompt"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {currentDisplayNode.prompt}
              </p>
            </div>
          </div>

          {/* AI Response Section */}
          {currentDisplayNode.response && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900">AI Response</h3>
                
                {/* Model Tag with Click to Change */}
                <button
                  onClick={() => {
                    // For now, just show the model. Later we can add model selection dropdown
                    console.log('Model change clicked for:', currentDisplayNode.model)
                  }}
                  className="px-2 py-1 text-xs font-medium bg-green-100/70 text-green-800 rounded-full hover:bg-green-200/70 transition-colors"
                  title="Click to change model (coming soon)"
                >
                  {currentDisplayNode.model.split('/')[1] || currentDisplayNode.model}
                </button>
                
                <button
                  onClick={() => copyToClipboard(currentDisplayNode.response!)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Copy response"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {currentDisplayNode.response}
                </p>
              </div>
            </div>
          )}

          {/* System Prompt */}
          {currentDisplayNode.systemPrompt && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                  <Settings className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900">System Prompt</h3>
                <button
                  onClick={() => copyToClipboard(currentDisplayNode.systemPrompt!)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Copy system prompt"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {currentDisplayNode.systemPrompt}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {currentDisplayNode.errorMessage && (
            <div className="space-y-3">
              <h3 className="font-semibold text-red-600">Error</h3>
              <div className="bg-red-50/70 border border-red-200/50 rounded-lg p-4">
                <p className="text-sm text-red-800">{currentDisplayNode.errorMessage}</p>
              </div>
            </div>
          )}

          {/* Status and Metadata */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Details</h3>
            <div className="bg-white/5 backdrop-blur rounded-lg p-4 border border-white/20">
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-600">Status:</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentDisplayNode.status)}`}>
                    {currentDisplayNode.status}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Created:</span>
                  <p className="text-gray-800 mt-1">{formatDate(currentDisplayNode.createdAt)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Updated:</span>
                  <p className="text-gray-800 mt-1">{formatDate(currentDisplayNode.updatedAt)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Tokens:</span>
                  <p className="text-gray-800 mt-1">
                    {currentDisplayNode.promptTokens + currentDisplayNode.responseTokens} 
                    <span className="text-gray-500 ml-1">
                      ({currentDisplayNode.promptTokens}+{currentDisplayNode.responseTokens})
                    </span>
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Cost:</span>
                  <p className="text-gray-800 mt-1">${currentDisplayNode.costUsd.toFixed(4)}</p>
                </div>
                {currentDisplayNode.temperature && (
                  <div>
                    <span className="font-medium text-gray-600">Temperature:</span>
                    <p className="text-gray-800 mt-1">{currentDisplayNode.temperature}</p>
                  </div>
                )}
                {currentDisplayNode.maxTokens && (
                  <div>
                    <span className="font-medium text-gray-600">Max Tokens:</span>
                    <p className="text-gray-800 mt-1">{currentDisplayNode.maxTokens}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Node ID */}
      <div className="border-t border-white/10 px-6 py-3">
        <div className="text-xs text-gray-500 font-mono text-center">
          ID: {currentDisplayNode.id}
        </div>
      </div>
    </div>
  )
}
