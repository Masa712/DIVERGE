'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { Session, ChatNode, ModelId, AVAILABLE_MODELS } from '@/types'
import { GlassmorphismChatInput } from '@/components/chat/glassmorphism-chat-input'
import { log } from '@/lib/utils/logger'
import { ChatTreeView } from '@/components/tree/chat-tree-view'
import { NodeDetailSidebar } from '@/components/chat/node-detail-sidebar'
import { FREE_PLAN_MODELS } from '@/lib/billing/model-restrictions'
import { useChatLayout } from '@/contexts/ChatLayoutContext'
import { readSSEStream } from '@/lib/utils/stream-reader'

interface UserProfile {
  default_model: ModelId | null
  default_temperature: number
  default_max_tokens: number
  subscription_plan?: string
}

export default function ChatPage() {
  log.debug('ChatPage component loaded')
  if (typeof window !== 'undefined') {
    (window as any).debugChatPageLoaded = true
    log.debug('Browser environment detected, set window.debugChatPageLoaded = true')
  }
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showError } = useError()
  const { isLeftSidebarCollapsed, isLeftSidebarMobileOpen } = useChatLayout()
  
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [chatNodes, setChatNodes] = useState<ChatNode[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelId>(FREE_PLAN_MODELS[0])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>(undefined)
  const [selectedNodeForDetail, setSelectedNodeForDetail] = useState<ChatNode | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(400) // Default 400px (min 400px)
  const [enableWebSearch, setEnableWebSearch] = useState(true) // Web search toggle
  const [enableReasoning, setEnableReasoning] = useState(false) // Reasoning toggle

  // Calculate available models based on user's subscription plan
  const availableModels = useMemo(() => {
    // While loading profile, show all models (will be disabled anyway)
    // This prevents flickering from free models to paid models
    if (profileLoading) {
      return AVAILABLE_MODELS
    }

    const userPlan = userProfile?.subscription_plan || 'free'

    // Free plan: only free plan models
    if (userPlan === 'free') {
      return AVAILABLE_MODELS.filter(model => FREE_PLAN_MODELS.includes(model.id))
    }

    // Plus, Pro, Enterprise: all models
    return AVAILABLE_MODELS
  }, [userProfile, profileLoading])

  useEffect(() => {
    log.debug('Auth check', { loading, userPresent: !!user })
    if (!loading && !user) {
      log.info('Redirecting unauthenticated user to /auth')
      router.push('/auth')
    }
  }, [user, loading, router])

  // Fetch user profile settings
  useEffect(() => {
    if (!user) return

    const fetchUserProfile = async () => {
      try {
        setProfileLoading(true)
        const response = await fetch('/api/profile')
        if (response.ok) {
          const { data } = await response.json()

          // If subscription_plan is not set, default to 'free'
          if (!data.subscription_plan) {
            data.subscription_plan = 'free'
          }

          setUserProfile({
            default_model: data.default_model,
            default_temperature: data.default_temperature,
            default_max_tokens: data.default_max_tokens,
            subscription_plan: data.subscription_plan
          })

          // Set selected model to user's default if available and allowed for their plan
          if (data.default_model) {
            const userPlan = data.subscription_plan || 'free'
            // For free plan, ensure the default model is in the allowed list
            if (userPlan === 'free') {
              if (FREE_PLAN_MODELS.includes(data.default_model as ModelId)) {
                setSelectedModel(data.default_model)
              } else {
                // Fallback to first free plan model if default is not allowed
                setSelectedModel(FREE_PLAN_MODELS[0])
                log.warn('User default model not allowed for free plan, using fallback', {
                  defaultModel: data.default_model,
                  fallbackModel: FREE_PLAN_MODELS[0]
                })
              }
            } else {
              setSelectedModel(data.default_model)
            }
          } else if (data.subscription_plan === 'free') {
            // No default model set and user is on free plan, use first free plan model
            setSelectedModel(FREE_PLAN_MODELS[0])
          }
        }
      } catch (error) {
        log.warn('Failed to load user profile', error)
        // Even on error, stop loading to avoid infinite disabled state
        setUserProfile({
          default_model: null,
          default_temperature: 0.7,
          default_max_tokens: 8000,
          subscription_plan: 'free'
        })
        // Use first free plan model as fallback
        setSelectedModel(FREE_PLAN_MODELS[0])
      } finally {
        setProfileLoading(false)
      }
    }

    fetchUserProfile()
  }, [user])


  const handleNodeClick = (nodeId: string) => {
    setCurrentNodeId(nodeId)
    
    // Find the clicked node and show its details in sidebar
    const clickedNode = chatNodes.find(node => node.id === nodeId)
    if (clickedNode) {
      setSelectedNodeForDetail(clickedNode)
      setIsSidebarOpen(true)
      
      // Set the model to the one used by the clicked node
      // This ensures replies use the same model as the parent node
      if (clickedNode.model) {
        setSelectedModel(clickedNode.model)
        log.debug('Set model to parent node model', { nodeId, model: clickedNode.model })
      }
    }
  }

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
    setSelectedNodeForDetail(null)
  }
  
  const handleBackgroundClick = () => {
    // When clicking on background, clear the current node selection
    setCurrentNodeId(undefined)
    
    // Reset to user's default model when no node is selected
    if (userProfile?.default_model) {
      setSelectedModel(userProfile.default_model)
      log.debug('Reset to default model', { model: userProfile.default_model })
    }
    
    handleCloseSidebar()
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

      log.debug('Message context', { parentNodeId: parentNode?.id, currentNodeId, enableWebSearch })

      // Use Function Calling endpoint for all models except GPT OSS 120B
      const apiEndpoint = selectedModel === 'openai/gpt-oss-120b'
                         ? '/api/chat'
                         : '/api/chat/with-tools'

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          model: selectedModel,
          temperature: userProfile?.default_temperature || 0.7,
          max_tokens: userProfile?.default_max_tokens || 8000,
          sessionId: currentSession.id,
          parentNodeId: parentNode?.id,
          useEnhancedContext: true,
          enableWebSearch,
          reasoning: enableReasoning,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to send message`
        showError(errorMessage)
        throw new Error(errorMessage)
      }

      // Read SSE stream for real-time response display
      await readSSEStream(response, {
        onNode: (node) => {
          const chatNode: ChatNode = {
            ...node,
            createdAt: new Date(node.createdAt),
            updatedAt: new Date(node.updatedAt),
          }
          log.info('Chat node received via SSE', { nodeId: chatNode.id })
          setChatNodes(prev => [...prev, chatNode])
          setCurrentNodeId(chatNode.id)
          setSelectedNodeForDetail(chatNode)
          setIsSidebarOpen(true)
        },
        onContent: (nodeId, chunk) => {
          setChatNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, response: (n.response || '') + chunk, status: 'streaming' as const } : n
          ))
          setSelectedNodeForDetail(prev =>
            prev?.id === nodeId ? { ...prev, response: (prev.response || '') + chunk, status: 'streaming' as const } : prev
          )
        },
        onSearchStart: (nodeId, query) => {
          log.debug('Web search started', { nodeId, query })
        },
        onSearchResults: (nodeId, results) => {
          log.debug('Web search results received', { nodeId, resultCount: results?.results?.length })
          setChatNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, metadata: { ...n.metadata, webSearchResults: results } } : n
          ))
          setSelectedNodeForDetail(prev =>
            prev?.id === nodeId ? { ...prev, metadata: { ...prev.metadata, webSearchResults: results } } : prev
          )
        },
        onTitle: (sessionId, title) => {
          log.info('Session title updated via SSE', { sessionId, title })
          setCurrentSession(prev => prev ? { ...prev, name: title } : prev)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('session-sync-needed'))
          }
        },
        onDone: (nodeId) => {
          log.info('Streaming completed', { nodeId })
          setChatNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, status: 'completed' as const } : n
          ))
          setSelectedNodeForDetail(prev =>
            prev?.id === nodeId ? { ...prev, status: 'completed' as const } : prev
          )
        },
        onError: (nodeId, error) => {
          log.error('Streaming error', { nodeId, error })
          setChatNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, status: 'failed' as const, errorMessage: error } : n
          ))
          setSelectedNodeForDetail(prev =>
            prev?.id === nodeId ? { ...prev, status: 'failed' as const, errorMessage: error } : prev
          )
          showError(error)
        },
      })
    } catch (error) {
      log.error('Error sending message', error)
      if (error instanceof Error) {
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

      // Use Function Calling endpoint for all models except GPT OSS 120B
      const apiEndpoint = failedNode.model === 'openai/gpt-oss-120b'
                         ? '/api/chat'
                         : '/api/chat/with-tools'

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: originalPrompt }],
          model: failedNode.model,
          temperature: userProfile?.default_temperature || 0.7,
          max_tokens: userProfile?.default_max_tokens || 8000,
          sessionId: currentSession.id,
          parentNodeId: parentNode?.id,
          useEnhancedContext: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to retry message`
        showError(errorMessage)
        return
      }

      // Delete the failed node
      try {
        await fetch(`/api/nodes/${nodeId}`, { method: 'DELETE' })
        log.info('Successfully deleted failed node', { nodeId })
      } catch (deleteError) {
        log.warn('Failed to delete node from database', deleteError)
      }

      // Remove failed node from UI
      setChatNodes(prev => prev.filter(node => node.id !== nodeId))

      // Read SSE stream for the retry
      await readSSEStream(response, {
        onNode: (node) => {
          const chatNode: ChatNode = {
            ...node,
            createdAt: new Date(node.createdAt),
            updatedAt: new Date(node.updatedAt),
          }
          setChatNodes(prev => [...prev, chatNode])
          setCurrentNodeId(chatNode.id)
          setSelectedNodeForDetail(chatNode)
          setIsSidebarOpen(true)
        },
        onContent: (nodeId, chunk) => {
          setChatNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, response: (n.response || '') + chunk, status: 'streaming' as const } : n
          ))
          setSelectedNodeForDetail(prev =>
            prev?.id === nodeId ? { ...prev, response: (prev.response || '') + chunk, status: 'streaming' as const } : prev
          )
        },
        onTitle: (sessionId, title) => {
          setCurrentSession(prev => prev ? { ...prev, name: title } : prev)
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('session-sync-needed'))
          }
        },
        onDone: (nodeId) => {
          setChatNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, status: 'completed' as const } : n
          ))
          setSelectedNodeForDetail(prev =>
            prev?.id === nodeId ? { ...prev, status: 'completed' as const } : prev
          )
        },
        onError: (nodeId, error) => {
          setChatNodes(prev => prev.map(n =>
            n.id === nodeId ? { ...n, status: 'failed' as const, errorMessage: error } : n
          ))
          setSelectedNodeForDetail(prev =>
            prev?.id === nodeId ? { ...prev, status: 'failed' as const, errorMessage: error } : prev
          )
          showError(error)
        },
      })
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
    <div className="flex flex-col flex-1 overflow-hidden">
        {currentSession ? (
          <>
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <ChatTreeView
                  nodes={chatNodes}
                  currentNodeId={currentNodeId}
                  onNodeClick={handleNodeClick}
                  onBackgroundClick={handleBackgroundClick}
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
              availableModels={availableModels}
              modelSelectorDisabled={profileLoading}
              enableWebSearch={enableWebSearch}
              onWebSearchToggle={setEnableWebSearch}
              enableReasoning={enableReasoning}
              onReasoningToggle={setEnableReasoning}
              currentNodeId={currentNodeId}
              currentNodePrompt={(() => {
                const currentNode = chatNodes.find(n => n.id === currentNodeId)
                return currentNode ? currentNode.prompt : undefined
              })()}
              isRightSidebarOpen={isSidebarOpen}
              isLeftSidebarCollapsed={isLeftSidebarCollapsed}
              rightSidebarWidth={rightSidebarWidth}
              isLeftSidebarMobileOpen={isLeftSidebarMobileOpen}
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