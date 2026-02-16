'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useGuest } from '@/components/providers/guest-provider'
import { AnimatedBackground } from '@/components/ui/AnimatedBackground'
import { GuestChatInput } from '@/components/guest/guest-chat-input'
import { GuestLimitBanner } from '@/components/guest/guest-limit-banner'
import { SignUpModal } from '@/components/guest/sign-up-modal'
import { GuestNodeSidebar } from '@/components/guest/guest-node-sidebar'
import { ChatTreeView } from '@/components/tree/chat-tree-view'
import { GuestNode, convertGuestNodesToTreeFormat } from '@/lib/guest/guest-session'
import { ModelId, ModelConfig, ChatNode } from '@/types'
import Image from 'next/image'
import Link from 'next/link'

// ゲスト用に許可されたモデル設定
const GUEST_MODELS: ModelConfig[] = [
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'OpenAI',
    contextLength: 400000,
    costPerMillionTokens: { input: 0.05, output: 0.4 },
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    contextLength: 200000,
    costPerMillionTokens: { input: 1, output: 5 },
  },
]

export default function GuestChatPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const {
    isInitialized: guestInitialized,
    guestSession,
    remainingNodes,
    hasReachedLimit,
    initGuestSession,
    addNode,
    updateNode,
    limits,
  } = useGuest()

  const [selectedModel, setSelectedModel] = useState<ModelId>('openai/gpt-5-nano')
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>(undefined)
  const [showSignUpModal, setShowSignUpModal] = useState(false)
  const [sending, setSending] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedNodeForDetail, setSelectedNodeForDetail] = useState<ChatNode | null>(null)
  const [rightSidebarWidth, setRightSidebarWidth] = useState(400)

  // 認証済みユーザーは/chatにリダイレクト
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/chat')
    }
  }, [user, authLoading, router])

  // 現在のセッションのノードを取得（GuestNode形式）
  const guestNodes = useMemo(() => {
    return guestSession?.nodes || []
  }, [guestSession])

  // ChatNode形式に変換（ツリービュー用）
  const chatNodes: ChatNode[] = useMemo(() => {
    if (!guestSession) return []
    return convertGuestNodesToTreeFormat(guestSession) as ChatNode[]
  }, [guestSession])

  // サイドバーに表示するノードを chatNodes と同期
  // また、currentNodeId が設定されていてサイドバーが開いていない場合は開く
  useEffect(() => {
    if (currentNodeId && chatNodes.length > 0) {
      const currentChatNode = chatNodes.find((n: ChatNode) => n.id === currentNodeId)
      if (currentChatNode) {
        // 新しいノードが見つかった、またはノード内容が更新された
        if (!selectedNodeForDetail || selectedNodeForDetail.id !== currentNodeId) {
          // 新しいノードを選択
          setSelectedNodeForDetail(currentChatNode)
          setIsSidebarOpen(true)
        } else if (
          currentChatNode.response !== selectedNodeForDetail.response ||
          currentChatNode.status !== selectedNodeForDetail.status
        ) {
          // 同じノードだが内容が更新された
          setSelectedNodeForDetail(currentChatNode)
        }
      }
    }
  }, [chatNodes, currentNodeId, selectedNodeForDetail])

  // メッセージ送信ハンドラ
  const handleSendMessage = async (message: string) => {
    if (hasReachedLimit) {
      setShowSignUpModal(true)
      return
    }

    // セッションが存在しない場合は初期化
    const session = guestSession || initGuestSession()

    // 親ノードを決定
    let parentId: string | null = null
    let depth = 0
    if (currentNodeId) {
      const parentNode = guestNodes.find((n: GuestNode) => n.id === currentNodeId)
      if (parentNode) {
        parentId = parentNode.id
        depth = parentNode.depth + 1
      }
    } else if (guestNodes.length > 0) {
      // 最新のノードを親とする
      const latestNode = guestNodes[guestNodes.length - 1]
      parentId = latestNode.id
      depth = latestNode.depth + 1
    }

    // ノードを追加（pending状態）
    const result = addNode({
      parentId,
      model: selectedModel,
      prompt: message,
      response: '',
      status: 'streaming',
      depth,
    })

    if ('error' in result) {
      setShowSignUpModal(true)
      return
    }

    const newNode = result.node
    setCurrentNodeId(newNode.id)
    setSending(true)

    try {
      // ゲストチャットAPIを呼び出し
      const response = await fetch('/api/guest/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: buildMessageHistory(guestNodes, newNode, message),
          model: selectedModel,
          temperature: 0.7,
          max_tokens: 4096,
          guestId: session.guestId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 429) {
          // レート制限に達した
          updateNode(newNode.id, {
            status: 'error',
            response: 'Rate limit exceeded. Please try again later.',
          })
        } else {
          updateNode(newNode.id, {
            status: 'error',
            response: errorData.message || 'An error occurred.',
          })
        }
        return
      }

      // SSEストリームを読み取り
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'content') {
                  fullResponse = data.content
                  updateNode(newNode.id, {
                    response: fullResponse,
                    status: 'streaming',
                  })
                } else if (data.type === 'done') {
                  updateNode(newNode.id, {
                    response: fullResponse,
                    status: 'completed',
                  })
                } else if (data.type === 'error') {
                  updateNode(newNode.id, {
                    response: data.error,
                    status: 'error',
                  })
                }
              } catch {
                // JSON parse error - ignore invalid chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Guest chat error:', error)
      updateNode(newNode.id, {
        status: 'error',
        response: 'Network error. Please check your connection.',
      })
    } finally {
      setSending(false)
    }
  }

  // メッセージ履歴を構築
  const buildMessageHistory = (
    existingNodes: GuestNode[],
    currentNode: GuestNode,
    currentMessage: string
  ) => {
    const messages: { role: 'user' | 'assistant'; content: string }[] = []

    // 親ノードをたどって履歴を構築
    const buildPath = (nodeId: string | null): GuestNode[] => {
      if (!nodeId) return []
      const node = existingNodes.find(n => n.id === nodeId)
      if (!node) return []
      return [...buildPath(node.parentId), node]
    }

    const path = buildPath(currentNode.parentId)
    for (const node of path) {
      if (node.prompt) {
        messages.push({ role: 'user', content: node.prompt })
      }
      if (node.response && node.status === 'completed') {
        messages.push({ role: 'assistant', content: node.response })
      }
    }

    // 現在のメッセージを追加
    messages.push({ role: 'user', content: currentMessage })

    return messages
  }

  // ノードクリックハンドラ
  const handleNodeClick = (nodeId: string) => {
    setCurrentNodeId(nodeId)
    const guestNode = guestNodes.find((n: GuestNode) => n.id === nodeId)
    if (guestNode) {
      setSelectedModel(guestNode.model as ModelId)
    }
    // ChatNode形式のノードを取得してサイドバーに表示
    const chatNode = chatNodes.find((n: ChatNode) => n.id === nodeId)
    if (chatNode) {
      setSelectedNodeForDetail(chatNode)
      setIsSidebarOpen(true)
    }
  }

  // 背景クリックハンドラ（選択解除）
  const handleBackgroundClick = () => {
    setCurrentNodeId(undefined)
    setIsSidebarOpen(false)
    setSelectedNodeForDetail(null)
  }

  // サイドバーを閉じる
  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
    setSelectedNodeForDetail(null)
  }

  // ローディング中（認証またはゲスト初期化）
  if (authLoading || !guestInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AnimatedBackground opacity={0.4} />
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin relative z-10" />
      </div>
    )
  }

  // 認証済みユーザーの場合はリダイレクト中
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AnimatedBackground opacity={0.4} />
        <div className="text-center relative z-10">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col relative">
      <AnimatedBackground opacity={0.4} />

      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-4 pb-3">
        <div className="container mx-auto px-4">
          <div className="glass-nav rounded-full px-6 py-2.5 shadow-xl flex items-center justify-between max-w-4xl mx-auto">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden">
                <Image
                  src="/android-chrome-512x512.png"
                  alt="Diverge Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Diverge
              </span>
            </div>

            {/* Remaining Nodes Counter */}
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-gray-500">
                {remainingNodes}/{limits.maxNodesPerSession} messages remaining
              </span>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-3">
              <Link
                href="/auth"
                className="text-gray-700 hover:text-gray-900 font-medium transition-colors text-sm"
              >
                Sign In
              </Link>
              <Link
                href="/auth?tab=signup"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-full font-semibold shadow-lg transition-all transform hover:scale-105 text-sm"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 制限到達バナー */}
      {hasReachedLimit && (
        <div className="fixed top-20 left-0 right-0 z-40">
          <GuestLimitBanner onSignUp={() => setShowSignUpModal(true)} />
        </div>
      )}

      {/* メインコンテンツ - ツリービュー */}
      <main className="absolute inset-0 z-10">
        {chatNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Welcome to Diverge
              </h1>
              <p className="text-gray-600 mb-2">
                Experience AI conversation branching - try it free, no sign-up required.
              </p>
              <p className="text-sm text-gray-500">
                You can send up to {limits.maxNodesPerSession} messages as a guest.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-hidden">
            <ChatTreeView
              nodes={chatNodes}
              currentNodeId={currentNodeId}
              onNodeClick={handleNodeClick}
              onBackgroundClick={handleBackgroundClick}
              isRightSidebarOpen={isSidebarOpen}
              rightSidebarWidth={rightSidebarWidth}
            />
          </div>
        )}
      </main>

      {/* チャット入力 */}
      <GuestChatInput
        onSendMessage={handleSendMessage}
        disabled={hasReachedLimit || sending}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        availableModels={GUEST_MODELS}
        currentNodeId={currentNodeId}
        currentNodePrompt={guestNodes.find((n: GuestNode) => n.id === currentNodeId)?.prompt}
      />

      {/* サインアップモーダル */}
      <SignUpModal
        isOpen={showSignUpModal}
        onClose={() => setShowSignUpModal(false)}
      />

      {/* ノード詳細サイドバー */}
      <GuestNodeSidebar
        node={selectedNodeForDetail}
        allNodes={chatNodes}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        onWidthChange={setRightSidebarWidth}
      />
    </div>
  )
}
