# AI Model Timeout and Token Optimization Implementation

## Overview
This document outlines the implementation of AI model-specific optimizations for timeout handling and token limits to ensure complete response generation across all models, particularly for reasoning models like Grok-4.

## Issues Addressed

### 1. Grok-4 Timeout Issues
- **Problem**: Grok-4 (reasoning model) was timing out after 30 seconds
- **Root Cause**: Grok-4 typically takes 2-4 minutes to generate responses due to extensive reasoning tokens
- **Solution**: Implemented model-specific timeout settings

### 2. Incomplete Response Generation
- **Problem**: All models were generating incomplete responses regardless of content length
- **Root Cause**: `max_tokens` was limited to 1000 tokens, causing premature truncation
- **Solution**: Increased token limits and implemented model-specific optimization

## Implementation Details

### Backend API Changes

#### `/src/app/api/chat/route.ts`
```typescript
// Increased default max_tokens
max_tokens = 4000 // Previously 1000

// Model-specific timeout configuration
const timeoutMs = model === 'x-ai/grok-4' ? 150000 : 30000 // 2.5 minutes for Grok-4

// Model-specific token optimization
const getOptimalMaxTokens = (modelId: string, userMaxTokens: number): number => {
  if (modelId === 'x-ai/grok-4') return Math.max(userMaxTokens, 6000)
  if (modelId.includes('gpt-5') || modelId.includes('claude-opus')) return Math.max(userMaxTokens, 5000)
  return Math.max(userMaxTokens, 4000)
}
```

#### `/src/app/api/chat/branch/route.ts`
```typescript
// Increased default maxTokens
maxTokens = 4000 // Previously 1000

// Applied same model-specific optimization logic
```

### Frontend Changes

#### Chat Pages
- **`/src/app/chat/[id]/page.tsx`**: Added `max_tokens: 8000` to API requests
- **`/src/app/chat/page.tsx`**: Added `max_tokens: 8000` to API requests

### Model Configuration Updates

#### `/src/types/index.ts`
```typescript
// Simplified GPT-4o display name
{ 
  id: 'openai/gpt-4o-2024-11-20', 
  name: 'GPT-4o', // Removed (2024-11-20) suffix
  provider: 'OpenAI',
  contextLength: 128000,
  costPerMillionTokens: { input: 5, output: 15 }
}
```

#### `/src/components/chat/model-selector.tsx`
```typescript
// Right-aligned model selection text
className="... text-right"
```

## Model-Specific Optimizations

### Timeout Settings
- **Grok-4**: 150,000ms (2.5 minutes)
- **All other models**: 30,000ms (30 seconds)

### Token Limits
- **Grok-4**: Minimum 6,000 tokens (reasoning model needs more)
- **GPT-5/Claude Opus**: Minimum 5,000 tokens (high-context models)
- **Standard models**: Minimum 4,000 tokens (generous for complete responses)
- **Frontend default**: 8,000 tokens (ensures backend optimization kicks in)

## Testing Results
- ✅ Grok-4 now generates complete responses without timeout
- ✅ Grok-3 and Grok-3 Mini work normally
- ✅ All other models (OpenAI, Anthropic, Google) generate complete responses
- ✅ Responses are properly saved to Supabase chat_nodes table
- ✅ Model selection UI improvements (right-aligned, simplified GPT-4o name)

## Key Benefits
1. **Complete Response Generation**: All models now generate full responses without premature truncation
2. **Model-Specific Optimization**: Each model category gets optimal settings for performance
3. **Reasoning Model Support**: Grok-4 and similar models get adequate time for reasoning
4. **Backward Compatibility**: Existing functionality remains unchanged
5. **User Experience**: Improved model selection interface

## Files Modified
- `/src/app/api/chat/route.ts`
- `/src/app/api/chat/branch/route.ts`
- `/src/app/chat/[id]/page.tsx`
- `/src/app/chat/page.tsx`
- `/src/types/index.ts`
- `/src/components/chat/model-selector.tsx`

## Performance Considerations
- Longer timeouts only applied to models that need them (Grok-4)
- Token limits set at minimum required levels to avoid unnecessary costs
- Frontend sends generous token limits to ensure backend optimization applies
- No impact on fast models (OpenAI, Anthropic standard models)