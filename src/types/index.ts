export type ModelProvider = 'OpenAI' | 'Anthropic' | 'Google' | 'xAI'

export type ModelId = 
  // OpenAI Latest Models via OpenRouter
  | 'openai/gpt-5'
  | 'openai/gpt-5-mini'
  | 'openai/gpt-oss-120b'
  | 'openai/o3'
  | 'openai/gpt-4.1'
  | 'openai/gpt-4o-2024-11-20'
  // Anthropic Latest Models via OpenRouter
  | 'anthropic/claude-opus-4.1'
  | 'anthropic/claude-opus-4'
  | 'anthropic/claude-sonnet-4'
  // Google Latest Models via OpenRouter
  | 'google/gemini-2.5-flash'
  | 'google/gemini-2.5-pro'
  // xAI Latest Models via OpenRouter (Note: x-ai with hyphen, not xai)
  | 'x-ai/grok-4'
  | 'x-ai/grok-3'
  | 'x-ai/grok-3-mini'

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
  // OpenAI Latest Models
  { 
    id: 'openai/gpt-5', 
    name: 'GPT-5', 
    provider: 'OpenAI',
    contextLength: 256000,
    costPerMillionTokens: { input: 20, output: 60 }
  },
  { 
    id: 'openai/gpt-5-mini', 
    name: 'GPT-5 Mini', 
    provider: 'OpenAI',
    contextLength: 128000,
    costPerMillionTokens: { input: 8, output: 24 }
  },
  { 
    id: 'openai/gpt-oss-120b', 
    name: 'GPT-OSS 120B', 
    provider: 'OpenAI',
    contextLength: 128000,
    costPerMillionTokens: { input: 5, output: 15 }
  },
  { 
    id: 'openai/o3', 
    name: 'O3', 
    provider: 'OpenAI',
    contextLength: 128000,
    costPerMillionTokens: { input: 15, output: 45 }
  },
  { 
    id: 'openai/gpt-4.1', 
    name: 'GPT-4.1', 
    provider: 'OpenAI',
    contextLength: 128000,
    costPerMillionTokens: { input: 12, output: 36 }
  },
  { 
    id: 'openai/gpt-4o-2024-11-20', 
    name: 'GPT-4o', 
    provider: 'OpenAI',
    contextLength: 128000,
    costPerMillionTokens: { input: 5, output: 15 }
  },
  // Anthropic Latest Models
  { 
    id: 'anthropic/claude-opus-4.1', 
    name: 'Claude Opus 4.1', 
    provider: 'Anthropic',
    contextLength: 400000,
    costPerMillionTokens: { input: 25, output: 100 }
  },
  { 
    id: 'anthropic/claude-opus-4', 
    name: 'Claude Opus 4', 
    provider: 'Anthropic',
    contextLength: 300000,
    costPerMillionTokens: { input: 20, output: 80 }
  },
  { 
    id: 'anthropic/claude-sonnet-4', 
    name: 'Claude Sonnet 4', 
    provider: 'Anthropic',
    contextLength: 250000,
    costPerMillionTokens: { input: 8, output: 32 }
  },
  // Google Latest Models
  { 
    id: 'google/gemini-2.5-flash', 
    name: 'Gemini 2.5 Flash', 
    provider: 'Google',
    contextLength: 1000000,
    costPerMillionTokens: { input: 0.25, output: 0.75 }
  },
  { 
    id: 'google/gemini-2.5-pro', 
    name: 'Gemini 2.5 Pro', 
    provider: 'Google',
    contextLength: 2000000,
    costPerMillionTokens: { input: 2.5, output: 7.5 }
  },
  // xAI Latest Models
  { 
    id: 'x-ai/grok-4', 
    name: 'Grok 4', 
    provider: 'xAI',
    contextLength: 256000,
    costPerMillionTokens: { input: 18, output: 54 }
  },
  { 
    id: 'x-ai/grok-3', 
    name: 'Grok 3', 
    provider: 'xAI',
    contextLength: 128000,
    costPerMillionTokens: { input: 10, output: 30 }
  },
  { 
    id: 'x-ai/grok-3-mini', 
    name: 'Grok 3 Mini', 
    provider: 'xAI',
    contextLength: 64000,
    costPerMillionTokens: { input: 4, output: 12 }
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
  lastNodeCreatedAt: Date | null
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

export interface UserProfile {
  id?: string
  user_id?: string
  display_name?: string
  avatar_url?: string
  bio?: string
  default_model?: ModelId
  default_temperature?: number
  default_max_tokens?: number
  preferences?: Record<string, any>
  created_at?: Date
  updated_at?: Date
}