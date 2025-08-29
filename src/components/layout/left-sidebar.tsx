'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  PlusIcon,
  ChatBubbleLeftRightIcon as MessageSquare,
  ArrowRightOnRectangleIcon as LogOut,
  CurrencyDollarIcon as DollarSign,
  ChartBarIcon as Activity,
  CalendarIcon as Calendar,
  Bars3Icon as Menu,
  XMarkIcon as X,
  TrashIcon as Trash2
} from '@heroicons/react/24/outline'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { Session } from '@/types'

interface Props {
  currentSessionId?: string
  currentSession?: Session | null
  onSessionSelect: (sessionId: string) => void
  onNewSession: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  onMobileOpenChange?: (isOpen: boolean) => void
}

export function LeftSidebar({ currentSessionId, currentSession, onSessionSelect, onNewSession, isCollapsed, onToggleCollapse, onMobileOpenChange }: Props) {
  console.log(`🔧 LeftSidebar component loaded at ${new Date().toISOString()}`)
  const { user, signOut } = useAuth()
  const { showError } = useError()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showDashboard, setShowDashboard] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Notify parent of mobile open state changes
  useEffect(() => {
    onMobileOpenChange?.(isMobileOpen)
  }, [isMobileOpen, onMobileOpenChange])
  const [dashboardData, setDashboardData] = useState({
    totalSessions: 0,
    totalCost: 0,
    totalTokens: 0,
    monthlyUsage: 0
  })

  useEffect(() => {
    console.log(`📍 LeftSidebar useEffect triggered - fetching initial data`)
    fetchSessionsAndDashboard()

    // Listen for session sync events from other components
    const handleSessionSyncNeeded = () => {
      console.log(`🔄 Session sync requested by external event`)
      fetchSessionsAndDashboard()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('session-sync-needed', handleSessionSyncNeeded)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('session-sync-needed', handleSessionSyncNeeded)
      }
    }
  }, [])

  // Update session list when current session changes (e.g., title update)
  useEffect(() => {
    if (currentSession && currentSessionId) {
      console.log(`🔄 Updating sidebar session: ${currentSessionId} -> "${currentSession.name}"`)
      setSessions(prev => 
        prev.map(session => 
          session.id === currentSessionId 
            ? { ...session, name: currentSession.name }
            : session
        )
      )
    }
  }, [currentSession?.name, currentSessionId])

  const fetchSessionsAndDashboard = async () => {
    try {
      console.log(`📡 Fetching sessions and dashboard data for sidebar...`)
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const result = await response.json()
        const sessionsData = result.data?.sessions || []
        console.log(`📊 Fetched ${sessionsData.length} sessions:`, sessionsData.map((s: Session) => `${s.name} (${s.id.slice(0,8)})`))
        setSessions(sessionsData)
        
        // Calculate dashboard data from the same response
        const totalCost = sessionsData.reduce((sum: number, session: Session) => 
          sum + (session.totalCostUsd || 0), 0)
        const totalTokens = sessionsData.reduce((sum: number, session: Session) => 
          sum + (session.totalTokens || 0), 0)
        
        setDashboardData({
          totalSessions: sessionsData.length,
          totalCost,
          totalTokens,
          monthlyUsage: totalCost
        })
      } else {
        console.error(`❌ Failed to fetch sessions: ${response.status}`)
        showError('Failed to load sessions')
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
      showError('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSession = async () => {
    console.log(`🆕 Creating new session...`)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Chat',
          description: 'New conversation'
        }),
      })

      if (response.ok) {
        const { data } = await response.json()
        const session = data.session
        console.log(`✅ Session created: ${session.id}, name: "${session.name}"`)
        
        // Add the new session to the list immediately for instant feedback
        setSessions(prevSessions => {
          const newSessions = [session, ...prevSessions]
          console.log(`📝 Added new session to sidebar. Total sessions: ${newSessions.length}`)
          return newSessions
        })
        
        // Also refetch sessions to ensure data consistency
        console.log(`🔄 Refetching sessions for sidebar to ensure consistency...`)
        setTimeout(() => fetchSessionsAndDashboard(), 100) // Small delay to ensure UI updates first
        
        onNewSession()
        onSessionSelect(session.id)
      } else {
        console.error(`❌ Failed to create session: ${response.status}`)
        showError('Failed to create session')
      }
    } catch (error) {
      console.error('Error creating session:', error)
      showError('Failed to create session')
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    console.log(`🗑️ Attempting to delete session: ${sessionId}`)
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        console.log(`✅ Session deleted successfully: ${sessionId}`)
        setSessions(sessions.filter(s => s.id !== sessionId))
        
        if (currentSessionId === sessionId) {
          onNewSession()
        }
        
        await fetchSessionsAndDashboard()
        showError('Session deleted successfully')
      } else if (response.status === 404) {
        // Session doesn't exist in database, remove from UI
        console.log(`⚠️ Session not found in database, removing from UI: ${sessionId}`)
        setSessions(sessions.filter(s => s.id !== sessionId))
        
        if (currentSessionId === sessionId) {
          onNewSession()
        }
        
        await fetchSessionsAndDashboard()
        showError('Session was already removed')
      } else {
        console.error(`❌ Delete failed with status ${response.status}`)
        const errorData = await response.json().catch(() => ({}))
        showError(errorData.error || 'Failed to delete session')
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

  const confirmDelete = async () => {
    if (!sessionToDelete) return
    
    try {
      const response = await fetch(`/api/sessions/${sessionToDelete}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        setSessions(sessions.filter(s => s.id !== sessionToDelete))
        setSessionToDelete(null)
      } else {
        showError('Failed to delete session')
      }
    } catch (error) {
      console.error('Error deleting session:', error)
      showError('Failed to delete session')
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

  // If collapsed, show minimal icon-only version
  if (isCollapsed) {
    return (
      <div>
        {/* Mobile Toggle Button - Show when collapsed */}
        {!isMobileOpen && (
          <button
            onClick={() => setIsMobileOpen(true)}
            className="fixed left-[30px] top-[25px] z-40 p-3 lg:hidden hover:bg-black/10 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
        )}

        {/* Mobile Overlay */}
        {isMobileOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Mobile/Tablet - Use Original PC Design */}
        <aside className={`
          fixed z-50 flex flex-col
          glass-test glass-blur
          border border-white/20
          shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem]
          transform transition-all duration-300 ease-in-out
          lg:hidden
          
          /* Mobile/Tablet centered positioning */
          left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-[90vw] max-w-[400px] h-[85vh] max-h-[700px]
          md:w-[80vw] md:max-w-[400px] md:h-[80vh]
          
          /* Show/hide animation */
          ${isMobileOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}
        `}>
          {/* Header - Logo */}
          <div className="px-6 pt-9 pb-6 border-b border-white/10 relative">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900">
                Diverge
              </h1>
            </div>
            
            <div className="absolute top-4 right-4">
              <button
                onClick={onToggleCollapse}
                className="p-2 rounded-lg text-gray-700 hover:bg-white/10 transition-all duration-200"
                title="Expand sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* User Info Section */}
          <div className="px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                <span className="text-gray-900 text-sm font-medium">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">
                  {user?.email || 'User'}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-gray-600">Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Sessions List */}
          <div className="flex-1 overflow-y-auto px-3 py-4 sidebar-scroll">
            <div className="mb-4 px-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Recent Chats
                </h2>
                <span className="text-xs text-gray-400">{sessions.length}</span>
              </div>
            </div>
            
            {loading ? (
              <div className="space-y-2 px-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 px-3">
                <MessageSquare className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">No chats yet</p>
                <button
                  onClick={handleCreateSession}
                  className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Start your first chat
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div key={session.id} className="relative group">
                    <button
                      onClick={() => {
                        onSessionSelect(session.id)
                        setIsMobileOpen(false)
                      }}
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
                          <div className="text-xs text-gray-600 mt-0.5">
                            {session.nodeCount} messages • ${(session.totalCostUsd || 0).toFixed(4)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(session.lastAccessedAt)}
                          </div>
                        </div>
                        {currentSessionId === session.id && (
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                        )}
                      </div>
                    </button>
                    
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSessionToDelete(session.id)
                      }}
                      className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                      title="Delete session"
                    >
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-4">
            {/* New Chat Button */}
            <button 
              onClick={handleCreateSession}
              className="
                w-full mb-3 px-4 py-2.5 rounded-lg
                bg-gradient-to-r from-blue-500/20 to-purple-500/20
                border border-white/20
                text-gray-800 text-sm font-medium
                hover:from-blue-500/30 hover:to-purple-500/30
                transition-all duration-200
                flex items-center justify-center gap-2
              "
            >
              <PlusIcon className="w-4 h-4" />
              New Chat
            </button>
            
            {/* Dashboard Button */}
            <button 
              onClick={() => {
                setShowDashboard(!showDashboard)
                setIsMobileOpen(false)
              }}
              className="
                w-full mb-2 px-4 py-2 rounded-lg
                text-gray-700 text-sm
                hover:text-blue-600
                transition-all duration-200
                flex items-center gap-2 group
              "
            >
              <Activity className="w-4 h-4 group-hover:text-blue-600 transition-colors duration-200" />
              <span className="group-hover:text-blue-600 transition-colors duration-200">Dashboard</span>
            </button>
            
            {/* Sign Out Button */}
            <button 
              onClick={handleSignOut}
              className="
                w-full px-4 py-2 rounded-lg
                text-gray-600 text-sm
                hover:text-red-600
                transition-all duration-200
                flex items-center gap-2 group
              "
            >
              <LogOut className="w-4 h-4 group-hover:text-red-600 transition-colors duration-200" />
              <span className="group-hover:text-red-600 transition-colors duration-200">Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Desktop Collapsed Sidebar */}
        <aside className="fixed left-[30px] top-[25px] bottom-[25px] w-16 z-50 flex flex-col glass-test glass-blur border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem] hidden lg:flex">
        {/* Toggle Button */}
        <div className="p-3 border-b border-white/10">
          <button
            onClick={onToggleCollapse}
            className="w-full p-2 rounded-lg text-gray-700 hover:bg-white/10 transition-all duration-200"
            title="Expand sidebar"
          >
            <Menu className="w-5 h-5 mx-auto" />
          </button>
        </div>

        {/* Quick Sessions */}
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.slice(0, 5).map((session) => (
            <button
              key={session.id}
              onClick={() => onSessionSelect(session.id)}
              className={`w-full p-3 mb-2 rounded-lg transition-all duration-200 ${
                currentSessionId === session.id
                  ? 'bg-white/20 shadow-lg'
                  : 'hover:bg-white/10'
              }`}
              title={session.name}
            >
              <MessageSquare className={`w-4 h-4 mx-auto ${
                currentSessionId === session.id ? 'text-gray-900' : 'text-gray-600'
              }`} />
            </button>
          ))}
        </div>

        {/* Dashboard */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setShowDashboard(true)}
            className="w-full p-2 rounded-lg text-gray-600 hover:text-blue-600 transition-all duration-200 group"
            title="Dashboard"
          >
            <Activity className="w-4 h-4 mx-auto group-hover:text-blue-600 transition-colors duration-200" />
          </button>
        </div>

        {/* Sign Out */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full p-2 rounded-lg text-gray-600 hover:text-red-600 transition-all duration-200 group"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4 mx-auto group-hover:text-red-600 transition-colors duration-200" />
          </button>
        </div>
      </aside>
      </div>
    )
  }

  return (
    <>
      {/* Mobile Toggle Button */}
      {!isMobileOpen && (
        <button
          onClick={() => setIsMobileOpen(true)}
          className="fixed left-[30px] top-[25px] z-40 p-3 lg:hidden hover:bg-black/10 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Glass Morphism Floating Sidebar */}
      <aside className={`
        fixed z-50 flex flex-col
        glass-test glass-blur
        border border-white/20
        shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-[2rem]
        transform transition-transform duration-300 ease-in-out
        
        /* Desktop positioning - Override mobile styles */
        lg:left-[30px] lg:top-[25px] lg:bottom-[25px] lg:w-[350px] lg:h-auto lg:max-h-none lg:max-w-none lg:translate-x-0 lg:translate-y-0
        
        /* Tablet/Mobile centered positioning */
        left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
        w-[90vw] max-w-[400px] h-[85vh] max-h-[700px]
        md:w-[80vw] md:max-w-[400px] md:h-[80vh]
        
        /* Show/hide on mobile */
        ${isMobileOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none lg:scale-100 lg:opacity-100 lg:pointer-events-auto'}
      `}>
        {/* Header - Logo */}
        <div className="px-6 pt-9 pb-6 border-b border-white/10 relative">
          {/* Logo - Centered */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900">
              Diverge
            </h1>
          </div>
          
          {/* Controls - Positioned absolutely */}
          <div className="absolute top-4 right-4">
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-lg text-gray-700 hover:bg-white/10 transition-all duration-200 lg:block hidden"
              title="Collapse sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User Info Section */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
              <span className="text-gray-900 text-sm font-medium">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800">
                {user?.email || 'User'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-gray-600">Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 sidebar-scroll">
          <div className="mb-4 px-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Recent Chats
              </h2>
              <span className="text-xs text-gray-400">{sessions.length}</span>
            </div>
          </div>
          
          {loading ? (
            <div className="space-y-2 px-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 px-3">
              <MessageSquare className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">No chats yet</p>
              <button
                onClick={handleCreateSession}
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                Start your first chat
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div key={session.id} className="relative group">
                  <button
                    onClick={() => onSessionSelect(session.id)}
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
                        <div className="text-xs text-gray-600 mt-0.5">
                          {session.nodeCount} messages • ${(session.totalCostUsd || 0).toFixed(4)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDate(session.lastAccessedAt)}
                        </div>
                      </div>
                      {currentSessionId === session.id && (
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                      )}
                    </div>
                  </button>
                  
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSessionToDelete(session.id)
                    }}
                    className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                    title="Delete session"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          {/* New Chat Button */}
          <button 
            onClick={handleCreateSession}
            className="
              w-full mb-3 px-4 py-2.5 rounded-lg
              bg-gradient-to-r from-blue-500/20 to-purple-500/20
              border border-white/20
              text-gray-800 text-sm font-medium
              hover:from-blue-500/30 hover:to-purple-500/30
              transition-all duration-200
              flex items-center justify-center gap-2
            "
          >
            <PlusIcon className="w-4 h-4" />
            New Chat
          </button>
          
          {/* Dashboard Button */}
          <button 
            onClick={() => setShowDashboard(!showDashboard)}
            className="
              w-full mb-2 px-4 py-2 rounded-lg
              text-gray-700 text-sm
              hover:text-blue-600
              transition-all duration-200
              flex items-center gap-2 group
            "
          >
            <Activity className="w-4 h-4 group-hover:text-blue-600 transition-colors duration-200" />
            <span className="group-hover:text-blue-600 transition-colors duration-200">Dashboard</span>
          </button>
          
          {/* Sign Out Button */}
          <button 
            onClick={handleSignOut}
            className="
              w-full px-4 py-2 rounded-lg
              text-gray-600 text-sm
              hover:text-red-600
              transition-all duration-200
              flex items-center gap-2 group
            "
          >
            <LogOut className="w-4 h-4 group-hover:text-red-600 transition-colors duration-200" />
            <span className="group-hover:text-red-600 transition-colors duration-200">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Dashboard Overlay */}
      {showDashboard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-test glass-blur border border-white/20 rounded-lg p-6 max-w-md mx-4 w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Dashboard</h3>
              <button
                onClick={() => setShowDashboard(false)}
                className="p-1 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-gray-600">Sessions</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {dashboardData.totalSessions}
                </p>
              </div>

              <div className="bg-white/5 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-gray-600">Total Cost</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  ${dashboardData.totalCost.toFixed(2)}
                </p>
              </div>

              <div className="bg-white/5 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-600" />
                  <span className="text-xs text-gray-600">Tokens</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  {dashboardData.totalTokens.toLocaleString()}
                </p>
              </div>

              <div className="bg-white/5 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <span className="text-xs text-gray-600">This Month</span>
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  ${dashboardData.monthlyUsage.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {sessionToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-test glass-blur border border-white/20 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Session
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to delete this chat session? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setSessionToDelete(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
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
    </>
  )
}