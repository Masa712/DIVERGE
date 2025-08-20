'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { useError } from '@/components/providers/error-provider'
import { extractNodeReferences } from '@/lib/utils/node-references'
import { ChatNode } from '@/types'

interface Props {
  onSendMessage: (message: string) => Promise<void>
  disabled?: boolean
  availableNodes?: ChatNode[]
}

export function ChatInput({ onSendMessage, disabled = false, availableNodes = [] }: Props) {
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
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    }
  }

  return (
    <div className="space-y-2">
      {/* Reference Helper */}
      {detectedReferences.length > 0 && (
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="font-medium">Detected references:</span>
            {hasValidReferences ? (
              <span className="text-green-600">✓ Valid references found</span>
            ) : (
              <span className="text-amber-600">⚠ Some references may not exist</span>
            )}
          </div>
          <div className="mt-1">
            {detectedReferences.map(ref => {
              const matchingNode = availableNodes.find(node => node.id.includes(ref))
              return (
                <div key={ref} className="text-xs">
                  • {ref}: {matchingNode ? `"${matchingNode.prompt.slice(0, 50)}..."` : 'Not found'}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            adjustTextareaHeight()
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... Use @node_abc123 or #abc123 to reference previous topics (Press Enter to send, Shift+Enter for new line)"
          disabled={sending || disabled}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: '40px', maxHeight: '150px' }}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={!message.trim() || sending || disabled}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
      >
        {sending ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            Sending...
          </div>
        ) : (
          'Send'
        )}
      </button>
      </div>
    </div>
  )
}