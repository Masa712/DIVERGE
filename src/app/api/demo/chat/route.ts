import { NextRequest, NextResponse } from 'next/server'
import { OpenRouterClient } from '@/lib/openrouter/client'
import { ModelId } from '@/types'
import { log } from '@/lib/utils/logger'

// Demo allowed models (free tier only)
const DEMO_ALLOWED_MODELS: ModelId[] = [
  'deepseek/deepseek-chat-v3.1',
  'x-ai/grok-4-fast'
]

// Simple in-memory rate limiting (IP-based)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10 // 10 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { messages, model, nodeCount } = body

    // Validate required fields
    if (!messages || !model) {
      return NextResponse.json(
        { error: 'Messages and model are required' },
        { status: 400 }
      )
    }

    // Validate node count (5 node limit)
    if (nodeCount >= 5) {
      return NextResponse.json(
        { error: 'Demo limit reached. Please sign up to continue.' },
        { status: 403 }
      )
    }

    // Validate model is in demo allowed list
    if (!DEMO_ALLOWED_MODELS.includes(model)) {
      return NextResponse.json(
        { error: 'Model not available in demo. Please use DeepSeek V3.1 or Grok 4 Fast.' },
        { status: 400 }
      )
    }

    log.info('Demo chat request', { model, nodeCount, ip })

    // Create OpenRouter client and get response
    const client = new OpenRouterClient()
    const response = await client.createChatCompletion({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    })

    const content = response.choices?.[0]?.message?.content || ''
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }

    log.info('Demo chat response', {
      model,
      nodeCount,
      tokensUsed: usage.total_tokens
    })

    return NextResponse.json({
      success: true,
      data: {
        content,
        usage
      }
    })

  } catch (error) {
    log.error('Demo chat error', error)

    return NextResponse.json(
      { error: 'Failed to generate response. Please try again.' },
      { status: 500 }
    )
  }
}
