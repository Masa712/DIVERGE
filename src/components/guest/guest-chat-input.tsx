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
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)

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

  // Track window width for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate offsets when sidebars are open
  const rightOffset = rightSidebarWidth + 60

  // Render input content (DRY approach - same pattern as user chat input)
  const renderInputContent = () => (
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
      <div className="flex items-center justify-between mt-1">
        {/* Left */}
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
  )

  // Calculate container positioning based on sidebar state (same pattern as user version)
  const containerClassName = isRightSidebarOpen
    ? `fixed bottom-6 z-40
       left-1/2 -translate-x-1/2
       md:left-1/2 md:-translate-x-1/2
       ${isLeftSidebarCollapsed ? 'lg:left-[124px]' : 'lg:left-[410px]'} lg:translate-x-0`
    : "fixed bottom-6 z-40 w-full"

  // Hide input area on mobile/tablet when any sidebar is open
  const shouldHideOnMobile = windowWidth < 1024
  if (shouldHideOnMobile && (isRightSidebarOpen || isLeftSidebarMobileOpen)) {
    return null
  }

  return (
    <div
      className={containerClassName}
      style={{
        pointerEvents: 'none',
        ...(isRightSidebarOpen && windowWidth >= 1024 ? {
          right: `${rightOffset}px`
        } : {})
      }}
    >
      {/* When right sidebar is hidden: separate desktop/mobile layout */}
      {!isRightSidebarOpen && (
        <>
          {/* Desktop Layout (>=1024px): After left sidebar */}
          <div className="hidden lg:block" style={{
            marginLeft: isLeftSidebarCollapsed ? '124px' : '410px',
            marginRight: '30px',
            width: isLeftSidebarCollapsed ? 'calc(100vw - 124px - 30px)' : 'calc(100vw - 410px - 30px)'
          }}>
            <div className="max-w-4xl mx-auto px-[30px]">
              <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] pointer-events-auto">
                {renderInputContent()}
              </div>
            </div>
          </div>

          {/* Tablet/Mobile Layout (<1024px): Full width centered */}
          <div className="block lg:hidden px-[30px]">
            <div className="max-w-4xl mx-auto">
              <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] pointer-events-auto">
                {renderInputContent()}
              </div>
            </div>
          </div>
        </>
      )}

      {/* When right sidebar is visible */}
      {isRightSidebarOpen && (
        <>
          {/* Desktop Layout */}
          <div className="hidden lg:block w-full px-[30px]">
            <div className="max-w-4xl mx-auto">
              <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] pointer-events-auto">
                {renderInputContent()}
              </div>
            </div>
          </div>

          {/* Tablet/Mobile Layout - Centered */}
          <div className="block lg:hidden w-[90vw] max-w-4xl px-[30px]">
            <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] pointer-events-auto">
              {renderInputContent()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
