# OpenRouter Integration

## Overview
The project has been configured to use OpenRouter as the primary LLM provider, allowing access to multiple AI models through a single API key.

## Environment Variables
- `OPENROUTER_API_KEY`: Required - Your OpenRouter API key
- `OPENROUTER_SITE_URL`: Optional - Site URL for analytics (default: http://localhost:3000)
- `OPENROUTER_SITE_NAME`: Optional - Site name for analytics (default: Diverge)

## Available Models
Models are accessed using the format `provider/model-name`:
- OpenAI: `openai/gpt-4o`, `openai/gpt-4-turbo`, `openai/gpt-3.5-turbo`
- Anthropic: `anthropic/claude-3.5-sonnet`, `anthropic/claude-3-opus`, `anthropic/claude-3-haiku`
- Google: `google/gemini-pro`, `google/gemini-pro-vision`
- Meta: `meta-llama/llama-3.1-70b-instruct`
- Mistral: `mistralai/mistral-large`, `mistralai/mixtral-8x7b-instruct`

## Implementation
- Client: `/src/lib/openrouter/client.ts` - OpenRouter API client with streaming support
- API Routes:
  - `/src/app/api/chat/route.ts` - Standard chat completion
  - `/src/app/api/chat/stream/route.ts` - Streaming chat completion
- Types: Updated in `/src/types/index.ts` with ModelId and ModelConfig

## Cost Tracking
Each model has different cost per million tokens for input/output, automatically calculated and stored in the database.

## Usage
The client supports both regular and streaming completions, with automatic error handling and database integration for chat history.