'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { ModelSelector } from '@/components/chat/model-selector'
import { ModelId, ModelConfig } from '@/types'

interface Props {
  onSendMessage: (message: string) => Promise<void>
  disabled?: boolean
  selectedModel: ModelId
  onModelChange: (model: ModelId) => void
  availableModels: ModelConfig[]
  currentNodeId?: string
  currentNodePrompt?: string
  isRightSidebarOpen?: boolean
  rightSidebarWidth?: number
  isLeftSidebarCollapsed?: boolean
  isLeftSidebarMobileOpen?: boolean
}

export function GuestChatInput({
  onSendMessage,
  disabled = false,
  selectedModel,
  onModelChange,
  availableModels,
  currentNodeId,
  currentNodePrompt,
  isRightSidebarOpen = false,
  rightSidebarWidth = 400,
  isLeftSidebarCollapsed = false,
  isLeftSidebarMobileOpen = false,
}: Props) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async () => {
    if (!message.trim() || sending || disabled) return

    const messageToSend = message.trim()
    setMessage('')
    setSending(true)

    try {
      await onSendMessage(messageToSend)
    } catch (error) {
      console.error('Error sending message:', error)
      setMessage(messageToSend)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [message])

  // Calculate offsets when sidebars are open
  // Right sidebar: dynamic width + 30px (right margin) + 30px (padding) = rightSidebarWidth + 60px from right edge
  const rightOffset = rightSidebarWidth + 60 // sidebar width + margins
  // Left sidebar: 64px (collapsed) or 256px (expanded) + 30px margin + 30px padding
  const leftOffset = isLeftSidebarCollapsed ? 124 : 410 // 94px or 380px sidebar + 30px margin + 30px

  // Hide input area on mobile/tablet when any sidebar is open
  const shouldHideOnMobile = typeof window !== 'undefined' && window.innerWidth < 1024
  if (shouldHideOnMobile && (isRightSidebarOpen || isLeftSidebarMobileOpen)) {
    return null
  }

  return (
    <div
      className="fixed bottom-6 z-40 px-4"
      style={{
        left: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${leftOffset}px` : 0,
        right: isRightSidebarOpen && typeof window !== 'undefined' && window.innerWidth >= 1024
          ? `${rightOffset}px`
          : 0
      }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
          <div className="p-4">
            {/* Continuing from text */}
            {currentNodeId && currentNodePrompt && !message && (
              <div className="text-[10px] text-gray-500 mb-2 px-3">
                Continuing from: {currentNodePrompt.length > 60 ? currentNodePrompt.substring(0, 60) + '...' : currentNodePrompt}
              </div>
            )}

            {/* Text Input */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                adjustTextareaHeight()
              }}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="Type your message..."
              disabled={sending || disabled}
              className="w-full resize-none bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-500 focus:bg-white/15 focus:border-white/30 focus:outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              rows={1}
            />

            {/* Bottom Controls */}
            <div className="flex items-center justify-between mt-2">
              {/* Left - Empty for now (guest doesn't have extra features) */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">Guest Mode</span>
              </div>

              {/* Right - Model Selector and Send */}
              <div className="flex items-center space-x-2">
                <ModelSelector
                  selectedModel={selectedModel}
                  onModelChange={onModelChange}
                  availableModels={availableModels}
                  compact={true}
                  disabled={false}
                />

                {/* Send Button */}
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || sending || disabled}
                  className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 flex items-center justify-center shadow-lg disabled:shadow-none transform hover:scale-105 disabled:scale-100"
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <PaperAirplaneIcon className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
