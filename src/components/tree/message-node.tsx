'use client'

import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { ChatNode } from '@/types'

interface MessageNodeData {
  node: ChatNode
  isCurrentNode: boolean
  onNodeClick?: (nodeId: string) => void
  onBranchCreate?: (parentNodeId: string, prompt: string) => void
}

export const MessageNode = memo(({ data }: NodeProps<MessageNodeData>) => {
  const { node, isCurrentNode, onNodeClick, onBranchCreate } = data
  const [showBranchInput, setShowBranchInput] = useState(false)
  const [branchPrompt, setBranchPrompt] = useState('')
  const [isCreatingBranch, setIsCreatingBranch] = useState(false)
  
  const getStatusColor = () => {
    switch (node.status) {
      case 'completed':
        return 'border-green-500 bg-green-50'
      case 'streaming':
        return 'border-blue-500 bg-blue-50 animate-pulse'
      case 'failed':
        return 'border-red-500 bg-red-50'
      case 'pending':
        return 'border-yellow-500 bg-yellow-50'
      default:
        return 'border-gray-300 bg-white'
    }
  }

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const handleBranchSubmit = () => {
    if (!branchPrompt.trim() || !onBranchCreate || isCreatingBranch) return
    
    setIsCreatingBranch(true)
    try {
      onBranchCreate(node.id, branchPrompt.trim())
      setBranchPrompt('')
      setShowBranchInput(false)
    } catch (error) {
      console.error('Failed to create branch:', error)
    } finally {
      setIsCreatingBranch(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleBranchSubmit()
    }
    if (e.key === 'Escape') {
      setShowBranchInput(false)
      setBranchPrompt('')
    }
  }

  return (
    <div
      className={`rounded-lg border-2 p-3 shadow-sm transition-all hover:shadow-md hover:scale-[1.02] ${
        isCurrentNode ? 'border-blue-500 bg-blue-50' : getStatusColor()
      } ${onNodeClick ? 'cursor-pointer' : ''}`}
      style={{ minWidth: '250px', maxWidth: '350px' }}
      onClick={() => onNodeClick?.(node.id)}
      title="Click to view full details"
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Model Badge and Node ID */}
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium">
          {node.model.split('/')[1] || node.model}
        </span>
        <div className="flex items-center gap-2">
          <span 
            className="text-xs font-mono bg-blue-100 text-blue-800 px-1 py-0.5 rounded cursor-pointer hover:bg-blue-200"
            title="Click to copy node reference"
            onClick={async (e) => {
              e.stopPropagation()
              try {
                await navigator.clipboard.writeText(`@${node.id.slice(-8)}`)
                // Visual feedback
                const target = e.target as HTMLElement
                const originalBg = target.className
                target.className = originalBg.replace('bg-blue-100', 'bg-green-100').replace('text-blue-800', 'text-green-800')
                setTimeout(() => {
                  target.className = originalBg
                }, 500)
                console.log(`✅ Copied reference: @${node.id.slice(-8)}`)
              } catch (err) {
                console.error('Failed to copy to clipboard:', err)
              }
            }}
          >
            #{node.id.slice(-8)}
          </span>
          {node.depth > 0 && (
            <span className="text-xs text-gray-500">D{node.depth}</span>
          )}
        </div>
      </div>

      {/* User Prompt */}
      <div className="mb-2">
        <p className="text-xs font-medium text-gray-600 mb-1">User:</p>
        <p className="text-sm">{truncateText(node.prompt, 80)}</p>
      </div>

      {/* Assistant Response */}
      {node.response && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-600 mb-1">Assistant:</p>
          <p className="text-sm text-gray-700">{truncateText(node.response, 80)}</p>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${
          node.status === 'failed' ? 'text-red-600' : 'text-gray-600'
        }`}>
          {node.status}
        </span>
        {node.costUsd > 0 && (
          <span className="text-gray-500">${node.costUsd.toFixed(4)}</span>
        )}
      </div>

      {/* Branch Input Field */}
      {showBranchInput && onBranchCreate && (
        <div className="mt-3 border-t pt-3" onClick={(e) => e.stopPropagation()}>
          <textarea
            value={branchPrompt}
            onChange={(e) => setBranchPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter alternative prompt..."
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
            rows={2}
            autoFocus
            disabled={isCreatingBranch}
          />
          <div className="mt-1 flex gap-1">
            <button
              onClick={handleBranchSubmit}
              disabled={!branchPrompt.trim() || isCreatingBranch}
              className="flex-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreatingBranch ? 'Creating...' : 'Branch'}
            </button>
            <button
              onClick={() => {
                setShowBranchInput(false)
                setBranchPrompt('')
              }}
              disabled={isCreatingBranch}
              className="rounded bg-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Branch Button - only show when not showing input */}
      {!showBranchInput && onBranchCreate && node.status === 'completed' && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowBranchInput(true)
          }}
          className="mt-2 w-full rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Branch from here
        </button>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})

MessageNode.displayName = 'MessageNode'