'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { Session, ChatNode, ModelId, AVAILABLE_MODELS } from '@/types'

import { GlassmorphismChatInput } from '@/components/chat/glassmorphism-chat-input'

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
    console.log('🔍 Node ID clicked:', nodeReference, 'Input focused:', isInputFocused, 'Insert function:', !!insertTextFunction)
    if (isInputFocused && insertTextFunction) {
      insertTextFunction(nodeReference + ' ')
    } else {
      // Copy to clipboard as fallback
      navigator.clipboard.writeText(nodeReference)
        .then(() => console.log('📋 Copied to clipboard:', nodeReference))
        .catch(err => console.error('Failed to copy:', err))
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

      console.log(`Frontend debug: parentNode=${parentNode?.id}, currentNodeId=${currentNodeId}`)
      
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

  // Poll for node status updates
  const pollNodeStatus = async (nodeId: string) => {
    const maxAttempts = 60 // 5 minutes maximum (5s * 60)
    let attempts = 0

    const checkStatus = async () => {
      if (attempts >= maxAttempts) {
        console.log('Polling timeout for node:', nodeId)
        return
      }

      try {
        const response = await fetch(`/api/sessions/${session?.id}`)
        if (response.ok) {
          const { data } = await response.json()
          const { chatNodes: updatedNodes } = data
          const updatedNode = updatedNodes.find((n: any) => n.id === nodeId)
          
          if (updatedNode && updatedNode.status !== 'streaming') {
            // Node has been completed or failed, update the UI
            setChatNodes(updatedNodes)
            console.log(`Node ${nodeId} updated with status: ${updatedNode.status}`)
            return // Stop polling
          }
          
          // Continue polling if still streaming
          attempts++
          setTimeout(checkStatus, 5000) // Poll every 5 seconds
        }
      } catch (error) {
        console.error('Error polling node status:', error)
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
      />
    </div>
  )
}