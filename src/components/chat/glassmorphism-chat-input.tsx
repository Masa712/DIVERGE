'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { useError } from '@/components/providers/error-provider'
import { extractNodeReferences } from '@/lib/utils/node-references'
import { ChatNode } from '@/types'
import { PaperAirplaneIcon, PlusIcon } from '@heroicons/react/24/outline'
import { ModelSelector } from './model-selector'
import { AVAILABLE_MODELS, ModelId } from '@/types'

interface Props {
  onSendMessage: (message: string) => Promise<void>
  disabled?: boolean
  availableNodes?: ChatNode[]
  onInputMount?: (insertFunction: (text: string) => void) => void
  onFocusChange?: (focused: boolean) => void
  
  // Model selector props
  selectedModel: ModelId
  onModelChange: (model: ModelId) => void
  
  // Context info props
  currentNodeId?: string
  currentNodePrompt?: string
  
  // Sidebar state
  isRightSidebarOpen?: boolean
  isLeftSidebarCollapsed?: boolean
}

export function GlassmorphismChatInput({ 
  onSendMessage, 
  disabled = false, 
  availableNodes = [], 
  onInputMount, 
  onFocusChange,
  selectedModel,
  onModelChange,
  currentNodeId,
  currentNodePrompt,
  isRightSidebarOpen = false,
  isLeftSidebarCollapsed = false
}: Props) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { showError } = useError()

  // Detect node references in current message
  const detectedReferences = extractNodeReferences(message)
  const hasValidReferences = detectedReferences.some(ref => 
    availableNodes.some(node => node.id.includes(ref))
  )

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
    if (e.key === 'Enter' && !e.shiftKey) {
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

  // Function to insert text at cursor position
  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = textarea.value
    
    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end)
    setMessage(newValue)
    
    // Set cursor position after inserted text
    setTimeout(() => {
      if (textarea) {
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
    adjustTextareaHeight()
  }, [message])

  // Dynamic placeholder based on context
  const placeholder = "Type your message... Use @node_abc123 or #abc123 to reference previous topics"
  
  // Render input content (DRY approach)
  const renderInputContent = () => (
    <>
      {/* Reference Detection */}
      {detectedReferences.length > 0 && (
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
      <div className="p-4">
        {/* Continuing from text - smaller font */}
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
          onFocus={(e) => {
            console.log('📝 Textarea focused')
            e.currentTarget.dataset.wasFocused = 'true'
            onFocusChange?.(true)
          }}
          onBlur={(e) => {
            console.log('📝 Textarea blurred')
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
          className="w-full resize-none bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-500 focus:bg-white/15 focus:border-white/30 focus:outline-none transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: '44px', maxHeight: '120px' }}
          rows={1}
        />
        
        {/* Bottom Controls - Outside Input */}
        <div className="flex items-center justify-between mt-1">
          {/* Left - Plus Button */}
          <button className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-200 flex items-center justify-center group">
            <PlusIcon className="w-4 h-4 text-gray-700 group-hover:text-gray-900" />
          </button>
          
          {/* Right - Model Selector and Send */}
          <div className="flex items-center space-x-2">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              availableModels={AVAILABLE_MODELS}
              compact={true}
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
    </>
  )
  
  // Calculate container positioning based on sidebar state
  // Left sidebar: 30px (left margin) + 350px (width) = 380px total (expanded), 30px + 64px = 94px total (collapsed)
  // Right sidebar: 400px (width) + 30px (right margin) = 430px from right edge
  const containerClassName = isRightSidebarOpen 
    ? `fixed bottom-6 z-40
       ${isLeftSidebarCollapsed ? 'lg:left-[124px]' : 'lg:left-[410px]'} lg:right-[460px]
       md:left-6 md:right-[390px]
       left-6 right-6`
    : "fixed bottom-6 z-40 w-full" // Right sidebar hidden: use separate positioning for responsive centering

  // Debug logging
  console.log('🔍 GlassmorphismChatInput render:', {
    isRightSidebarOpen,
    isLeftSidebarCollapsed,
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 'unknown',
    calculatedLeftPosition: isLeftSidebarCollapsed ? '124px' : '410px',
    containerClassName: containerClassName
  })

  return (
    <div className={containerClassName}>
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
          <div className="block lg:hidden w-full px-[30px]">
            <div className="w-full max-w-4xl mx-auto">
              <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
                {renderInputContent()}
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Direct container when right sidebar is visible */}
      {isRightSidebarOpen && (
        <div className="px-[30px]">
          <div className="max-w-4xl mx-auto">
            <div className="glass-test glass-blur rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
              {/* Content will be rendered here for right sidebar visible case */}
              {renderInputContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
