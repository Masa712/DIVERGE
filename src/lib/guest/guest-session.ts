/**
 * Guest Session Management
 * LocalStorageを使用したゲストユーザーのセッション管理
 */

import { v4 as uuidv4 } from 'uuid'

// ゲストユーザー制限
export const GUEST_LIMITS = {
  maxSessions: 1,
  maxNodesPerSession: 10,
  allowedModels: [
    'openai/gpt-5-nano',
    'anthropic/claude-haiku-4.5',
  ] as const,
  ipRateLimit: {
    requests: 100,
    windowMs: 60 * 60 * 1000, // 1時間
  },
}

// LocalStorageキー
const GUEST_SESSION_KEY = 'diverge_guest_session'
const GUEST_ID_KEY = 'diverge_guest_id'

// ゲストノードの型
export interface GuestNode {
  id: string
  parentId: string | null
  model: string
  prompt: string
  response: string
  status: 'pending' | 'streaming' | 'completed' | 'error'
  depth: number
  createdAt: string
  updatedAt: string
}

// ゲストセッションの型
export interface GuestSession {
  id: string
  guestId: string
  name: string
  nodes: GuestNode[]
  rootNodeId: string | null
  createdAt: string
  updatedAt: string
  lastAccessedAt: string
}

// ゲストセッションストレージの型
interface GuestSessionStorage {
  session: GuestSession | null
  version: number
}

/**
 * ゲストIDを取得または生成
 */
export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return ''

  let guestId = localStorage.getItem(GUEST_ID_KEY)
  if (!guestId) {
    guestId = `guest_${uuidv4()}`
    localStorage.setItem(GUEST_ID_KEY, guestId)
  }
  return guestId
}

/**
 * ゲストセッションを取得
 */
export function getGuestSession(): GuestSession | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(GUEST_SESSION_KEY)
    if (!stored) return null

    const data: GuestSessionStorage = JSON.parse(stored)
    return data.session
  } catch (error) {
    console.error('Failed to get guest session:', error)
    return null
  }
}

/**
 * ゲストセッションを保存
 */
export function saveGuestSession(session: GuestSession): void {
  if (typeof window === 'undefined') return

  try {
    const data: GuestSessionStorage = {
      session,
      version: 1,
    }
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save guest session:', error)
  }
}

/**
 * 新しいゲストセッションを作成
 */
export function createGuestSession(): GuestSession {
  const guestId = getOrCreateGuestId()
  const now = new Date().toISOString()

  const session: GuestSession = {
    id: `local_${uuidv4()}`,
    guestId,
    name: 'Guest Chat',
    nodes: [],
    rootNodeId: null,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
  }

  saveGuestSession(session)
  return session
}

/**
 * ゲストセッションにノードを追加
 */
export function addGuestNode(
  session: GuestSession,
  node: Omit<GuestNode, 'id' | 'createdAt' | 'updatedAt'>
): { session: GuestSession; node: GuestNode } | { error: string } {
  // ノード数制限チェック
  if (session.nodes.length >= GUEST_LIMITS.maxNodesPerSession) {
    return { error: 'Node limit reached. Please sign up to continue.' }
  }

  const now = new Date().toISOString()
  const newNode: GuestNode = {
    ...node,
    id: `local_node_${uuidv4()}`,
    createdAt: now,
    updatedAt: now,
  }

  const updatedSession: GuestSession = {
    ...session,
    nodes: [...session.nodes, newNode],
    rootNodeId: session.rootNodeId || newNode.id,
    updatedAt: now,
    lastAccessedAt: now,
  }

  saveGuestSession(updatedSession)
  return { session: updatedSession, node: newNode }
}

/**
 * ゲストノードを更新
 */
export function updateGuestNode(
  session: GuestSession,
  nodeId: string,
  updates: Partial<GuestNode>
): GuestSession {
  const now = new Date().toISOString()

  const updatedSession: GuestSession = {
    ...session,
    nodes: session.nodes.map(node =>
      node.id === nodeId
        ? { ...node, ...updates, updatedAt: now }
        : node
    ),
    updatedAt: now,
    lastAccessedAt: now,
  }

  saveGuestSession(updatedSession)
  return updatedSession
}

/**
 * ゲストセッションをクリア
 */
export function clearGuestSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(GUEST_SESSION_KEY)
}

/**
 * ゲストIDをクリア（完全リセット）
 */
export function clearGuestData(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(GUEST_SESSION_KEY)
  localStorage.removeItem(GUEST_ID_KEY)
}

/**
 * ゲストユーザーかどうかを判定
 */
export function isGuestUser(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(GUEST_ID_KEY)
}

/**
 * 残りノード数を取得
 */
export function getRemainingNodes(session: GuestSession | null): number {
  if (!session) return GUEST_LIMITS.maxNodesPerSession
  return Math.max(0, GUEST_LIMITS.maxNodesPerSession - session.nodes.length)
}

/**
 * 制限に達しているかチェック
 */
export function hasReachedLimit(session: GuestSession | null): boolean {
  if (!session) return false
  return session.nodes.length >= GUEST_LIMITS.maxNodesPerSession
}

/**
 * モデルがゲストユーザーに許可されているかチェック
 */
export function isModelAllowedForGuest(model: string): boolean {
  return (GUEST_LIMITS.allowedModels as readonly string[]).includes(model)
}

/**
 * ゲストセッションをChatNode形式に変換（既存UIとの互換性用）
 */
export function convertGuestNodesToTreeFormat(session: GuestSession) {
  return session.nodes.map(node => ({
    id: node.id,
    sessionId: session.id,
    parentId: node.parentId,
    model: node.model,
    systemPrompt: null,
    prompt: node.prompt,
    response: node.response,
    status: node.status === 'error' ? 'failed' : node.status,
    errorMessage: node.status === 'error' ? node.response : null,
    depth: node.depth,
    promptTokens: 0,
    responseTokens: 0,
    costUsd: 0,
    temperature: 0.7,
    maxTokens: 4096,
    topP: null,
    metadata: {},
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.updatedAt),
  }))
}
