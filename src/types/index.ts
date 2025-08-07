export type ModelProvider = 'openai' | 'anthropic' | 'google'

export type ModelId = 
  | 'gpt-4o' 
  | 'gpt-4-turbo' 
  | 'gpt-3.5-turbo'
  | 'claude-3-opus' 
  | 'claude-3-sonnet' 
  | 'claude-3-haiku'
  | 'gemini-pro' 
  | 'gemini-pro-vision'

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

export interface ModelConfig {
  id: ModelId
  name: string
  provider: ModelProvider
  costPerThousandTokens: {
    input: number
    output: number
  }
  maxContextTokens: number
  available: boolean
}