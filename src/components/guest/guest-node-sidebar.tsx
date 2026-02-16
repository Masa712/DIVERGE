'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Copy, User, Bot, Settings } from 'lucide-react'
import { ChatNode } from '@/types'
import { StreamingAnimation } from '@/components/ui/streaming-animation'
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer'

interface Props {
  node: ChatNode | null
  allNodes: ChatNode[]
  isOpen: boolean
  onClose: () => void
  onWidthChange?: (width: number) => void
}

const MIN_WIDTH = 350
const MAX_WIDTH = 800
const DEFAULT_WIDTH = 400

export function GuestNodeSidebar({ node, allNodes, isOpen, onClose, onWidthChange }: Props) {
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const previousNodeIdRef = useRef<string | null>(null)

  // Build node chain from root to current node
  const nodeChain = useCallback(() => {
    if (!node) return []

    const chain: ChatNode[] = []
    let current: ChatNode | undefined = node

    // Build path from current node to root
    while (current) {
      chain.unshift(current)
      current = allNodes.find(n => n.id === current?.parentId)
    }

    return chain
  }, [node, allNodes])

  const [currentNodeIndex, setCurrentNodeIndex] = useState(0)
  const chain = nodeChain()
  const currentDisplayNode = chain[currentNodeIndex] || node

  // Reset to latest node when node prop changes
  useEffect(() => {
    if (node?.id !== previousNodeIdRef.current) {
      const newChain = nodeChain()
      setCurrentNodeIndex(newChain.length - 1)
      previousNodeIdRef.current = node?.id || null
    }
  }, [node?.id, nodeChain])

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = window.innerWidth - e.clientX - 30
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setWidth(newWidth)
        onWidthChange?.(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, onWidthChange])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatDate = (date: Date) => {
    try {
      const d = new Date(date)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    } catch {
      return 'Unknown'
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

  const getModelDisplayName = (model: string) => {
    if (model.includes('/')) {
      const parts = model.split('/')
      return parts[1] || model
    }
    return model
  }

  if (!isOpen || !currentDisplayNode) return null

  return (
    <div>
      {/* Mobile/Tablet Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Responsive Right Sidebar */}
      <div
        ref={sidebarRef}
        className={`
          fixed z-50 flex flex-col glass-test glass-blur border border-white/20
          shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem]
          transition-all duration-300

          /* Desktop positioning */
          lg:right-[30px] lg:top-[90px] lg:bottom-[120px] lg:left-auto lg:w-auto lg:h-auto lg:max-h-none lg:max-w-none lg:translate-x-0 lg:translate-y-0

          /* Tablet/Mobile centered positioning */
          left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-[90vw] max-w-[400px] h-[80vh] max-h-[600px]
          md:w-[80vw] md:max-w-[400px] md:h-[75vh]

          /* Show/hide states */
          ${isOpen
            ? 'scale-100 opacity-100 pointer-events-auto'
            : 'scale-95 opacity-0 pointer-events-none'
          }
        `}
        style={{
          width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${width}px` : undefined,
          transition: isResizing ? 'none' : undefined,
        }}
      >
        {/* Invisible resize area - Left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hidden lg:block z-10"
          onMouseDown={handleMouseDown}
        />

        {/* Header */}
        <div className="px-6 pt-8 pb-4 border-b border-white/10">
          <div className="text-center">
            <h1 className="text-xl font-bold text-black">
              Message Details
            </h1>
          </div>
        </div>

        {/* Sign Up CTA */}
        <div className="px-6 py-3 border-b border-white/10">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-3 border border-blue-200/30">
            <p className="text-sm text-gray-700 mb-2">
              Sign up for free to unlock:
            </p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Unlimited messages per session</li>
              <li>• Web search with AI responses</li>
              <li>• Save your conversations</li>
              <li>• Access to more AI models</li>
            </ul>
          </div>
        </div>

        {/* Navigation Chain */}
        {chain.length > 1 && (
          <div className="px-6 py-3 border-b border-white/10">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {chain.map((chainNode, index) => (
                <div key={chainNode.id} className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setCurrentNodeIndex(index)}
                    className={`transition-all duration-200 ${
                      index === currentNodeIndex
                        ? 'text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent scale-110'
                        : 'text-sm text-gray-600 hover:text-gray-800 hover:scale-105'
                    }`}
                    title={chainNode.prompt.substring(0, 50) + '...'}
                  >
                    {index + 1}
                  </button>
                  {index < chain.length - 1 && (
                    <div className="w-3 h-0.5 bg-gray-400 rounded-full" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-5">

            {/* User Prompt Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                  <User className="w-3 h-3 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">You</h3>
                <button
                  onClick={() => copyToClipboard(currentDisplayNode.prompt)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Copy prompt"
                >
                  <Copy className="w-3 h-3 text-gray-500" />
                </button>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/20">
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {currentDisplayNode.prompt}
                </p>
              </div>
            </div>

            {/* AI Response Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                  <Bot className="w-3 h-3 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">AI Response</h3>

                {/* Model Tag */}
                <span className="px-2 py-0.5 text-xs font-medium bg-green-100/70 text-green-800 rounded-full">
                  {getModelDisplayName(currentDisplayNode.model)}
                </span>

                {currentDisplayNode.response && (
                  <button
                    onClick={() => copyToClipboard(currentDisplayNode.response!)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                    title="Copy response"
                  >
                    <Copy className="w-3 h-3 text-gray-500" />
                  </button>
                )}
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/20">
                {currentDisplayNode.status === 'streaming' ? (
                  <div className="py-3 flex items-start">
                    <StreamingAnimation />
                  </div>
                ) : currentDisplayNode.status === 'failed' ? (
                  <div className="py-3 text-center">
                    <span className="text-sm text-red-600">Generation failed</span>
                    {currentDisplayNode.errorMessage && (
                      <p className="text-xs text-red-500 mt-1">
                        {currentDisplayNode.errorMessage}
                      </p>
                    )}
                  </div>
                ) : currentDisplayNode.response ? (
                  <MarkdownRenderer
                    content={currentDisplayNode.response}
                    className="text-sm leading-relaxed"
                  />
                ) : (
                  <div className="py-3 text-center text-gray-400 text-sm italic">
                    Waiting for response...
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                  <Settings className="w-3 h-3 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">Details</h3>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/20 space-y-3">
                {/* Status */}
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(currentDisplayNode.status)}`}>
                    {currentDisplayNode.status.charAt(0).toUpperCase() + currentDisplayNode.status.slice(1)}
                  </span>
                </div>

                {/* Created */}
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600">Created</span>
                  <span className="text-xs text-gray-800">
                    {formatDate(currentDisplayNode.createdAt)}
                  </span>
                </div>

                {/* Depth */}
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600">Depth</span>
                  <span className="text-xs text-gray-800">
                    {currentDisplayNode.depth}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
