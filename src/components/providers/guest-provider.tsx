'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
  GuestSession,
  GuestNode,
  getGuestSession,
  createGuestSession,
  addGuestNode,
  updateGuestNode,
  clearGuestSession,
  clearGuestData,
  getRemainingNodes,
  hasReachedLimit,
  isModelAllowedForGuest,
  GUEST_LIMITS,
} from '@/lib/guest/guest-session'
import { useAuth } from './auth-provider'

interface GuestContextType {
  // State
  isGuest: boolean
  isInitialized: boolean
  guestSession: GuestSession | null
  remainingNodes: number
  hasReachedLimit: boolean

  // Actions
  initGuestSession: () => GuestSession
  addNode: (node: Omit<GuestNode, 'id' | 'createdAt' | 'updatedAt'>) => { node: GuestNode } | { error: string }
  updateNode: (nodeId: string, updates: Partial<GuestNode>) => void
  clearSession: () => void
  clearAllGuestData: () => void

  // Utils
  isModelAllowed: (model: string) => boolean

  // Limits
  limits: typeof GUEST_LIMITS
}

const GuestContext = createContext<GuestContextType | null>(null)

export function GuestProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // 認証状態に基づいてゲスト状態を判定
  const isGuest = !authLoading && !user

  // 初期化: LocalStorageからセッションを読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return

    const session = getGuestSession()
    setGuestSession(session)
    setIsInitialized(true)
  }, [])

  // ユーザーがログインしたらゲストセッションをクリア
  useEffect(() => {
    if (user && guestSession) {
      // ログイン時にゲストデータをクリア
      clearGuestSession()
      setGuestSession(null)
    }
  }, [user, guestSession])

  // ゲストセッションを初期化
  const initGuestSession = useCallback(() => {
    const session = createGuestSession()
    setGuestSession(session)
    return session
  }, [])

  // ノードを追加
  const addNode = useCallback((
    node: Omit<GuestNode, 'id' | 'createdAt' | 'updatedAt'>
  ): { node: GuestNode } | { error: string } => {
    const currentSession = guestSession || createGuestSession()

    const result = addGuestNode(currentSession, node)

    if ('error' in result) {
      return { error: result.error }
    }

    setGuestSession(result.session)
    return { node: result.node }
  }, [guestSession])

  // ノードを更新
  // 注意: 非同期処理中にセッションが更新される可能性があるため、
  // 常に最新のセッションをLocalStorageから取得する
  const updateNode = useCallback((nodeId: string, updates: Partial<GuestNode>) => {
    // 最新のセッションをLocalStorageから取得
    const currentSession = getGuestSession()
    if (!currentSession) return

    const updatedSession = updateGuestNode(currentSession, nodeId, updates)
    setGuestSession(updatedSession)
  }, [])

  // セッションをクリア
  const clearSession = useCallback(() => {
    clearGuestSession()
    setGuestSession(null)
  }, [])

  // 全ゲストデータをクリア
  const clearAllGuestData = useCallback(() => {
    clearGuestData()
    setGuestSession(null)
  }, [])

  // モデルが許可されているかチェック
  const isModelAllowed = useCallback((model: string) => {
    return isModelAllowedForGuest(model)
  }, [])

  const value: GuestContextType = {
    isGuest,
    isInitialized,
    guestSession,
    remainingNodes: getRemainingNodes(guestSession),
    hasReachedLimit: hasReachedLimit(guestSession),
    initGuestSession,
    addNode,
    updateNode,
    clearSession,
    clearAllGuestData,
    isModelAllowed,
    limits: GUEST_LIMITS,
  }

  // 常にProviderをレンダリング（nullを返さない）
  return (
    <GuestContext.Provider value={value}>
      {children}
    </GuestContext.Provider>
  )
}

export function useGuest() {
  const context = useContext(GuestContext)
  if (!context) {
    throw new Error('useGuest must be used within a GuestProvider')
  }
  return context
}
