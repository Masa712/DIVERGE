'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { Session, ChatNode, ModelId, AVAILABLE_MODELS } from '@/types'

import { GlassmorphismChatInput } from '@/components/chat/glassmorphism-chat-input'
import { log } from '@/lib/utils/logger'
import { ChatTreeView } from '@/components/tree/chat-tree-view'
import { NodeDetailSidebar } from '@/components/chat/node-detail-sidebar'

interface Props {
  params: { id: string }
}

export default function ChatSessionPage({ params }: Props) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showError } = useError()
  const [session, setSession] = useState<Session | null>(null)
  const [chatNodes, setChatNodes] = useState<ChatNode[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelId>('openai/gpt-4o-2024-11-20')
  const [loadingSession, setLoadingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>(undefined)
  const [selectedNodeForDetail, setSelectedNodeForDetail] = useState<ChatNode | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [insertTextFunction, setInsertTextFunction] = useState<((text: string) => void) | null>(null)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(400) // Default 400px (min 400px)
  const [enableReasoning, setEnableReasoning] = useState(false) // Reasoning toggle

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && params.id) {
      fetchSession()
    }
  }, [user, params.id])

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${params.id}`)
      if (response.ok) {
        const { data } = await response.json()
        const { session, chatNodes } = data
        setSession(session)
        setChatNodes(chatNodes || [])
        // Set current node to the last node
        if (chatNodes && chatNodes.length > 0) {
          setCurrentNodeId(chatNodes[chatNodes.length - 1].id)
        }
      } else if (response.status === 404) {
        setError('Session not found')
      } else {
        setError('Failed to load session')
      }
    } catch (error) {
      console.error('Error fetching session:', error)
      setError('Failed to load session')
    } finally {
      setLoadingSession(false)
    }
  }

  const handleNodeClick = (nodeId: string) => {
    setCurrentNodeId(nodeId)
    
    // Find the clicked node and show its details in sidebar
    const clickedNode = chatNodes.find(node => node.id === nodeId)
    if (clickedNode) {
      setSelectedNodeForDetail(clickedNode)
      setIsSidebarOpen(true)
    }
  }

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
    setSelectedNodeForDetail(null)
  }

  const handleNodeIdClick = (nodeReference: string) => {
    log.debug('Node ID clicked', { nodeReference, isInputFocused, hasInsertFunction: !!insertTextFunction })
    if (isInputFocused && insertTextFunction) {
      insertTextFunction(nodeReference + ' ')
    } else {
      // Copy to clipboard as fallback
      navigator.clipboard.writeText(nodeReference)
        .then(() => log.debug('Copied to clipboard', { nodeReference }))
        .catch(err => log.error('Failed to copy to clipboard', err))
    }
  }

  const handleSendMessage = async (message: string) => {
    if (!session) return

    try {
      // Use current selected node as parent, or the last node if none selected
      let parentNode = null
      if (currentNodeId) {
        parentNode = chatNodes.find(node => node.id === currentNodeId)
      } else if (chatNodes && chatNodes.length > 0) {
        // Find the most recently created node as default parent
        parentNode = chatNodes.reduce((latest, node) => 
          new Date(node.createdAt) > new Date(latest.createdAt) ? node : latest
        )
      }

      log.debug('Message context', { parentNodeId: parentNode?.id, currentNodeId })
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          model: selectedModel,
          max_tokens: 8000, // Ensure sufficient tokens for complete responses
          sessionId: session.id,
          parentNodeId: parentNode?.id,
          useEnhancedContext: true, // Explicitly enable enhanced context
          reasoning: enableReasoning,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const newNode = result.data.node
        
        // Immediately add the streaming node to the UI
        setChatNodes(prev => [...prev, newNode])
        setCurrentNodeId(newNode.id)
        
        // Automatically open right sidebar with the new node details
        setSelectedNodeForDetail(newNode)
        setIsSidebarOpen(true)
        
        // Start polling for node updates
        pollNodeStatus(newNode.id)
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to send message`
        showError(errorMessage)
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      if (error instanceof Error) {
        // Error already handled above or network error
        if (!error.message.includes('HTTP')) {
          showError('Network error. Please check your connection.')
        }
      } else {
        showError('An unexpected error occurred.')
      }
      throw error // Re-throw so ChatInput can handle message restoration
    }
  }

  const handleRetryNode = async (nodeId: string, originalPrompt: string) => {
    if (!session) return

    try {
      // Find the failed node to get its parent
      const failedNode = chatNodes.find(node => node.id === nodeId)
      if (!failedNode) return

      // Use the same parent as the failed node
      const parentNode = failedNode.parentId ? chatNodes.find(node => node.id === failedNode.parentId) : null

      log.info('Retrying failed node', { nodeId, promptLength: originalPrompt.length })
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: originalPrompt }],
          model: failedNode.model,
          max_tokens: 8000,
          sessionId: session.id,
          parentNodeId: parentNode?.id,
          useEnhancedContext: true,
          reasoning: enableReasoning,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const newNode = result.data.node
        
        // Delete the failed node
        try {
          await fetch(`/api/nodes/${nodeId}`, {
            method: 'DELETE',
          })
          log.info('Successfully deleted failed node', { nodeId })
        } catch (deleteError) {
          log.warn('Failed to delete node from database', deleteError)
          // Continue with UI update even if deletion fails
        }
        
        // Remove failed node from UI and add the new retry node
        setChatNodes(prev => {
          const filteredNodes = prev.filter(node => node.id !== nodeId)
          return [...filteredNodes, newNode]
        })
        setCurrentNodeId(newNode.id)
        
        // Update sidebar to show the new node
        setSelectedNodeForDetail(newNode)
        setIsSidebarOpen(true)
        
        // Start polling for the new node
        pollNodeStatus(newNode.id)
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to retry message`
        showError(errorMessage)
      }
    } catch (error) {
      console.error('Error retrying message:', error)
      showError('Network error. Please check your connection.')
    }
  }

  const handleDeleteNode = async (nodeId: string) => {
    if (!session) return

    try {
      // Check if node has children (safety check on frontend)
      const hasChildren = chatNodes.some(node => node.parentId === nodeId)
      if (hasChildren) {
        showError('Cannot delete node with child nodes')
        return
      }

      log.info('Deleting node', { nodeId })
      
      const response = await fetch(`/api/nodes/${nodeId}`, {
        method: 'DELETE',
      })
      
      log.debug('Delete response status', { status: response.status })

      if (response.ok) {
        // Remove node from UI
        setChatNodes(prev => prev.filter(node => node.id !== nodeId))
        
        // Close sidebar if deleted node was being displayed
        if (selectedNodeForDetail?.id === nodeId) {
          setIsSidebarOpen(false)
          setSelectedNodeForDetail(null)
        }
        
        // Reset current node if it was the deleted one
        if (currentNodeId === nodeId) {
          const remainingNodes = chatNodes.filter(node => node.id !== nodeId)
          if (remainingNodes.length > 0) {
            setCurrentNodeId(remainingNodes[remainingNodes.length - 1].id)
          } else {
            setCurrentNodeId(undefined)
          }
        }
        
        log.info('Successfully deleted node', { nodeId })
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to delete node`
        showError(errorMessage)
      }
    } catch (error) {
      log.error('Error deleting node', error)
      showError('Network error. Please check your connection.')
    }
  }

  // Poll for node status updates
  const pollNodeStatus = async (nodeId: string) => {
    const maxAttempts = 60 // 5 minutes maximum (5s * 60)
    let attempts = 0

    const checkStatus = async () => {
      if (attempts >= maxAttempts) {
        log.warn('Polling timeout for node', { nodeId })
        return
      }

      try {
        const response = await fetch(`/api/sessions/${session?.id}`)
        if (response.ok) {
          const { data } = await response.json()
          const { chatNodes: updatedNodes } = data
          const updatedNode = updatedNodes.find((n: any) => n.id === nodeId)
          
          if (updatedNode && updatedNode.status !== 'streaming') {
            // Node has been completed or failed, update only this specific node
            setChatNodes(prev => {
              // Check if the node still exists in our local state (not deleted)
              const nodeExists = prev.some(node => node.id === nodeId)
              if (!nodeExists) {
                log.debug('Node was deleted locally, skipping update', { nodeId })
                return prev // Don't update if node was deleted
              }
              
              // Update only the specific node that was polled
              return prev.map(node => 
                node.id === nodeId ? updatedNode : node
              )
            })
            log.info('Node polling completed', { nodeId, status: updatedNode.status })
            return // Stop polling
          }
          
          // Continue polling if still streaming
          attempts++
          setTimeout(checkStatus, 5000) // Poll every 5 seconds
        }
      } catch (error) {
        log.error('Error polling node status', error)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000)
        }
      }
    }

    // Start polling after a short delay
    setTimeout(checkStatus, 2000) // Initial check after 2 seconds
  }

  if (loading || loadingSession || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => router.push('/chat')}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Chat
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Session not found</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ChatTreeView
              nodes={chatNodes}
              currentNodeId={currentNodeId}
              onNodeClick={handleNodeClick}
              onNodeIdClick={handleNodeIdClick}
              onBackgroundClick={handleCloseSidebar}
              isLeftSidebarCollapsed={true}
              isRightSidebarOpen={isSidebarOpen}
              rightSidebarWidth={rightSidebarWidth}
            />
          </div>
        </div>
      </div>

      {/* Glassmorphism Chat Input - Floating */}
      <GlassmorphismChatInput 
        onSendMessage={handleSendMessage} 
        availableNodes={chatNodes}
        onInputMount={setInsertTextFunction}
        onFocusChange={setIsInputFocused}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        enableReasoning={enableReasoning}
        onReasoningToggle={setEnableReasoning}
        currentNodeId={currentNodeId}
        currentNodePrompt={(() => {
          const currentNode = chatNodes.find(n => n.id === currentNodeId)
          return currentNode ? currentNode.prompt : undefined
        })()}
        isRightSidebarOpen={isSidebarOpen}
        isLeftSidebarCollapsed={true}
        rightSidebarWidth={rightSidebarWidth}
      />

      {/* Node Detail Sidebar */}
      <NodeDetailSidebar
        node={selectedNodeForDetail}
        allNodes={chatNodes}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        session={session}
        onWidthChange={setRightSidebarWidth}
        onRetryNode={handleRetryNode}
        onDeleteNode={handleDeleteNode}
      />
    </div>
  )
}