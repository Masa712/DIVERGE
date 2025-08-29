# AI Internet Access Implementation Guide

## Overview
Enable AI models to search the web and access current information.

## 1. Search API Options

### Option A: Perplexity API (Recommended)
**Pros**: Built for AI, returns clean structured data
**Cons**: Requires API key, costs per query

```bash
# .env.local
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxx
```

### Option B: Tavily Search API
**Pros**: Designed for LLMs, good relevance
**Cons**: Newer service, limited free tier

```bash
# .env.local
TAVILY_API_KEY=tvly-xxxxxxxxxxxxx
```

### Option C: Serper API (Google Search)
**Pros**: Real Google results, comprehensive
**Cons**: More expensive, needs parsing

```bash
# .env.local
SERPER_API_KEY=xxxxxxxxxxxxx
```

## 2. Implementation Architecture

### Search Service
```typescript
// src/services/search/search-service.ts
import { PerplexityClient } from './providers/perplexity'
import { TavilyClient } from './providers/tavily'
import { SerperClient } from './providers/serper'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  content?: string
  publishedDate?: Date
}

export class SearchService {
  private provider: 'perplexity' | 'tavily' | 'serper'
  
  constructor(provider = 'perplexity') {
    this.provider = provider
  }
  
  async search(query: string, options?: {
    maxResults?: number
    recency?: 'day' | 'week' | 'month' | 'year'
  }): Promise<SearchResult[]> {
    // Check cache first
    const cached = await this.getCachedResults(query)
    if (cached) return cached
    
    // Perform search based on provider
    let results: SearchResult[]
    
    switch(this.provider) {
      case 'perplexity':
        results = await PerplexityClient.search(query, options)
        break
      case 'tavily':
        results = await TavilyClient.search(query, options)
        break
      case 'serper':
        results = await SerperClient.search(query, options)
        break
    }
    
    // Cache results
    await this.cacheResults(query, results)
    
    return results
  }
  
  private async getCachedResults(query: string): Promise<SearchResult[] | null> {
    // Implement Redis/Supabase cache lookup
    // Use the web_search_cache table from migration
  }
  
  private async cacheResults(query: string, results: SearchResult[]) {
    // Store in web_search_cache table
  }
}
```

### Perplexity Provider Example
```typescript
// src/services/search/providers/perplexity.ts
export class PerplexityClient {
  static async search(query: string, options?: any): Promise<SearchResult[]> {
    const response = await fetch('https://api.perplexity.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        max_results: options?.maxResults || 5,
        search_recency: options?.recency || 'month',
        return_citations: true,
        return_sources: true,
      }),
    })
    
    const data = await response.json()
    
    return data.citations.map((citation: any) => ({
      title: citation.title,
      url: citation.url,
      snippet: citation.snippet,
      content: citation.text,
      publishedDate: citation.published_date,
    }))
  }
}
```

## 3. AI Model Integration

### Function Calling Setup
```typescript
// src/lib/llm/tools/web-search.ts
export const webSearchTool = {
  name: 'web_search',
  description: 'Search the internet for current information',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      recency: {
        type: 'string',
        enum: ['day', 'week', 'month', 'year'],
        description: 'How recent the results should be',
      },
    },
    required: ['query'],
  },
  
  async execute(params: { query: string; recency?: string }) {
    const searchService = new SearchService()
    const results = await searchService.search(params.query, {
      maxResults: 5,
      recency: params.recency as any,
    })
    
    // Log tool usage
    await logToolUsage({
      tool_name: 'web_search',
      tool_type: 'search',
      input_params: params,
      output_data: results,
    })
    
    return results
  },
}
```

### OpenRouter Integration
```typescript
// src/lib/llm/openrouter-with-tools.ts
export async function createChatCompletionWithTools({
  messages,
  model,
  tools = [],
  enableSearch = false,
}) {
  const availableTools = [...tools]
  
  if (enableSearch) {
    availableTools.push(webSearchTool)
  }
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      tools: availableTools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      tool_choice: 'auto',
    }),
  })
  
  const data = await response.json()
  
  // Handle tool calls
  if (data.choices[0].message.tool_calls) {
    const toolResults = await executeToolCalls(data.choices[0].message.tool_calls)
    // Add tool results to messages and continue conversation
  }
  
  return data
}
```

