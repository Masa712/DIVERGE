'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { Session, ChatNode, ModelId, AVAILABLE_MODELS, UserProfile } from '@/types'

import { GlassmorphismChatInput } from '@/components/chat/glassmorphism-chat-input'
import { log } from '@/lib/utils/logger'
import { ChatTreeView } from '@/components/tree/chat-tree-view'
import { NodeDetailSidebar } from '@/components/chat/node-detail-sidebar'
import { FREE_PLAN_MODELS } from '@/lib/billing/model-restrictions'
import { useChatLayout } from '@/contexts/ChatLayoutContext'
import { useUserNotes } from '@/hooks/useUserNotes'
import { UserNoteEditorModal } from '@/components/chat/user-note-editor-modal'

interface Props {
  params: { id: string }
}

export default function ChatSessionPage({ params }: Props) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { showError } = useError()
  const { isLeftSidebarCollapsed, isLeftSidebarMobileOpen } = useChatLayout()
  const [session, setSession] = useState<Session | null>(null)
  const [chatNodes, setChatNodes] = useState<ChatNode[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelId>(FREE_PLAN_MODELS[0])
  const [loadingSession, setLoadingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNotFound, setShowNotFound] = useState(false)

  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>(undefined)
  const [selectedNodeForDetail, setSelectedNodeForDetail] = useState<ChatNode | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [insertTextFunction, setInsertTextFunction] = useState<((text: string) => void) | null>(null)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(400) // Default 400px (min 400px)
  const [enableReasoning, setEnableReasoning] = useState(false) // Reasoning toggle
  const [enableWebSearch, setEnableWebSearch] = useState(true) // Web search toggle (default: true)
  const [webSearchQuota, setWebSearchQuota] = useState<{ allowed: boolean; currentUsage: number; limit: number } | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  // User notes feature
  const [enableUserNoteMode, setEnableUserNoteMode] = useState(false)
  const [editingNote, setEditingNote] = useState<ChatNode | null>(null)
  const { createNote, updateNote } = useUserNotes()

  // Calculate available models based on user's subscription plan
  const availableModels = useMemo(() => {
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
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && params.id) {
      // Reset states when session changes
      setShowNotFound(false)
      setError(null)
      setLoadingSession(true)

      fetchSession()
      fetchUserProfile()
      fetchWebSearchQuota()

      // Show "Session not found" after 10 seconds if still loading
      const timeoutId = setTimeout(() => {
        if (loadingSession && !session) {
          setShowNotFound(true)
        }
      }, 10000)

      return () => clearTimeout(timeoutId)
    }
  }, [user, params.id])
  
  const fetchUserProfile = async () => {
    if (!user) return

    setProfileLoading(true)

    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const { data } = await response.json()

        // If subscription_plan is not set, default to 'free'
        if (!data.subscription_plan) {
          data.subscription_plan = 'free'
        }

        setUserProfile(data)

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
      } else {
        log.warn('Failed to fetch user profile', { status: response.status })
        // Use free plan fallback on error
        setSelectedModel(FREE_PLAN_MODELS[0])
      }
    } catch (error) {
      log.error('Failed to fetch user profile', error)
      // Use free plan fallback on error
      setSelectedModel(FREE_PLAN_MODELS[0])
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchWebSearchQuota = async () => {
    if (!user) return

    try {
      const response = await fetch('/api/billing')
      if (response.ok) {
        const { data } = await response.json()
        const usage = data.usage

        if (usage) {
          setWebSearchQuota({
            allowed: usage.web_searches_limit === -1 || usage.web_searches_used < usage.web_searches_limit,
            currentUsage: usage.web_searches_used || 0,
            limit: usage.web_searches_limit || 10
          })
        }
      } else {
        log.warn('Failed to fetch web search quota', { status: response.status })
      }
    } catch (error) {
      log.error('Failed to fetch web search quota', error)
    }
  }

  const handleWebSearchToggle = (enabled: boolean) => {
    // If trying to enable but quota exceeded, show error and don't toggle
    if (enabled && webSearchQuota && !webSearchQuota.allowed) {
      showError(`Web search limit reached (${webSearchQuota.currentUsage}/${webSearchQuota.limit}). Please upgrade your plan.`)
      return
    }

    setEnableWebSearch(enabled)
  }

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

  const handleNodeIdClick = (nodeReference: string) => {
    log.debug('Node ID clicked', { nodeReference, hasInsertFunction: !!insertTextFunction })
    if (insertTextFunction) {
      // Always insert if the function is available, regardless of focus state
      insertTextFunction(nodeReference + ' ')
      log.debug('Inserted node reference', { nodeReference })
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

      log.debug('Message context', { parentNodeId: parentNode?.id, currentNodeId, enableUserNoteMode })

      // If user note mode is enabled, create a user note instead of sending an AI chat
      if (enableUserNoteMode) {
        const newNote = await createNote({
          sessionId: session.id,
          parentId: parentNode?.id,
          content: message,
        })

        // Add the new note to the UI
        setChatNodes(prev => [...prev, newNote])
        setCurrentNodeId(newNote.id)

        // Automatically disable note mode after creating a note
        setEnableUserNoteMode(false)

        log.info('User note created', { noteId: newNote.id })
        return
      }
      
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
          enableWebSearch: enableWebSearch,
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

        // Refresh web search quota if web search was enabled
        if (enableWebSearch) {
          fetchWebSearchQuota()
        }

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

  const handleUpdateNodeInPlace = (nodeId: string, updates: { prompt?: string; metadata?: any }) => {
    setChatNodes(prev =>
      prev.map(node =>
        node.id === nodeId
          ? {
              ...node,
              ...(updates.prompt !== undefined && { prompt: updates.prompt }),
              ...(updates.metadata !== undefined && { metadata: { ...node.metadata, ...updates.metadata } }),
              updatedAt: new Date()
            }
          : node
      )
    )
    log.info('Node updated in place', { nodeId, updates })
  }

  const handleEditNote = (note: ChatNode) => {
    setEditingNote(note)
  }

  const handleSaveNote = async (nodeId: string, updates: { title?: string; content: string; tags?: string[] }) => {
    try {
      await updateNote(nodeId, updates)

      // Update the note in the UI
      setChatNodes(prev =>
        prev.map(node =>
          node.id === nodeId
            ? {
                ...node,
                prompt: updates.content,
                metadata: {
                  ...node.metadata,
                  noteTitle: updates.title,
                  noteTags: updates.tags,
                },
              }
            : node
        )
      )

      setEditingNote(null)
      log.info('User note updated', { nodeId })
    } catch (error) {
      log.error('Error updating note', error)
      showError('Failed to update note. Please try again.')
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

              // Update only the specific node that was polled, preserving local metadata
              return prev.map(node =>
                node.id === nodeId
                  ? {
                      ...updatedNode,
                      metadata: {
                        ...node.metadata,  // Preserve existing metadata
                        ...updatedNode.metadata  // Merge with any server updates
                      }
                    }
                  : node
              )
            })
            log.info('Node polling completed', { nodeId, status: updatedNode.status })

            // If this is the first node (depth 0) and it completed successfully,
            // the session title may have been generated - trigger session list refresh
            if (updatedNode.depth === 0 && updatedNode.status === 'completed') {
              log.debug('First node completed, triggering session sync for title update')
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('session-sync-needed'))
              }
            }

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

  // Only show full page loading on initial auth load
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {error ? (
              <div className="flex h-full items-center justify-center">
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
            ) : showNotFound && !session ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="text-lg mb-4">Session not found</div>
                  <button
                    onClick={() => router.push('/chat')}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Back to Chat
                  </button>
                </div>
              </div>
            ) : session ? (
              <ChatTreeView
                nodes={chatNodes}
                currentNodeId={currentNodeId}
                onNodeClick={handleNodeClick}
                onNodeIdClick={handleNodeIdClick}
                onBackgroundClick={handleBackgroundClick}
                isLeftSidebarCollapsed={isLeftSidebarCollapsed}
                isRightSidebarOpen={isSidebarOpen}
                rightSidebarWidth={rightSidebarWidth}
              />
            ) : null}
          </div>
        </div>

        {session && (
          <GlassmorphismChatInput
            onSendMessage={handleSendMessage}
            availableNodes={chatNodes}
            onInputMount={(fn) => setInsertTextFunction(() => fn)}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            availableModels={availableModels}
            modelSelectorDisabled={profileLoading}
            enableReasoning={enableReasoning}
            onReasoningToggle={setEnableReasoning}
            enableWebSearch={enableWebSearch}
            onWebSearchToggle={handleWebSearchToggle}
            webSearchQuotaExceeded={webSearchQuota !== null ? !webSearchQuota.allowed : false}
            enableUserNoteMode={enableUserNoteMode}
            onUserNoteModeToggle={setEnableUserNoteMode}
            currentNodeId={currentNodeId}
            currentNodePrompt={(() => {
              const currentNode = chatNodes.find(n => n.id === currentNodeId)
              return currentNode?.prompt
            })()}
            isRightSidebarOpen={isSidebarOpen}
            isLeftSidebarCollapsed={isLeftSidebarCollapsed}
            rightSidebarWidth={rightSidebarWidth}
            isLeftSidebarMobileOpen={isLeftSidebarMobileOpen}
          />
        )}

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
          onUpdateNode={handleUpdateNodeInPlace}
        />

        {/* User Note Editor Modal */}
        {editingNote && (
          <UserNoteEditorModal
            isOpen={!!editingNote}
            onClose={() => setEditingNote(null)}
            onSave={handleSaveNote}
            node={editingNote}
          />
        )}
    </div>
  )
}
