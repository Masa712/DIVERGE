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
import { LeftSidebar } from '@/components/layout/left-sidebar'

export default function ChatPage() {
  log.debug('ChatPage component loaded')
  if (typeof window !== 'undefined') {
    (window as any).debugChatPageLoaded = true
    log.debug('Browser environment detected, set window.debugChatPageLoaded = true')
  }
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showError } = useError()
  
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [chatNodes, setChatNodes] = useState<ChatNode[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelId>('openai/gpt-4o-2024-11-20')
  const [loadingSession, setLoadingSession] = useState(false)
  
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>(undefined)
  const [selectedNodeForDetail, setSelectedNodeForDetail] = useState<ChatNode | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(400) // Default 400px (min 400px)
  const [isLeftSidebarMobileOpen, setIsLeftSidebarMobileOpen] = useState(false)

  useEffect(() => {
    log.debug('Auth check', { loading, userPresent: !!user })
    if (!loading && !user) {
      log.info('Redirecting unauthenticated user to /auth')
      router.push('/auth')
    }
  }, [user, loading, router])

  const fetchSession = async (sessionId: string) => {
    log.info('Fetching session', { sessionId })
    setLoadingSession(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (response.ok) {
        const { data } = await response.json()
        const { session, chatNodes } = data
        log.info('Session loaded successfully', { sessionId: session.id, sessionName: session.name, nodeCount: chatNodes?.length || 0 })
        setCurrentSession(session)
        setChatNodes(chatNodes || [])
        // Set current node to the last node
        if (chatNodes && chatNodes.length > 0) {
          setCurrentNodeId(chatNodes[chatNodes.length - 1].id)
        }
      } else if (response.status === 404) {
        log.warn('Session not found', { sessionId })
        showError('Session not found. It may have been deleted.')
        // Clear current session and trigger sidebar refresh
        setCurrentSession(null)
        setChatNodes([])
        setCurrentNodeId(undefined)
        // Trigger sidebar refresh by calling onNewSession
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('session-sync-needed'))
        }
      } else {
        log.error('Session fetch failed', { status: response.status })
        showError('Failed to load session')
      }
    } catch (error) {
      log.error('Error fetching session', error)
      showError('Failed to load session')
    } finally {
      setLoadingSession(false)
    }
  }

  const handleSessionSelect = (sessionId: string) => {
    fetchSession(sessionId)
    // Close right sidebar when switching sessions
    setIsSidebarOpen(false)
    setSelectedNodeForDetail(null)
  }

  const handleNewSession = () => {
    // Clear current session data when creating new session
    setCurrentSession(null)
    setChatNodes([])
    setCurrentNodeId(undefined)
    setSelectedNodeForDetail(null)
    setIsSidebarOpen(false)
  }

  const handleLeftSidebarAutoCollapse = (collapsed: boolean) => {
    setIsLeftSidebarCollapsed(collapsed)
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

  const handleSendMessage = async (message: string) => {
    log.info('Sending message', { messageLength: message.length, sessionId: currentSession?.id })
    if (!currentSession) {
      log.warn('No current session, aborting message send')
      return
    }

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
          sessionId: currentSession.id,
          parentNodeId: parentNode?.id,
          useEnhancedContext: true, // Explicitly enable enhanced context
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const newNode = result.data.node
        log.info('Chat response received', { nodeId: newNode.id, status: newNode.status })
        
        // Immediately add the streaming node to the UI
        setChatNodes(prev => [...prev, newNode])
        setCurrentNodeId(newNode.id)
        
        // Automatically open right sidebar with the new node details
        setSelectedNodeForDetail(newNode)
        setIsSidebarOpen(true)
        
        // Start polling for node updates
        log.debug('Initiating node polling', { nodeId: newNode.id })
        pollNodeStatus(newNode.id)
      } else {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to send message`
        showError(errorMessage)
        throw new Error(errorMessage)
      }
    } catch (error) {
      log.error('Error sending message', error)
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
    if (!currentSession) return

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
          sessionId: currentSession.id,
          parentNodeId: parentNode?.id,
          useEnhancedContext: true,
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
      log.error('Error retrying message', error)
      showError('Network error. Please check your connection.')
    }
  }

  const handleDeleteNode = async (nodeId: string) => {
    if (!currentSession) return

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
    log.debug('Starting node polling', { nodeId })
    const maxAttempts = 60 // 5 minutes maximum (5s * 60)
    let attempts = 0

    const checkStatus = async () => {
      if (attempts >= maxAttempts) {
        log.warn('Polling timeout for node', { nodeId })
        return
      }

      try {
        log.debug('Polling attempt', { attempt: attempts + 1, nodeId })
        const response = await fetch(`/api/sessions/${currentSession?.id}`)
        if (response.ok) {
          const { data } = await response.json()
          const { session, chatNodes: updatedNodes } = data
          const updatedNode = updatedNodes.find((n: any) => n.id === nodeId)
          
          // Debug: Log session name comparison
          log.debug('Polling status check', { 
            currentSessionName: currentSession?.name, 
            fetchedSessionName: session?.name,
            nodeId, 
            nodeStatus: updatedNode?.status 
          })
          
          // Update session info if name changed (e.g., AI-generated title)
          if (session && session.name !== currentSession?.name) {
            setCurrentSession(session)
            log.info('Session title updated', { sessionName: session.name })
          }
          
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
            
            // Trigger session list refresh when node completes
            if (typeof window !== 'undefined') {
              log.debug('Triggering session list refresh after node completion')
              window.dispatchEvent(new CustomEvent('session-sync-needed'))
            }
            
            return // Stop polling
          }
          
          // Continue polling if still streaming
          attempts++
          // Poll faster in the first few attempts to catch title updates quickly
          const pollInterval = attempts <= 10 ? 1000 : 3000 // First 10 attempts: 1s, then 3s
          setTimeout(checkStatus, pollInterval)
        }
      } catch (error) {
        log.error('Error polling node status', error)
        attempts++
        if (attempts < maxAttempts) {
          const pollInterval = attempts <= 10 ? 1000 : 3000 // First 10 attempts: 1s, then 3s
          setTimeout(checkStatus, pollInterval)
        }
      }
    }

    // Start polling after a short delay
    setTimeout(checkStatus, 500) // Initial check after 0.5 seconds for faster detection
  }

  if (loading || !user) {
    log.debug('ChatPage showing loading state')
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  log.debug('ChatPage rendering main content', { currentSessionId: currentSession?.id })

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <LeftSidebar
        currentSessionId={currentSession?.id}
        currentSession={currentSession}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        isCollapsed={isLeftSidebarCollapsed}
        onToggleCollapse={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
        onMobileOpenChange={setIsLeftSidebarMobileOpen}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {currentSession ? (
          <>
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <ChatTreeView
                  nodes={chatNodes}
                  currentNodeId={currentNodeId}
                  onNodeClick={handleNodeClick}
                  onBackgroundClick={handleCloseSidebar}
                  isLeftSidebarCollapsed={isLeftSidebarCollapsed}
                  isRightSidebarOpen={isSidebarOpen}
                  rightSidebarWidth={rightSidebarWidth}
                />
              </div>
            </div>

            {/* Glassmorphism Chat Input - Floating */}
            <GlassmorphismChatInput 
              onSendMessage={handleSendMessage} 
              availableNodes={chatNodes}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              currentNodeId={currentNodeId}
              currentNodePrompt={(() => {
                const currentNode = chatNodes.find(n => n.id === currentNodeId)
                return currentNode ? currentNode.prompt : undefined
              })()}
              isRightSidebarOpen={isSidebarOpen}
              isLeftSidebarCollapsed={isLeftSidebarCollapsed}
              rightSidebarWidth={rightSidebarWidth}
              onLeftSidebarAutoCollapse={handleLeftSidebarAutoCollapse}
              isLeftSidebarMobileOpen={isLeftSidebarMobileOpen}
            />
          </>
        ) : (
          <div 
            className="flex-1 flex items-center justify-center"
            style={{
              marginLeft: (() => {
                const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
                const isMobile = screenWidth < 768
                const isTablet = screenWidth >= 768 && screenWidth < 1024
                
                if (isMobile || isTablet) {
                  return '0px'
                } else {
                  return isLeftSidebarCollapsed ? '64px' : '350px'
                }
              })(),
              marginRight: isSidebarOpen ? `${rightSidebarWidth}px` : '0px'
            }}
          >
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Welcome to Diverge
              </h2>
              <p className="text-gray-600 mb-6">
                Select a chat session from the sidebar or create a new one to get started.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Node Detail Sidebar */}
      <NodeDetailSidebar
        node={selectedNodeForDetail}
        allNodes={chatNodes}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        session={currentSession}
        onWidthChange={setRightSidebarWidth}
        onRetryNode={handleRetryNode}
        onDeleteNode={handleDeleteNode}
      />
    </div>
  )
}