## 4. UI Implementation

### Search Toggle
```typescript
// src/components/chat/search-toggle.tsx
export function SearchToggle({ enabled, onChange }) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg">
      <Globe className="w-4 h-4" />
      <span className="text-sm">Internet Access</span>
      <Switch
        checked={enabled}
        onChange={onChange}
        className={`${enabled ? 'bg-blue-600' : 'bg-gray-300'} ...`}
      />
    </div>
  )
}
```

### Search Results Display
```typescript
// src/components/chat/search-results.tsx
export function SearchResults({ results }) {
  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-blue-600" />
        <span className="text-sm font-medium">Sources</span>
      </div>
      <div className="space-y-2">
        {results.map((result, i) => (
          <a
            key={i}
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2 hover:bg-blue-100 rounded"
          >
            <div className="text-sm font-medium text-blue-600">
              {result.title}
            </div>
            <div className="text-xs text-gray-600">
              {result.snippet}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
```

## 5. Cost Management

### Rate Limiting
```typescript
// src/lib/rate-limit/search-limiter.ts
export class SearchRateLimiter {
  static async checkLimit(userId: string): Promise<boolean> {
    const key = `search:${userId}:${new Date().toISOString().split('T')[0]}`
    const count = await redis.incr(key)
    
    if (count === 1) {
      await redis.expire(key, 86400) // 24 hours
    }
    
    const limit = await this.getUserSearchLimit(userId)
    return count <= limit
  }
  
  static async getUserSearchLimit(userId: string): Promise<number> {
    // Check user plan/tier
    const profile = await getUserProfile(userId)
    
    switch(profile.plan) {
      case 'pro': return 1000
      case 'basic': return 100
      default: return 10
    }
  }
}
```

### Cost Tracking
```sql
-- Add to usage_logs table
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS
  search_queries INTEGER DEFAULT 0,
  search_cost_usd DECIMAL(10, 6) DEFAULT 0;

-- Function to track search usage
CREATE OR REPLACE FUNCTION track_search_usage(
  p_user_id UUID,
  p_query TEXT,
  p_provider TEXT,
  p_cost DECIMAL
)
RETURNS void AS $$
BEGIN
  -- Update daily usage
  INSERT INTO usage_logs (
    user_id,
    action,
    search_queries,
    search_cost_usd,
    created_at
  ) VALUES (
    p_user_id,
    'search',
    1,
    p_cost,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (user_id, DATE(created_at))
  DO UPDATE SET
    search_queries = usage_logs.search_queries + 1,
    search_cost_usd = usage_logs.search_cost_usd + p_cost;
    
  -- Store in tool calls
  INSERT INTO ai_tool_calls (
    tool_name,
    tool_type,
    input_params,
    status
  ) VALUES (
    'web_search',
    'search',
    jsonb_build_object('query', p_query, 'provider', p_provider),
    'completed'
  );
END;
$$ LANGUAGE plpgsql;
```

## 6. Testing & Deployment

### Environment Setup
```bash
# Development
ENABLE_WEB_SEARCH=true
SEARCH_PROVIDER=perplexity
SEARCH_CACHE_TTL=3600

# Production
ENABLE_WEB_SEARCH=true
SEARCH_PROVIDER=perplexity
SEARCH_RATE_LIMIT=100
SEARCH_CACHE_TTL=86400
```

### Testing Checklist
- [ ] Search returns relevant results
- [ ] Results are cached properly
- [ ] Rate limiting works
- [ ] Cost tracking accurate
- [ ] UI shows search status
- [ ] Sources are cited properly
- [ ] Fallback for API failures

## 7. Best Practices

1. **Always cache results** - Reduce API costs
2. **Implement fallbacks** - Multiple providers
3. **Show sources** - Transparency for users
4. **Rate limit** - Prevent abuse
5. **Monitor costs** - Track usage per user
6. **Timeout handling** - Don't block on slow searches
7. **Content filtering** - Remove inappropriate results