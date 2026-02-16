'use client'

import { useEffect, useRef } from 'react'
import { GuestNode } from '@/lib/guest/guest-session'
import { UserCircleIcon, SparklesIcon } from '@heroicons/react/24/outline'
import ReactMarkdown from 'react-markdown'

interface Props {
  nodes: GuestNode[]
  currentNodeId?: string
  onNodeClick: (nodeId: string) => void
}

export function GuestChatView({ nodes, currentNodeId, onNodeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [nodes])

  // Sort nodes by creation time
  const sortedNodes = [...nodes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  return (
    <div ref={containerRef} className="space-y-4 py-4">
      {sortedNodes.map((node) => (
        <div
          key={node.id}
          className={`cursor-pointer transition-all duration-200 ${
            currentNodeId === node.id ? 'scale-[1.01]' : ''
          }`}
          onClick={() => onNodeClick(node.id)}
        >
          {/* User Message */}
          <div className="flex items-start space-x-3 mb-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <UserCircleIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700 mb-1">You</div>
              <div className="bg-white/60 backdrop-blur-sm rounded-lg px-4 py-3 shadow-sm border border-white/30">
                <p className="text-gray-900 whitespace-pre-wrap">{node.prompt}</p>
              </div>
            </div>
          </div>

          {/* AI Response */}
          <div className="flex items-start space-x-3 ml-8">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {node.model.includes('claude') ? 'Claude' : 'GPT'}
                </span>
                {node.status === 'streaming' && (
                  <span className="text-xs text-blue-500 animate-pulse">
                    Generating...
                  </span>
                )}
                {node.status === 'error' && (
                  <span className="text-xs text-red-500">Error</span>
                )}
              </div>
              <div
                className={`bg-white/60 backdrop-blur-sm rounded-lg px-4 py-3 shadow-sm border ${
                  currentNodeId === node.id
                    ? 'border-blue-300 ring-2 ring-blue-100'
                    : 'border-white/30'
                } ${node.status === 'error' ? 'border-red-200 bg-red-50/60' : ''}`}
              >
                {node.status === 'streaming' && !node.response ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none text-gray-900">
                    <ReactMarkdown>{node.response || ''}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
