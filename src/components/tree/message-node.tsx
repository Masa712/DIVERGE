'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { ChatNode } from '@/types'
import { StreamingAnimation } from '@/components/ui/streaming-animation'

interface MessageNodeData {
  node: ChatNode
  isCurrentNode: boolean
  onNodeClick?: (nodeId: string) => void
}

export const MessageNode = memo(({ data }: NodeProps<MessageNodeData>) => {
  const { node, isCurrentNode, onNodeClick } = data
  
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
            title="Click to copy node reference or insert into input"
            onMouseDown={(e) => {
              // Prevent focus loss from textarea
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={async (e) => {
              e.stopPropagation()
              const nodeRef = `@${node.id.slice(-8)}`
              
              // Try to find the textarea element
              const textarea = document.querySelector('textarea[placeholder*="Type your message"]') as HTMLTextAreaElement
              
              // Check if textarea was recently focused (within last 100ms) or is currently focused
              const wasFocused = textarea && (
                document.activeElement === textarea || 
                textarea.dataset.wasFocused === 'true'
              )
              
              console.log('🔍 Checking focus:', {
                activeElement: document.activeElement?.tagName,
                textareaFound: !!textarea,
                wasFocused
              })
              
              if (textarea && wasFocused) {
                // Insert directly into the textarea
                const start = textarea.selectionStart
                const end = textarea.selectionEnd
                const currentValue = textarea.value
                const newValue = currentValue.slice(0, start) + nodeRef + ' ' + currentValue.slice(end)
                
                // Update the textarea value
                textarea.value = newValue
                
                // Trigger React's onChange event
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                  window.HTMLTextAreaElement.prototype,
                  'value'
                )?.set
                if (nativeInputValueSetter) {
                  nativeInputValueSetter.call(textarea, newValue)
                }
                const inputEvent = new Event('input', { bubbles: true })
                textarea.dispatchEvent(inputEvent)
                
                // Set cursor position after inserted text
                setTimeout(() => {
                  textarea.focus()
                  const newCursorPos = start + nodeRef.length + 1
                  textarea.setSelectionRange(newCursorPos, newCursorPos)
                }, 0)
                
                // Visual feedback for insertion
                const target = e.target as HTMLElement
                const originalBg = target.className
                target.className = originalBg.replace('bg-blue-100', 'bg-purple-100').replace('text-blue-800', 'text-purple-800')
                setTimeout(() => {
                  target.className = originalBg
                }, 500)
                
                console.log(`✅ Inserted reference: ${nodeRef}`)
              } else {
                // Copy to clipboard
                try {
                  await navigator.clipboard.writeText(nodeRef)
                  // Visual feedback for copy
                  const target = e.target as HTMLElement
                  const originalBg = target.className
                  target.className = originalBg.replace('bg-blue-100', 'bg-green-100').replace('text-blue-800', 'text-green-800')
                  setTimeout(() => {
                    target.className = originalBg
                  }, 500)
                  console.log(`📋 Copied reference: ${nodeRef}`)
                } catch (err) {
                  console.error('Failed to copy to clipboard:', err)
                }
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
      <div className="mb-2">
        <p className="text-xs font-medium text-gray-600 mb-1">Assistant:</p>
        {node.status === 'streaming' ? (
          <div className="py-2">
            <StreamingAnimation />
          </div>
        ) : node.response ? (
          <p className="text-sm text-gray-700">{truncateText(node.response, 80)}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">Waiting for response...</p>
        )}
      </div>

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


      <Handle type="source" position={Position.Bottom} />
    </div>
  )
})

MessageNode.displayName = 'MessageNode'