/**
 * Guest Chat API
 * 認証不要のゲストユーザー向けチャットAPI
 * - 低コストモデルのみ許可
 * - IPレート制限あり
 * - Web検索は無効
 * - DBに保存しない（クライアント側のLocalStorageで管理）
 */

import { NextRequest } from 'next/server'
import { OpenRouterClient, supportsReasoning, getReasoningConfig } from '@/lib/openrouter/client'
import { GUEST_LIMITS } from '@/lib/guest/guest-session'
import { checkGuestRateLimit } from '@/lib/guest/rate-limiter'

// ゲスト用のトークン制限（推論トークンを考慮して十分な値に設定）
const GUEST_MAX_TOKENS = 4096

export async function POST(request: NextRequest) {
  try {
    // IPアドレスを取得
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    // レート制限チェック
    const rateLimitResult = await checkGuestRateLimit(ip)
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later or sign up for unlimited access.',
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitResult.retryAfter || 60),
          },
        }
      )
    }

    const body = await request.json()
    const {
      messages,
      model,
      temperature = 0.7,
      max_tokens = 1000,
      guestId,
    } = body

    // 必須パラメータチェック
    if (!messages || !model) {
      return new Response(
        JSON.stringify({ error: 'Messages and model are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ゲストIDチェック
    if (!guestId || !guestId.startsWith('guest_')) {
      return new Response(
        JSON.stringify({ error: 'Valid guest ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // モデル制限チェック
    const allowedModels = GUEST_LIMITS.allowedModels as readonly string[]
    if (!allowedModels.includes(model)) {
      return new Response(
        JSON.stringify({
          error: 'Model not allowed for guest users',
          message: `Guest users can only use: ${allowedModels.join(', ')}. Sign up for access to more models.`,
          allowedModels,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // OpenRouterクライアント初期化
    const openRouterClient = new OpenRouterClient()

    // 推論モデル用の設定を構築
    const requestParams: Parameters<typeof openRouterClient.createChatCompletion>[0] = {
      messages,
      model,
      temperature,
      max_tokens: Math.min(max_tokens, GUEST_MAX_TOKENS),
    }

    // 推論をサポートするモデルの場合、低い推論努力を設定（コスト削減）
    if (supportsReasoning(model)) {
      requestParams.reasoning = getReasoningConfig(model, 'low')
    }

    // ストリーミングレスポンスを作成
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 非ストリーミングで取得（シンプルな実装）
          const response = await openRouterClient.createChatCompletion(requestParams)

          // レスポンスをSSE形式で送信
          const content = response.choices?.[0]?.message?.content || ''

          // コンテンツを送信
          const data = JSON.stringify({
            type: 'content',
            content,
            usage: response.usage,
          })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))

          // 完了を送信
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()
        } catch (error) {
          console.error('[Guest Chat] Error:', error)
          const errorMessage = error instanceof Error ? error.message : 'An error occurred'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Guest-Remaining-Requests': String(rateLimitResult.remaining || 0),
      },
    })
  } catch (error) {
    console.error('Guest chat API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
