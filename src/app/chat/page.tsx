'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { Session, ChatNode, ModelId, AVAILABLE_MODELS } from '@/types'
import { GlassmorphismChatInput } from '@/components/chat/glassmorphism-chat-input'

import { ChatTreeView } from '@/components/tree/chat-tree-view'
import { NodeDetailSidebar } from '@/components/chat/node-detail-sidebar'
import { LeftSidebar } from '@/components/layout/left-sidebar'

export default function ChatPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showError } = useError()
  
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [chatNodes, setChatNodes] = useState<ChatNode[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelId>('openai/gpt-4o')
  const [loadingSession, setLoadingSession] = useState(false)
  
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>(undefined)
  const [selectedNodeForDetail, setSelectedNodeForDetail] = useState<ChatNode | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  const fetchSession = async (sessionId: string) => {
    setLoadingSession(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (response.ok) {
        const { session, chatNodes } = await response.json()
        setCurrentSession(session)
        setChatNodes(chatNodes)
        // Set current node to the last node
        if (chatNodes.length > 0) {
          setCurrentNodeId(chatNodes[chatNodes.length - 1].id)
        }
      } else if (response.status === 404) {
        showError('Session not found')
      } else {
        showError('Failed to load session')
      }
    } catch (error) {
      console.error('Error fetching session:', error)
      showError('Failed to load session')
    } finally {
      setLoadingSession(false)
    }
  }

  const handleSessionSelect = (sessionId: string) => {
    fetchSession(sessionId)
  }

  const handleNewSession = () => {
    // Clear current session data when creating new session
    setCurrentSession(null)
    setChatNodes([])
    setCurrentNodeId(undefined)
    setSelectedNodeForDetail(null)
    setIsSidebarOpen(false)
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
    if (!currentSession) return

    try {
      // Use current selected node as parent, or the last node if none selected
      let parentNode = null
      if (currentNodeId) {
        parentNode = chatNodes.find(node => node.id === currentNodeId)
      } else if (chatNodes.length > 0) {
        // Find the most recently created node as default parent
        parentNode = chatNodes.reduce((latest, node) => 
          new Date(node.createdAt) > new Date(latest.createdAt) ? node : latest
        )
      }

      console.log(`Frontend debug: parentNode=${parentNode?.id}, currentNodeId=${currentNodeId}`)
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          model: selectedModel,
          sessionId: currentSession.id,
          parentNodeId: parentNode?.id,
          useEnhancedContext: true, // Explicitly enable enhanced context
        }),
      })

      if (response.ok) {
        // Refresh the session data to get updated nodes
        await fetchSession(currentSession.id)
        // Set the new node as current (it will be the last one created)
        const updatedResponse = await fetch(`/api/sessions/${currentSession.id}`)
        if (updatedResponse.ok) {
          const { chatNodes: updatedNodes } = await updatedResponse.json()
          if (updatedNodes.length > chatNodes.length) {
            const newNode = updatedNodes[updatedNodes.length - 1]
            setCurrentNodeId(newNode.id)
          }
        }
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

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <LeftSidebar
        currentSessionId={currentSession?.id}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        isCollapsed={isLeftSidebarCollapsed}
        onToggleCollapse={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
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
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
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
      />
    </div>
  )
}