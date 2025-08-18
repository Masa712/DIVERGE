'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  MessageSquare, 
  Settings, 
  LogOut, 
  User, 
  DollarSign, 
  Activity,
  ChevronDown,
  ChevronRight,
  Calendar,
  Menu,
  X,
  Trash2,
  MoreVertical
} from 'lucide-react'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { Session } from '@/types'

interface Props {
  currentSessionId?: string
  onSessionSelect: (sessionId: string) => void
  onNewSession: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function LeftSidebar({ currentSessionId, onSessionSelect, onNewSession, isCollapsed, onToggleCollapse }: Props) {
  const { user, signOut } = useAuth()
  const { showError } = useError()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showDashboard, setShowDashboard] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [dashboardData, setDashboardData] = useState({
    totalSessions: 0,
    totalCost: 0,
    totalTokens: 0,
    monthlyUsage: 0
  })

  useEffect(() => {
    fetchSessions()
    fetchDashboardData()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      } else {
        showError('Failed to load sessions')
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
      showError('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const fetchDashboardData = async () => {
    try {
      // This would be a real API call in a production app
      // For now, we'll calculate from sessions
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const data = await response.json()
        const sessions = data.sessions || []
        
        const totalCost = sessions.reduce((sum: number, session: Session) => 
          sum + (session.totalCostUsd || 0), 0)
        const totalTokens = sessions.reduce((sum: number, session: Session) => 
          sum + (session.totalTokens || 0), 0)
        
        setDashboardData({
          totalSessions: sessions.length,
          totalCost,
          totalTokens,
          monthlyUsage: totalCost // Simplified for now
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

  const handleCreateSession = async () => {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `New Chat ${new Date().toLocaleDateString()}`,
          description: 'New conversation'
        }),
      })

      if (response.ok) {
        const { session } = await response.json()
        await fetchSessions()
        onNewSession()
        onSessionSelect(session.id)
      } else {
        showError('Failed to create session')
      }
    } catch (error) {
      console.error('Error creating session:', error)
      showError('Failed to create session')
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove from local state
        setSessions(sessions.filter(s => s.id !== sessionId))
        
        // If the deleted session was the current one, trigger onNewSession
        if (currentSessionId === sessionId) {
          onNewSession()
        }
        
        // Refresh dashboard data
        await fetchDashboardData()
        showError('Session deleted successfully')
      } else {
        showError('Failed to delete session')
      }
    } catch (error) {
      console.error('Error deleting session:', error)
      showError('Failed to delete session')
    }
    setSessionToDelete(null)
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/auth')
    } catch (error) {
      showError('Failed to sign out')
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-80'} h-full bg-gray-50 border-r flex flex-col transition-all duration-300`}>
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          {!isCollapsed && <h1 className="text-xl font-bold text-gray-900">Diverge</h1>}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCollapse}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="w-4 h-4" />
            </button>
            {!isCollapsed && (
              <button
                onClick={handleCreateSession}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="New Chat"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-500">Online</p>
            </div>
          </div>
        )}
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {isCollapsed ? (
          // Collapsed view - show only icons
          <div className="p-2">
            {sessions.slice(0, 5).map((session) => (
              <button
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={`w-full p-3 mb-2 rounded-lg transition-colors flex items-center justify-center ${
                  currentSessionId === session.id
                    ? 'bg-blue-100 border border-blue-200'
                    : 'bg-white hover:bg-gray-100 border border-gray-200'
                }`}
                title={session.name}
              >
                <MessageSquare className={`w-4 h-4 ${
                  currentSessionId === session.id ? 'text-blue-600' : 'text-gray-600'
                }`} />
              </button>
            ))}
          </div>
        ) : (
          // Expanded view - show full content
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Recent Chats</h2>
              <span className="text-xs text-gray-500">{sessions.length}</span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No chats yet</p>
                <button
                  onClick={handleCreateSession}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  Start your first chat
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div key={session.id} className="relative group">
                    <button
                      onClick={() => onSessionSelect(session.id)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        currentSessionId === session.id
                          ? 'bg-blue-100 border border-blue-200'
                          : 'bg-white hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-8">
                          <h3 className="font-medium text-gray-900 truncate text-sm">
                            {session.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {session.nodeCount} messages • ${session.totalCostUsd.toFixed(4)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(session.lastAccessedAt)}
                          </p>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          <div className={`w-2 h-2 rounded-full ${
                            currentSessionId === session.id ? 'bg-blue-500' : 'bg-gray-300'
                          }`} />
                        </div>
                      </div>
                    </button>
                    
                    {/* Delete button - shows on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSessionToDelete(session.id)
                      }}
                      className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-all"
                      title="Delete session"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dashboard Section */}
      {!isCollapsed && (
        <div className="border-t bg-white">
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Dashboard</span>
            </div>
            {showDashboard ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {showDashboard && (
            <div className="px-4 pb-4 space-y-3 border-t bg-gray-50">
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-white p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-gray-600">Sessions</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {dashboardData.totalSessions}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-gray-600">Total Cost</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    ${dashboardData.totalCost.toFixed(2)}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-600" />
                    <span className="text-xs text-gray-600">Tokens</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {dashboardData.totalTokens.toLocaleString()}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-600" />
                    <span className="text-xs text-gray-600">This Month</span>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    ${dashboardData.monthlyUsage.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t bg-white">
        {isCollapsed ? (
          <button
            onClick={handleSignOut}
            className="w-full p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {sessionToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Session
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this chat session? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSessionToDelete(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSession(sessionToDelete)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
