import { ModelId } from '@/types'

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenRouterRequest {
  model: ModelId
  messages: OpenRouterMessage[]
  temperature?: number
  max_tokens?: number
  top_p?: number
  stream?: boolean
  transforms?: string[]
}

export interface OpenRouterResponse {
  id: string
  model: string
  object: string
  created: number
  choices: {
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class OpenRouterClient {
  private apiKey: string
  private baseUrl = 'https://openrouter.ai/api/v1'
  private siteUrl?: string
  private siteName?: string

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set')
    }
    this.apiKey = apiKey
    this.siteUrl = process.env.OPENROUTER_SITE_URL
    this.siteName = process.env.OPENROUTER_SITE_NAME
  }

  async createChatCompletion(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }

    if (this.siteUrl) {
      headers['HTTP-Referer'] = this.siteUrl
    }
    if (this.siteName) {
      headers['X-Title'] = this.siteName
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenRouter API error: ${error.error?.message || 'Unknown error'}`)
    }

    return response.json()
  }

  async createStreamingChatCompletion(
    request: OpenRouterRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }

    if (this.siteUrl) {
      headers['HTTP-Referer'] = this.siteUrl
    }
    if (this.siteName) {
      headers['X-Title'] = this.siteName
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...request, stream: true }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenRouter API error: ${error.error?.message || 'Unknown error'}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            return
          }

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              onChunk(content)
            }
          } catch (e) {
            console.error('Error parsing SSE chunk:', e)
          }
        }
      }
    }
  }

  // Get available models from OpenRouter
  async getModels() {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch models from OpenRouter')
    }

    return response.json()
  }
}