'use client'

import { useState, useCallback } from 'react'
import { ChatNode, ModelId } from '@/types'
import { ChatTreeView } from '@/components/tree/chat-tree-view'
import { DemoSignupModal } from './demo-signup-modal'
import { AnimatedBackground } from '@/components/ui/AnimatedBackground'

// Demo allowed models
const DEMO_MODELS: { id: ModelId; name: string }[] = [
  { id: 'deepseek/deepseek-chat-v3.1', name: 'DeepSeek V3.1' },
  { id: 'x-ai/grok-4-fast', name: 'Grok 4 Fast' }
]

const MAX_DEMO_NODES = 5

// Generate unique ID for demo nodes
function generateDemoNodeId(): string {
  return `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function DemoChat() {
  const [nodes, setNodes] = useState<ChatNode[]>([])
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>()
  const [selectedModel, setSelectedModel] = useState<ModelId>('deepseek/deepseek-chat-v3.1')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showSignupModal, setShowSignupModal] = useState(false)

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || sending) return

    // Check if 5 node limit reached
    if (nodes.length >= MAX_DEMO_NODES) {
      setShowSignupModal(true)
      return
    }

    const userMessage = message.trim()
    setMessage('')
    setSending(true)

    try {
      // Find parent node
      let parentNode = null
      if (currentNodeId) {
        parentNode = nodes.find(n => n.id === currentNodeId)
      } else if (nodes.length > 0) {
        parentNode = nodes.reduce((latest, node) =>
          new Date(node.createdAt) > new Date(latest.createdAt) ? node : latest
        )
      }

      // Create user node
      const userNodeId = generateDemoNodeId()
      const now = new Date()
      const userNode: ChatNode = {
        id: userNodeId,
        parentId: parentNode?.id || null,
        sessionId: 'demo',
        model: selectedModel,
        systemPrompt: null,
        prompt: userMessage,
        response: null,
        status: 'pending',
        errorMessage: null,
        depth: parentNode ? parentNode.depth + 1 : 0,
        promptTokens: 0,
        responseTokens: 0,
        costUsd: 0,
        temperature: 0.7,
        maxTokens: 2000,
        topP: null,
        metadata: {},
        createdAt: now,
        updatedAt: now
      }

      // Add user node
      setNodes(prev => [...prev, userNode])
      setCurrentNodeId(userNodeId)

      // Build messages for API
      const messages: Array<{ role: string; content: string }> = []

      // Add conversation history if there's a parent
      if (parentNode) {
        let currentAncestor: ChatNode | undefined = parentNode
        const ancestorMessages: Array<{ role: string; content: string }> = []

        while (currentAncestor) {
          ancestorMessages.unshift({ role: 'user', content: currentAncestor.prompt })
          if (currentAncestor.response) {
            ancestorMessages.push({ role: 'assistant', content: currentAncestor.response })
          }
          currentAncestor = nodes.find(n => n.id === currentAncestor?.parentId)
        }

        messages.push(...ancestorMessages)
      }

      // Add current message
      messages.push({ role: 'user', content: userMessage })

      // Call demo API
      const response = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: selectedModel,
          nodeCount: nodes.length
        })
      })

      if (response.ok) {
        const result = await response.json()
        const content = result.data.content

        // Update user node with response
        setNodes(prev =>
          prev.map(n =>
            n.id === userNodeId
              ? { ...n, response: content, status: 'completed' as const, updatedAt: new Date() }
              : n
          )
        )
      } else {
        const error = await response.json()

        // Check if it's the demo limit error
        if (response.status === 403) {
          setShowSignupModal(true)
          // Remove the pending node
          setNodes(prev => prev.filter(n => n.id !== userNodeId))
        } else {
          // Update node with error
          setNodes(prev =>
            prev.map(n =>
              n.id === userNodeId
                ? {
                    ...n,
                    status: 'failed' as const,
                    errorMessage: error.error || 'Failed to generate response',
                    updatedAt: new Date()
                  }
                : n
            )
          )
        }
      }
    } catch (error) {
      console.error('Demo chat error:', error)
    } finally {
      setSending(false)
    }
  }, [message, nodes, currentNodeId, selectedModel, sending])

  const handleNodeClick = useCallback((nodeId: string) => {
    setCurrentNodeId(nodeId)
  }, [])

  const handleBackgroundClick = useCallback(() => {
    setCurrentNodeId(undefined)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="relative w-full h-[600px] rounded-2xl overflow-hidden shadow-xl border border-white/30 bg-white/10 backdrop-blur-xl">
      {/* Animated Background */}
      <AnimatedBackground position="absolute" opacity={0.6} className="scale-110" />

      {/* Tree View */}
      <div className="relative z-10 w-full h-full">
        {nodes.length > 0 ? (
          <ChatTreeView
            nodes={nodes}
            currentNodeId={currentNodeId}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md px-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Try Diverge Demo
              </h3>
              <p className="text-gray-600 mb-4">
                Experience node-based AI conversations. Type a message below to start exploring!
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200">
                <span className="text-sm text-gray-600">Demo limit:</span>
                <span className="font-semibold text-blue-600">{nodes.length} / {MAX_DEMO_NODES} nodes</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input - Fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Node counter */}
          <div className="flex justify-between items-center mb-2 px-4">
            <span className="text-xs text-gray-500">
              {nodes.length >= MAX_DEMO_NODES ? (
                <span className="text-red-600 font-medium">Demo limit reached - Sign up to continue</span>
              ) : (
                `${nodes.length} / ${MAX_DEMO_NODES} demo nodes used`
              )}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as ModelId)}
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={sending}
              >
                {DEMO_MODELS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Input area */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="flex items-end gap-2 p-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  nodes.length >= MAX_DEMO_NODES
                    ? "Demo limit reached - Sign up to continue"
                    : "Type your message... (Press Enter to send)"
                }
                disabled={sending || nodes.length >= MAX_DEMO_NODES}
                className="flex-1 resize-none bg-transparent focus:outline-none text-gray-900 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ minHeight: '40px', maxHeight: '120px' }}
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || sending || nodes.length >= MAX_DEMO_NODES}
                className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 shadow-lg disabled:shadow-none transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Signup Modal */}
      <DemoSignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
      />
    </div>
  )
}
