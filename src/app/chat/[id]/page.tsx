'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { Session, ChatNode, ModelId, AVAILABLE_MODELS } from '@/types'

import { ChatInput } from '@/components/chat/chat-input'
import { ModelSelector } from '@/components/chat/model-selector'
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
  const [selectedModel, setSelectedModel] = useState<ModelId>('openai/gpt-4o')
  const [loadingSession, setLoadingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>(undefined)
  const [selectedNodeForDetail, setSelectedNodeForDetail] = useState<ChatNode | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

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
        const { session, chatNodes } = await response.json()
        setSession(session)
        setChatNodes(chatNodes)
        // Set current node to the last node
        if (chatNodes.length > 0) {
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

  const handleBranchCreate = async (parentNodeId: string, branchPrompt: string) => {
    if (!branchPrompt || !session) return

    try {
      const response = await fetch('/api/chat/branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentNodeId,
          sessionId: session.id,
          prompt: branchPrompt,
          model: selectedModel,
        }),
      })

      if (response.ok) {
        await fetchSession()
        showError('Branch created successfully!')
      } else {
        const errorData = await response.json().catch(() => ({}))
        showError(errorData.error || 'Failed to create branch')
      }
    } catch (error) {
      console.error('Error creating branch:', error)
      showError('Failed to create branch')
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

  const handleSendMessage = async (message: string) => {
    if (!session) return

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

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          model: selectedModel,
          sessionId: session.id,
          parentNodeId: parentNode?.id,
        }),
      })

      if (response.ok) {
        // Refresh the session data to get updated nodes
        await fetchSession()
        // Set the new node as current (it will be the last one created)
        const updatedResponse = await fetch(`/api/sessions/${session.id}`)
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
      <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ${
        isSidebarOpen ? 'mr-96' : ''
      }`}>
        <header className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/chat')}
                className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80"
              >
                ← Back
              </button>
              <div>
                <h1 className="font-semibold">{session.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {chatNodes.length} messages • ${(session.totalCostUsd || 0).toFixed(4)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                availableModels={AVAILABLE_MODELS}
              />
            </div>
          </div>
        </header>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ChatTreeView
              nodes={chatNodes}
              currentNodeId={currentNodeId}
              onNodeClick={handleNodeClick}
              onBranchCreate={handleBranchCreate}
            />
          </div>
          
          <div className="border-t p-4 bg-background">
            <div className="max-w-4xl mx-auto">
              {currentNodeId && (
                <div className="mb-3 text-sm text-muted-foreground">
                  <span className="font-medium">Continuing from:</span>{' '}
                  {(() => {
                    const currentNode = chatNodes.find(n => n.id === currentNodeId)
                    return currentNode ? currentNode.prompt.substring(0, 60) + '...' : 'Selected node'
                  })()}
                </div>
              )}
              <ChatInput onSendMessage={handleSendMessage} />
            </div>
          </div>
        </div>
      </div>

      {/* Node Detail Sidebar */}
      <NodeDetailSidebar
        node={selectedNodeForDetail}
        allNodes={chatNodes}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
      />
    </div>
  )
}