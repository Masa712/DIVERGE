# Function Calling Implementation Test Guide

## What's Been Implemented

### 1. **Function Calling Support** ✅
- Created `/src/lib/openrouter/function-calling.ts` with tool definitions
- Updated OpenRouter client to support tool calls
- Created new API endpoint `/api/chat/with-tools` 

### 2. **Automatic Endpoint Selection** ✅
- Chat page automatically uses Function Calling endpoint for compatible models:
  - OpenAI GPT-4 and GPT-3.5 models
  - Anthropic Claude models
  - Google Gemini models

### 3. **Web Search Tool Definition** ✅
```typescript
{
  name: 'web_search',
  description: 'Search the web for current information',
  parameters: {
    query: string,
    search_type: 'general' | 'news' | 'technical' | 'product' | 'price'
  }
}
```

## How It Works

### Without Function Calling (Old Method)
1. User asks: "What's the latest news about AI?"
2. System checks for keywords like "latest", "news"
3. If found, performs web search
4. Includes results in context
5. AI responds

### With Function Calling (New Method)
1. User asks: "What's the latest news about AI?"
2. AI receives the question WITH tool definitions
3. AI decides: "I need current information, let me search"
4. AI calls: `web_search(query="AI news latest 2024", search_type="news")`
5. System executes search
6. AI receives results and formulates response

## Testing Instructions

### Test 1: Basic Web Search
1. Start a new chat session
2. Select a compatible model (e.g., `gpt-4o-mini`)
3. Ask: "What's happening with OpenAI today?"
4. Watch the logs for:
   - `"Function calling evaluation"`
   - `"Model requested tool calls"`
   - `"Executing web search"`

### Test 2: No Search Needed
1. Ask: "Explain recursion in programming"
2. Model should respond directly without searching

### Test 3: Complex Query
1. Ask: "Compare the latest iPhone with the latest Samsung Galaxy"
2. Model should search for both products

### Test 4: Japanese Query
1. Ask: "今日の東京の天気はどうですか？"
2. Model should understand and search for Tokyo weather

## Expected Log Output

When Function Calling is working:
```
{"msg":"Function calling evaluation","shouldUseTools":true,"model":"openai/gpt-4o-mini"}
{"msg":"Model requested tool calls","count":1}
{"msg":"Executing web search","query":"OpenAI news today","type":"news"}
{"msg":"Web search completed","resultCount":5}
{"msg":"Sending tool results back to model"}
```

## Advantages Over Keyword Detection

1. **Context Aware**: AI understands when searches are truly needed
2. **Better Queries**: AI formulates optimal search queries
3. **Language Agnostic**: Works in any language
4. **Smarter Decisions**: Avoids unnecessary searches
5. **Multiple Searches**: Can perform multiple searches in one request

## Models That Support Function Calling

### Fully Supported (Recommended)
- `openai/gpt-4o`
- `openai/gpt-4o-mini` ⭐ (Best cost/performance)
- `openai/gpt-4-turbo`
- `openai/gpt-3.5-turbo`

### Also Supported
- `anthropic/claude-3-opus`
- `anthropic/claude-3-sonnet`
- `anthropic/claude-3-haiku`
- `google/gemini-pro`
- `google/gemini-pro-1.5`

## Troubleshooting

### If searches aren't happening:
1. Check model compatibility
2. Verify web search toggle is ON (blue icon)
3. Check Tavily API key is configured
4. Look for errors in console logs

### If getting errors:
1. Check browser console for detailed errors
2. Verify `/api/chat/with-tools` endpoint is accessible
3. Check if model supports Function Calling

## Next Steps

The implementation is complete! To test:
1. Reload the application
2. Start a new chat with `gpt-4o-mini`
3. Ask a question requiring current information
4. The AI will automatically use web search when needed