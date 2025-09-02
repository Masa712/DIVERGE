import { tavily } from '@tavily/core'

export interface SearchResult {
  title: string
  url: string
  content: string
  score: number
}

export interface WebSearchResponse {
  query: string
  results: SearchResult[]
  answer?: string
}

class TavilyClient {
  private client: ReturnType<typeof tavily> | null = null

  constructor() {
    const apiKey = process.env.TAVILY_API_KEY
    if (apiKey && apiKey !== 'your_tavily_api_key_here') {
      this.client = tavily({ apiKey })
    }
  }

  async search(query: string, options?: {
    maxResults?: number
    includeAnswer?: boolean
    searchDepth?: 'basic' | 'advanced'
  }): Promise<WebSearchResponse> {
    if (!this.client) {
      throw new Error('Tavily API key not configured')
    }

    try {
      const response = await this.client.search(query, {
        maxResults: options?.maxResults || 5,
        includeAnswer: options?.includeAnswer !== false,
        searchDepth: options?.searchDepth || 'basic',
        includeRawContent: false,
        includeDomains: [],
        excludeDomains: []
      })

      return {
        query,
        results: response.results.map(result => ({
          title: result.title,
          url: result.url,
          content: result.content,
          score: result.score
        })),
        answer: response.answer
      }
    } catch (error) {
      console.error('Tavily search error:', error)
      throw new Error('Failed to perform web search')
    }
  }

  isConfigured(): boolean {
    return this.client !== null
  }
}

// Export singleton instance
export const tavilyClient = new TavilyClient()