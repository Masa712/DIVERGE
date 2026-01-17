'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { useError } from '@/components/providers/error-provider'
import { extractNodeReferences } from '@/lib/utils/node-references'
import { ChatNode } from '@/types'
import { PaperAirplaneIcon, PlusIcon, MagnifyingGlassIcon, BoltIcon } from '@heroicons/react/24/outline'
import { ModelSelector } from './model-selector'
import { AVAILABLE_MODELS, ModelId, ModelConfig } from '@/types'
import { supportsReasoning } from '@/lib/openrouter/client'
import { MarkdownToolbar } from './markdown-toolbar'

interface Props {
  onSendMessage: (message: string) => Promise<void>
  disabled?: boolean
  availableNodes?: ChatNode[]
  onInputMount?: (insertFunction: (text: string) => void) => void
  onFocusChange?: (focused: boolean) => void

  // Model selector props
  selectedModel: ModelId
  onModelChange: (model: ModelId) => void
  availableModels?: ModelConfig[]
  modelSelectorDisabled?: boolean

  // Web search props
  enableWebSearch?: boolean
  onWebSearchToggle?: (enabled: boolean) => void
  webSearchQuotaExceeded?: boolean

  // Reasoning props
  enableReasoning?: boolean
  onReasoningToggle?: (enabled: boolean) => void

  // User Note Mode props
  enableUserNoteMode?: boolean
  onUserNoteModeToggle?: (enabled: boolean) => void

  // Context info props
  currentNodeId?: string
  currentNodePrompt?: string

  // Sidebar state
  isRightSidebarOpen?: boolean
  isLeftSidebarCollapsed?: boolean
  rightSidebarWidth?: number
  onLeftSidebarAutoCollapse?: (collapsed: boolean) => void
  isLeftSidebarMobileOpen?: boolean
}

