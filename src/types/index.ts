export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'meta' | 'mistral'

export type ModelId = 
  // OpenAI Models via OpenRouter
  | 'openai/gpt-4o' 
  | 'openai/gpt-4-turbo' 
  | 'openai/gpt-3.5-turbo'
  | 'openai/o1-preview'
  | 'openai/o1-mini'
  // Anthropic Models via OpenRouter
  | 'anthropic/claude-3.5-sonnet' 
  | 'anthropic/claude-3-opus' 
  | 'anthropic/claude-3-haiku'
  | 'anthropic/claude-3-sonnet'
  // Google Models via OpenRouter
  | 'google/gemini-pro' 
  | 'google/gemini-pro-vision'
  | 'google/gemini-pro-1.5'
  // Meta Models via OpenRouter
  | 'meta-llama/llama-3.1-70b-instruct'
  | 'meta-llama/llama-3.1-8b-instruct'
  // Other Popular Models
  | 'mistralai/mistral-large'
  | 'mistralai/mixtral-8x7b-instruct'

// Model configuration with OpenRouter
export interface ModelConfig {
  id: ModelId
  name: string
  provider: string
  contextLength: number
  costPerMillionTokens: {
    input: number
    output: number
  }
}

// Available models via OpenRouter
export const AVAILABLE_MODELS: ModelConfig[] = [
  // OpenAI
  { 
    id: 'openai/gpt-4o', 
    name: 'GPT-4o', 
    provider: 'OpenAI',
    contextLength: 128000,
    costPerMillionTokens: { input: 5, output: 15 }
  },
  { 
    id: 'openai/gpt-4-turbo', 
    name: 'GPT-4 Turbo', 
    provider: 'OpenAI',
    contextLength: 128000,
    costPerMillionTokens: { input: 10, output: 30 }
  },
  { 
    id: 'openai/gpt-3.5-turbo', 
    name: 'GPT-3.5 Turbo', 
    provider: 'OpenAI',
    contextLength: 16385,
    costPerMillionTokens: { input: 0.5, output: 1.5 }
  },
  // Anthropic
  { 
    id: 'anthropic/claude-3.5-sonnet', 
    name: 'Claude 3.5 Sonnet', 
    provider: 'Anthropic',
    contextLength: 200000,
    costPerMillionTokens: { input: 3, output: 15 }
  },
  { 
    id: 'anthropic/claude-3-opus', 
    name: 'Claude 3 Opus', 
    provider: 'Anthropic',
    contextLength: 200000,
    costPerMillionTokens: { input: 15, output: 75 }
  },
  // Google
  { 
    id: 'google/gemini-pro', 
    name: 'Gemini Pro', 
    provider: 'Google',
    contextLength: 32000,
    costPerMillionTokens: { input: 0.5, output: 1.5 }
  },
  // Meta
  { 
    id: 'meta-llama/llama-3.1-70b-instruct', 
    name: 'Llama 3.1 70B', 
    provider: 'Meta',
    contextLength: 128000,
    costPerMillionTokens: { input: 0.8, output: 0.8 }
  },
]

export type NodeStatus = 'pending' | 'streaming' | 'completed' | 'failed' | 'cancelled'

export interface ChatNode {
  id: string
  parentId: string | null
  sessionId: string
  model: ModelId
  systemPrompt: string | null
  prompt: string
  response: string | null
  status: NodeStatus
  errorMessage: string | null
  depth: number
  promptTokens: number
  responseTokens: number
  costUsd: number
  temperature: number | null
  maxTokens: number | null
  topP: number | null
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  name: string
  description: string | null
  userId: string
  rootNodeId: string | null
  totalCostUsd: number
  totalTokens: number
  nodeCount: number
  maxDepth: number
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  lastAccessedAt: Date
}

export interface UsageLog {
  id: string
  userId: string
  sessionId: string
  nodeId: string
  model: ModelId
  action: 'generate' | 'retry' | 'branch'
  promptTokens: number
  completionTokens: number
  costUsd: number
  latencyMs: number
  cacheHit: boolean
  createdAt: Date
}

export interface ContextCache {
  id: string
  nodeId: string
  contextHash: string
  context: string
  tokenCount: number
  expiresAt: Date
  createdAt: Date
}

export interface UserQuota {
  id: string
  userId: string
  periodStart: Date
  periodEnd: Date
  tokenQuota: number
  tokensUsed: number
  costQuotaUsd: number
  costUsedUsd: number
  updatedAt: Date
}

export interface TreeNode {
  node: ChatNode
  children: TreeNode[]
}

export interface GenerateRequest {
  nodeId?: string
  parentId?: string
  sessionId: string
  prompt: string
  model?: ModelId
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface GenerateResponse {
  node: ChatNode
  contextUsed: string[]
  cacheHit: boolean
}