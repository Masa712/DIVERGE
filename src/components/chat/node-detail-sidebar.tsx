'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Copy, User, Bot, Settings, ChevronLeft, ChevronRight, ArrowUp, MessageCircle, Clock, Edit2, Trash2, RefreshCw } from 'lucide-react'
import { ChatNode } from '@/types'
import { useComments } from '@/hooks/useComments'
import { StreamingAnimation } from '@/components/ui/streaming-animation'

interface Props {
  node: ChatNode | null
  allNodes: ChatNode[]
  isOpen: boolean
  onClose: () => void
  session?: { id: string; name: string } | null
  onModelChange?: (nodeId: string, model: string) => void
  onWidthChange?: (width: number) => void
  onRetryNode?: (nodeId: string, prompt: string) => void
  onDeleteNode?: (nodeId: string) => void
}

export function NodeDetailSidebar({ node, allNodes, isOpen, onClose, session, onModelChange, onWidthChange, onRetryNode, onDeleteNode }: Props) {
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0)
  const [nodeChain, setNodeChain] = useState<ChatNode[]>([])
  const [width, setWidth] = useState(400) // Default width 400px (min 400px)
  const [isResizing, setIsResizing] = useState(false)
  const [comment, setComment] = useState('')
  const [isCommentLoading, setIsCommentLoading] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  
  // Get current display node (always get the latest version from allNodes)
  const currentDisplayNode = (() => {
    const chainNode = nodeChain[currentNodeIndex]
    if (!chainNode) return chainNode
    
    // Find the latest version of this node from allNodes
    const latestNode = allNodes.find(n => n.id === chainNode.id)
    return latestNode || chainNode
  })()

  // Check if current node has children (to determine if deletion is allowed)
  const hasChildren = useCallback((nodeId: string) => {
    return allNodes.some(node => node.parentId === nodeId)
  }, [allNodes])

  // Check if current node can be deleted
  const canDeleteCurrentNode = currentDisplayNode && !hasChildren(currentDisplayNode.id)
  
  // Use comments hook to fetch and manage comments
  const { comments, loading: commentsLoading, createComment, deleteComment, refetch } = useComments({
    nodeId: currentDisplayNode?.id,
    sessionId: session?.id
  })

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
    setComment('') // Reset comment when switching nodes
  }, [node, allNodes])

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || typeof window === 'undefined') return
    
    // Calculate width based on sidebar's right edge position (fixed at 30px from screen right)
    const sidebarRightEdge = window.innerWidth - 30
    const newWidth = Math.max(400, Math.min(800, sidebarRightEdge - e.clientX))
    
    setWidth(newWidth)
    onWidthChange?.(newWidth)
  }, [isResizing, onWidthChange])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Notify parent of width changes
  useEffect(() => {
    onWidthChange?.(width)
  }, [width, onWidthChange])

  // Handle comment save using the hook
  const handleSaveComment = async () => {
    if (!currentDisplayNode || !session || !comment.trim()) return

    setIsCommentLoading(true)

    const savedComment = await createComment({
      nodeId: currentDisplayNode.id,
      sessionId: session.id,
      content: comment.trim()
    })

    if (savedComment) {
      setComment('') // Clear comment on success
    }
    
    setIsCommentLoading(false)
  }
  
  // Handle comment delete
  const handleDeleteComment = async (commentId: string) => {
    const confirmed = confirm('Are you sure you want to delete this comment?')
    if (confirmed) {
      await deleteComment(commentId)
    }
  }

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
    <div>
      {/* Mobile/Tablet Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
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
          
          /* Desktop positioning - Override mobile styles */
          lg:right-[30px] lg:top-[25px] lg:bottom-[25px] lg:left-auto lg:w-auto lg:h-auto lg:max-h-none lg:max-w-none lg:translate-x-0 lg:translate-y-0
          
          /* Tablet/Mobile centered positioning */
          left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-[90vw] max-w-[400px] h-[85vh] max-h-[700px]
          md:w-[80vw] md:max-w-[400px] md:h-[80vh]
          
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
        {/* Invisible resize area - Left edge (no visual indicator) */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hidden lg:block z-10"
          onMouseDown={handleMouseDown}
        />
      
        {/* Header - Session Title */}
        <div className="px-6 pt-9 pb-4 border-b border-white/10">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-black">
              {session?.name || 'Chat Session'}
            </h1>
          </div>
        </div>

        {/* Navigation Chain */}
        {nodeChain.length > 1 && (
          <div className="px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sidebar-scroll mx-[30px]">
              {nodeChain.map((chainNode, index) => (
                <div key={chainNode.id} className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigateToNode(index)}
                    className={`transition-all duration-200 ${
                      index === currentNodeIndex
                        ? 'text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent scale-110'
                        : 'text-base text-gray-600 hover:text-gray-800 hover:scale-105'
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
                  {currentDisplayNode.status === 'streaming' ? (
                    <div className="py-4 flex items-start">
                      <StreamingAnimation />
                    </div>
                  ) : currentDisplayNode.status === 'failed' ? (
                    <div className="py-4 flex flex-col items-center space-y-3">
                      <div className="flex items-center space-x-2 text-red-600">
                        <span className="text-sm">Generation failed</span>
                      </div>
                      {currentDisplayNode.errorMessage && (
                        <p className="text-xs text-red-500 text-center">
                          {currentDisplayNode.errorMessage}
                        </p>
                      )}
                      <button
                        onClick={() => onRetryNode?.(currentDisplayNode.id, currentDisplayNode.prompt)}
                        className="flex items-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
                        title="Retry generation"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Retry</span>
                      </button>
                    </div>
                  ) : currentDisplayNode.response ? (
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {currentDisplayNode.response}
                    </p>
                  ) : (
                    <div className="py-4 text-center text-gray-400 text-sm italic">
                      Waiting for response...
                    </div>
                  )}
                </div>
              </div>

            {/* Comments Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Comments</h3>
                {comments.length > 0 && (
                  <span className="text-xs text-gray-500">({comments.length})</span>
                )}
              </div>
              
              {/* Comment Input */}
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add your thoughts about this response..."
                  className="w-full resize-none bg-transparent border-none text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none"
                  rows={3}
                  disabled={isCommentLoading}
                />
                {comment.trim() && (
                  <div className="mt-2 pt-2 border-t border-white/20">
                    <button
                      onClick={handleSaveComment}
                      disabled={isCommentLoading}
                      className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-700 rounded-full hover:from-blue-500/30 hover:to-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCommentLoading ? 'Saving...' : 'Save Comment'}
                    </button>
                  </div>
                )}
              </div>
              
              {/* Comments List */}
              <div className="mt-3">
                {commentsLoading ? (
                <div className="text-center py-3">
                  <span className="text-sm text-gray-500">Loading comments...</span>
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {comments.map((comment: any) => (
                    <div key={comment.id} className="bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="w-3 h-3 text-blue-600" />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(comment.created_at).toLocaleString('ja-JP', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</span>
                          </div>
                        </div>
                        {(
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="p-1 hover:bg-red-100/10 rounded transition-colors"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                      {comment.is_edited && (
                        <div className="flex items-center gap-1 mt-1">
                          <Edit2 className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">edited</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                ) : (
                  <div className="text-center py-3">
                    <span className="text-xs text-gray-500">No comments yet. Be the first to comment!</span>
                  </div>
                )}
              </div>
            </div>

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

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <Settings className="w-3.5 h-3.5 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Details</h3>
              </div>
              
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20 space-y-4">
                {/* Status */}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-600">Status</div>
                  <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentDisplayNode.status)}`}>
                    {currentDisplayNode.status.charAt(0).toUpperCase() + currentDisplayNode.status.slice(1)}
                  </div>
                </div>

                {/* Created */}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-600">Created</div>
                  <div className="text-sm text-gray-800">
                    {formatDate(currentDisplayNode.createdAt)}
                  </div>
                </div>

                {/* Node ID */}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-gray-600">Node ID</div>
                  <div className="text-sm text-gray-800 font-mono">
                    {currentDisplayNode.id.slice(-8)}
                  </div>
                </div>

                {/* Delete Node Section */}
                {canDeleteCurrentNode && (
                  <div className="pt-4 border-t border-white/20">
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this node? This action cannot be undone.')) {
                          onDeleteNode?.(currentDisplayNode.id)
                        }
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors"
                      title="Delete this node (only available if no child nodes exist)"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Node</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Close button - Mobile/Tablet only */}
        <div className="lg:hidden absolute top-4 right-4">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      </div>
    </div>
  )
}