export function GlassmorphismChatInput({
  onSendMessage,
  disabled = false,
  availableNodes = [],
  onInputMount,
  onFocusChange,
  selectedModel,
  onModelChange,
  availableModels = AVAILABLE_MODELS,
  modelSelectorDisabled = false,
  enableWebSearch = true,
  onWebSearchToggle,
  webSearchQuotaExceeded = false,
  enableReasoning = false,
  onReasoningToggle,
  enableUserNoteMode = false,
  onUserNoteModeToggle,
  currentNodeId,
  currentNodePrompt,
  isRightSidebarOpen = false,
  isLeftSidebarCollapsed = false,
  rightSidebarWidth = 400,
  onLeftSidebarAutoCollapse,
  isLeftSidebarMobileOpen = false
}: Props) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { showError } = useError()
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)

  // Detect node references in current message
  const detectedReferences = extractNodeReferences(message)

  const handleSubmit = async () => {
    if (!message.trim() || sending || disabled) return

    const messageToSend = message.trim()
    setMessage('')
    setSending(true)

    try {
      await onSendMessage(messageToSend)
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to send message. Please try again.'
      showError(errorMessage)
      // Restore message on error
      setMessage(messageToSend)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't submit if composing (IME conversion in progress)
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const adjustTextareaHeight = () => {
    // Find the visible textarea (there are multiple textareas for responsive layouts)
    const allTextareas = Array.from(document.querySelectorAll<HTMLTextAreaElement>('[data-chat-textarea="true"]'))
    let visibleTextarea: HTMLTextAreaElement | null = null

    for (const textarea of allTextareas) {
      // Check if this textarea or any parent is hidden
      let element: HTMLElement | null = textarea
      let isVisible = true

      while (element) {
        const style = window.getComputedStyle(element)
        if (style.display === 'none') {
          isVisible = false
          break
        }
        element = element.parentElement
      }

      if (isVisible) {
        visibleTextarea = textarea
        break
      }
    }

    if (!visibleTextarea) {
      console.log('⚠️ No visible textarea found')
      return
    }

    const textarea = visibleTextarea

    // Wait for browser to complete layout (double RAF for more reliability)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!textarea) return

        const beforeHeight = textarea.offsetHeight

        // If textarea still has no height, something is wrong
        if (beforeHeight === 0) {
          return
        }

        // Temporarily remove constraints
        textarea.style.overflow = 'visible'
        textarea.style.height = 'auto'

        // Get scrollHeight
        const scrollHeight = textarea.scrollHeight

        // Calculate new height (min 44px, max 300px)
        const newHeight = Math.max(44, Math.min(scrollHeight, 300))
        textarea.style.height = `${newHeight}px`
        textarea.style.overflow = 'hidden'
      })
    })
  }

  // Function to insert text at cursor position
  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current
    if (!textarea || !text) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = textarea.value

    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end)
    setMessage(newValue)

    // Set cursor position after inserted text
    setTimeout(() => {
      if (textarea && text) {
        const newPosition = start + text.length
        textarea.setSelectionRange(newPosition, newPosition)
        textarea.focus()
        adjustTextareaHeight()
      }
    }, 0)
  }, [])

  // Register insert function with parent
  useEffect(() => {
    if (onInputMount) {
      onInputMount(insertAtCursor)
    }
  }, [onInputMount, insertAtCursor])

  // Auto-adjust height on mount and message change
  useEffect(() => {
    console.log('📝 Message changed, adjusting height', {
      messageLength: message.length,
      messagePreview: message.substring(0, 50),
    })
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

  // Simple auto-collapse based on breakpoints instead of complex width calculations
  useEffect(() => {
    if (!onLeftSidebarAutoCollapse || typeof window === 'undefined') return

    const handleResize = () => {
      const screenWidth = window.innerWidth
      
      // Only auto-collapse when right sidebar is open and screen gets smaller
      if (isRightSidebarOpen && screenWidth < 1400 && !isLeftSidebarCollapsed) {
        onLeftSidebarAutoCollapse(true)
      }
    }

    // Check immediately
    handleResize()
    
    // Listen for resize events with debouncing
    let timeoutId: NodeJS.Timeout
    const debouncedResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(handleResize, 200)
    }
    
    window.addEventListener('resize', debouncedResize)
    
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', debouncedResize)
    }
  }, [isRightSidebarOpen, isLeftSidebarCollapsed, onLeftSidebarAutoCollapse])

  // Dynamic placeholder based on context
  const placeholder = enableUserNoteMode
    ? "Enter your note..."
    : "Type your message... Use @node_abc123 or #abc123 to reference previous topics"
  
  // Render input content (DRY approach)
  const renderInputContent = () => (
    <>
      {/* Top Bar - Mode Toggle */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b border-white/10">
        {/* Mode Toggle Switch */}
        {onUserNoteModeToggle && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onUserNoteModeToggle(false)}
              className={`px-3 py-1 text-sm rounded-lg transition-all duration-200 ${
                !enableUserNoteMode
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-white/10'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => onUserNoteModeToggle(true)}
              className={`px-3 py-1 text-sm rounded-lg transition-all duration-200 ${
                enableUserNoteMode
                  ? 'bg-green-100 text-green-700 font-medium'
                  : 'text-gray-600 hover:bg-white/10'
              }`}
            >
              Note
            </button>
          </div>
        )}
      </div>

      {/* Reference Detection - Only in Chat Mode */}
      {!enableUserNoteMode && detectedReferences.length > 0 && (
        <div className="px-6 py-2 border-b border-white/10">
          <div className="text-xs text-gray-600">
            <span className="font-medium">References detected:</span>{' '}
            {detectedReferences.map((ref, index) => {
              const isValid = availableNodes.some(node => node.id.includes(ref))
              return (
                <span
                  key={index}
                  className={`inline-block px-2 py-1 rounded-full mr-2 ${
                    isValid
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {ref} {isValid ? '✓' : '✗'}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Input Area */}
      <div className="px-4 pb-4 pt-2">
        {/* Continuing from text - smaller font - Only in Chat Mode */}
        {!enableUserNoteMode && currentNodeId && currentNodePrompt && !message && (
          <div className="text-[10px] text-gray-500 mb-2 px-3">
            Continuing from: {currentNodePrompt.length > 60 ? currentNodePrompt.substring(0, 60) + '...' : currentNodePrompt}
          </div>
        )}

        {/* Markdown Toolbar - shown when user note mode is enabled */}
        {enableUserNoteMode && (
          <MarkdownToolbar onInsert={insertAtCursor} />
        )}

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          data-chat-textarea="true"
          value={message}
          onChange={(e) => {
            console.log('⌨️ onChange triggered', {
              newValue: e.target.value,
              valueLength: e.target.value.length,
            })
            setMessage(e.target.value)
            adjustTextareaHeight()
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onFocus={(e) => {
            e.currentTarget.dataset.wasFocused = 'true'
            onFocusChange?.(true)
          }}
          onBlur={(e) => {
            const textarea = e.currentTarget
            setTimeout(() => {
              if (textarea && textarea.dataset) {
                textarea.dataset.wasFocused = 'false'
              }
            }, 200)
            onFocusChange?.(false)
          }}
          placeholder={placeholder}
          disabled={sending || disabled}
          className="block w-full resize-none bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-500 focus:bg-white/15 focus:border-white/30 focus:outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: '44px', maxHeight: '300px', overflow: 'hidden' }}
          rows={1}
        />

        {/* Bottom Controls */}
        <div className="flex items-center justify-between mt-3">
          {/* Left - Function Controls (Only in Chat Mode) */}
          {!enableUserNoteMode ? (
            <div className="flex items-center space-x-2">
              <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 flex items-center justify-center group">
                <PlusIcon className="w-4 h-4 text-gray-700 group-hover:text-gray-900" />
              </button>

              {/* Web Search Toggle */}
              <button
                onClick={() => onWebSearchToggle?.(!enableWebSearch)}
                disabled={webSearchQuotaExceeded}
                className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center ${
                  webSearchQuotaExceeded
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : (enableWebSearch
                        ? 'bg-blue-100 hover:bg-blue-200 text-blue-600'
                        : 'bg-white/10 hover:bg-white/20 text-gray-500')
                }`}
                title={
                  webSearchQuotaExceeded
                    ? 'Web search quota exceeded - upgrade your plan'
                    : (enableWebSearch ? 'Web search enabled' : 'Web search disabled')
                }
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
              </button>

              {/* Reasoning Toggle */}
              <button
                onClick={() => onReasoningToggle?.(!enableReasoning)}
                disabled={!supportsReasoning(selectedModel)}
                className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center ${
                  supportsReasoning(selectedModel)
                    ? (enableReasoning
                        ? 'bg-purple-100 hover:bg-purple-200 text-purple-600'
                        : 'bg-white/10 hover:bg-white/20 text-gray-500')
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}
                title={
                  !supportsReasoning(selectedModel)
                    ? 'Reasoning not supported by this model'
                    : (enableReasoning ? 'Deep reasoning enabled' : 'Deep reasoning disabled')
                }
              >
                <BoltIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div />
          )}

          {/* Right - Model Selector and Send */}
          <div className="flex items-center space-x-2">
            {/* Model Selector - Only in Chat Mode */}
            {!enableUserNoteMode && (
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                availableModels={availableModels}
                compact={true}
                disabled={modelSelectorDisabled}
              />
            )}

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
    </>
  )
  
  // Calculate container positioning based on sidebar state
  // Left sidebar: 30px (left margin) + 350px (width) = 380px total (expanded), 30px + 64px = 94px total (collapsed)
  // Right sidebar: dynamic width + 30px (right margin) + 30px (padding) = rightSidebarWidth + 60px from right edge
  const rightOffset = rightSidebarWidth + 60 // sidebar width + 30px margin + 30px padding
  
  const containerClassName = isRightSidebarOpen 
    ? `fixed bottom-6 z-40
       left-1/2 -translate-x-1/2
       md:left-1/2 md:-translate-x-1/2
       ${isLeftSidebarCollapsed ? 'lg:left-[124px]' : 'lg:left-[410px]'} lg:translate-x-0`
    : "fixed bottom-6 z-40 w-full" // Right sidebar hidden: use separate positioning for responsive centering


  // Hide input area on mobile/tablet when any sidebar is open
  const shouldHideOnMobile = windowWidth < 1024
  if (shouldHideOnMobile && (isRightSidebarOpen || isLeftSidebarMobileOpen)) {
    return null
  }

  return (
    <div 
      className={containerClassName}
      style={isRightSidebarOpen && typeof window !== 'undefined' && window.innerWidth >= 1024 ? {
        right: `${rightOffset}px`
      } : undefined}
    >
      {/* Inner container for responsive centering when right sidebar is hidden */}
      {!isRightSidebarOpen && (
        <>
          {/* Desktop Layout (≥1024px): After left sidebar */}
          <div className="hidden lg:block" style={{ 
            marginLeft: isLeftSidebarCollapsed ? '124px' : '410px', // 94px (collapsed sidebar) + 30px margin OR 380px (expanded sidebar) + 30px margin
            marginRight: '30px',
            width: isLeftSidebarCollapsed ? 'calc(100vw - 124px - 30px)' : 'calc(100vw - 410px - 30px)'
          }}>
            <div className="max-w-4xl mx-auto px-[30px]">
              <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
                {renderInputContent()}
              </div>
            </div>
          </div>

          {/* Tablet/Mobile Layout (<1024px): Full width centered */}
          <div className="block lg:hidden px-[30px]">
            <div className="max-w-4xl mx-auto">
              <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
                {renderInputContent()}
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Direct container when right sidebar is visible */}
      {isRightSidebarOpen && (
        <>
          {/* Desktop Layout */}
          <div className="hidden lg:block w-full px-[30px]">
            <div className="max-w-4xl mx-auto">
              <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
                {renderInputContent()}
              </div>
            </div>
          </div>
          
          {/* Tablet/Mobile Layout - Centered */}
          <div className="block lg:hidden w-[90vw] max-w-4xl px-[30px]">
            <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
              {renderInputContent()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
