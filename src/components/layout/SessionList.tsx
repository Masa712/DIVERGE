'use client'

import { ChatBubbleLeftRightIcon as MessageSquare, TrashIcon as Trash2 } from '@heroicons/react/24/outline'
import { Session } from '@/types'

interface SessionListProps {
  sessions: Session[]
  loading: boolean
  currentSessionId?: string
  onSessionSelect: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onCreateSession: () => void
  onMobileClose?: () => void
  formatDate: (date: Date) => string
}

export function SessionList({ 
  sessions, 
  loading, 
  currentSessionId, 
  onSessionSelect, 
  onDeleteSession, 
  onCreateSession,
  onMobileClose,
  formatDate 
}: SessionListProps) {
  const handleSessionClick = (sessionId: string) => {
    onSessionSelect(sessionId)
    onMobileClose?.()
  }

  if (loading) {
    return (
      <div className="space-y-2 px-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 px-3">
        <MessageSquare className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-600 mb-2">No chats yet</p>
        <button
          onClick={onCreateSession}
          className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          Start your first chat
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {sessions.map((session) => (
        <div key={session.id} className="relative group">
          <button
            onClick={() => handleSessionClick(session.id)}
            className={`
              w-full text-left px-3 py-2.5 rounded-lg mb-1
              transition-all duration-200
              transform hover:translate-x-1
              ${currentSessionId === session.id 
                ? 'bg-white/20 shadow-lg' 
                : 'hover:bg-white/10'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {session.name || `Chat ${formatDate(session.createdAt)}`}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(session.updatedAt)} • {session.nodeCount} messages
                </div>
              </div>
              {currentSessionId === session.id && (
                <div className="w-2 h-2 rounded-full bg-blue-400 group-hover:opacity-0 transition-opacity" />
              )}
            </div>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteSession(session.id)
            }}
            className="absolute top-1/2 right-2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
            title="Delete session"
          >
            <Trash2 className="w-3 h-3 text-red-600" />
          </button>
        </div>
      ))}
    </div>
  )
}