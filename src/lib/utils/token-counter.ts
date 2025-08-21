/**
 * Accurate token counting using tiktoken library
 * Supports multiple model families with proper encoding
 */

import { encoding_for_model, get_encoding } from 'tiktoken'

// Model to encoding mapping for accurate token counting
const MODEL_ENCODINGS = {
  // OpenAI GPT models
  'gpt-4': 'cl100k_base',
  'gpt-4o': 'o200k_base',
  'gpt-4o-mini': 'o200k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-3.5-turbo': 'cl100k_base',
  
  // Anthropic Claude models (use cl100k_base as approximation)
  'claude-3-opus': 'cl100k_base',
  'claude-3-sonnet': 'cl100k_base',
  'claude-3-haiku': 'cl100k_base',
  'claude-3.5-sonnet': 'cl100k_base',
  
  // Fallback
  'default': 'cl100k_base'
} as const

type ModelKey = keyof typeof MODEL_ENCODINGS

// Cache encoders to avoid repeated initialization
const encoderCache = new Map<string, any>()

/**
 * Get tiktoken encoder for a specific model
 */
function getEncoder(model: string) {
  if (encoderCache.has(model)) {
    return encoderCache.get(model)
  }
  
  let encoder
  try {
    // Try model-specific encoding first
    if (model.startsWith('gpt-4') || model.startsWith('gpt-3.5')) {
      encoder = encoding_for_model(model as any)
    } else {
      // Use appropriate base encoding
      const encodingName = MODEL_ENCODINGS[model as ModelKey] || MODEL_ENCODINGS.default
      encoder = get_encoding(encodingName)
    }
  } catch (error) {
    console.warn(`Failed to get encoding for model ${model}, using default:`, error)
    encoder = get_encoding('cl100k_base')
  }
  
  encoderCache.set(model, encoder)
  return encoder
}

/**
 * Count tokens accurately using tiktoken
 */
export function countTokens(text: string, model: string = 'gpt-4o'): number {
  if (!text) return 0
  
  try {
    const encoder = getEncoder(model)
    const tokens = encoder.encode(text)
    return tokens.length
  } catch (error) {
    console.warn('Tiktoken encoding failed, falling back to estimation:', error)
    return estimateTokensFallback(text)
  }
}

/**
 * Count tokens for multiple texts efficiently
 */
export function countTokensBatch(texts: string[], model: string = 'gpt-4o'): number[] {
  if (texts.length === 0) return []
  
  try {
    const encoder = getEncoder(model)
    return texts.map(text => {
      if (!text) return 0
      return encoder.encode(text).length
    })
  } catch (error) {
    console.warn('Batch tiktoken encoding failed, falling back to estimation:', error)
    return texts.map(estimateTokensFallback)
  }
}

/**
 * Count tokens for messages (with role tokens included)
 */
export function countMessageTokens(
  messages: Array<{ role: string; content: string }>,
  model: string = 'gpt-4o'
): number {
  if (messages.length === 0) return 0
  
  try {
    const encoder = getEncoder(model)
    let totalTokens = 0
    
    for (const message of messages) {
      // Count tokens for message content
      totalTokens += encoder.encode(message.content).length
      
      // Add tokens for role and message formatting
      // OpenAI format: {"role": "user", "content": "..."}
      totalTokens += encoder.encode(message.role).length
      totalTokens += 4 // Overhead for JSON structure and separators
    }
    
    // Add tokens for conversation wrapper
    totalTokens += 2
    
    return totalTokens
  } catch (error) {
    console.warn('Message token counting failed, falling back to estimation:', error)
    return messages.reduce((total, msg) => 
      total + estimateTokensFallback(msg.content) + estimateTokensFallback(msg.role) + 4, 2
    )
  }
}

/**
 * Fallback token estimation (improved from original)
 * Uses more sophisticated estimation based on language characteristics
 */
export function estimateTokensFallback(text: string): number {
  if (!text) return 0
  
  // More sophisticated estimation considering:
  // - English words average ~3.3 characters per token
  // - Japanese/Chinese characters ~1.5 characters per token
  // - Code and special characters ~4 characters per token
  
  const hasAsianChars = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text)
  const hasCode = /[{}()[\]<>;"'`=+\-*/%]/.test(text)
  
  let ratio: number
  if (hasAsianChars) {
    ratio = 2.0 // Asian languages are more token-dense
  } else if (hasCode) {
    ratio = 4.5 // Code has more symbols and special tokens
  } else {
    ratio = 3.8 // English text
  }
  
  return Math.ceil(text.length / ratio)
}

/**
 * Get token limit for a specific model
 */
export function getModelTokenLimit(model: string): number {
  const limits: Record<string, number> = {
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4': 8192,
    'gpt-4-turbo': 128000,
    'gpt-3.5-turbo': 16384,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    'claude-3.5-sonnet': 200000,
  }
  
  return limits[model] || 8192 // Conservative fallback
}

/**
 * Check if text would exceed model's token limit
 */
export function exceedsTokenLimit(text: string, model: string): boolean {
  const tokenCount = countTokens(text, model)
  const limit = getModelTokenLimit(model)
  return tokenCount > limit
}

/**
 * Truncate text to fit within token limit while preserving meaning
 */
export function truncateToTokenLimit(
  text: string, 
  model: string, 
  maxTokens?: number
): { text: string; tokenCount: number; truncated: boolean } {
  const limit = maxTokens || getModelTokenLimit(model)
  const currentTokens = countTokens(text, model)
  
  if (currentTokens <= limit) {
    return { text, tokenCount: currentTokens, truncated: false }
  }
  
  // Binary search for optimal truncation point
  let left = 0
  let right = text.length
  let bestTruncation = text.slice(0, Math.floor(text.length * 0.7))
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const truncated = text.slice(0, mid)
    const tokens = countTokens(truncated, model)
    
    if (tokens <= limit) {
      bestTruncation = truncated
      left = mid + 1
    } else {
      right = mid - 1
    }
  }
  
  const finalTokens = countTokens(bestTruncation, model)
  
  return {
    text: bestTruncation,
    tokenCount: finalTokens,
    truncated: true
  }
}

// Export the old function name for backward compatibility
export const estimateTokens = countTokens