/**
 * Model access restrictions by subscription plan
 */

import { ModelId } from '@/types'

/**
 * Free plan: 7 basic ultra-low-cost models
 * Based on the revenue plan specification and available ModelId types
 * Focused on the most cost-effective models for free tier
 */
export const FREE_PLAN_MODELS: ModelId[] = [
  // Ultra low-cost models (< $1/M tokens)
  'deepseek/deepseek-v3.2-exp', // DeepSeek V3.2 (163K context, $0.216 input)
  'deepseek/deepseek-chat-v3.1', // DeepSeek V3.1 (164K context, $0.27 input)
  'google/gemini-2.5-flash', // Gemini Flash (1M context, $0.25 input)
  'openai/gpt-5-nano', // GPT-5 Nano (400K context, $0.05 input)
  'x-ai/grok-4.1-fast', // Grok 4.1 Fast (2M context, $0.20 input, $0.50 output)

  // Low-cost models ($1-10/M tokens)
  'openai/gpt-oss-120b', // GPT OSS 120B (128K context, $5 input)

  // Medium-cost with large context
  'x-ai/grok-4-fast', // Grok 4 Fast (2M context, $10 input)
]

/**
 * Advanced models (Plus/Pro plans only)
 * These are the premium models with higher costs
 */
export const ADVANCED_MODELS: ModelId[] = [
  'openai/gpt-5', // GPT-5
  'openai/gpt-5-pro', // GPT-5 Pro
  'anthropic/claude-opus-4.5', // Claude Opus 4.5
  'anthropic/claude-opus-4.1', // Claude Opus 4.1
  'anthropic/claude-opus-4', // Claude Opus 4
  'x-ai/grok-4', // Grok-4
]

/**
 * All available models grouped by cost tier
 */
export const MODEL_TIERS = {
  // High-cost models (Plus: 20% limit, Pro: unlimited)
  high: [
    'anthropic/claude-opus-4',
    'anthropic/claude-opus-4.1',
    'anthropic/claude-opus-4.5', // $5/$25
    'openai/gpt-5', // $20/$60
    'openai/gpt-5-pro', // $15/$120
  ] as ModelId[],

  // Medium-cost models (Plus: 50% limit, Pro: unlimited)
  medium: [
    'openai/gpt-4o-2024-11-20',
    'openai/o3',
    'openai/gpt-4.1',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-sonnet-4.5', // $3/$15
    'google/gemini-3-pro-preview', // $2/$12
    'google/gemini-2.5-pro',
    'x-ai/grok-3',
    'x-ai/grok-4',
  ] as ModelId[],

  // Low-cost models (all plans: unlimited within total token limit)
  low: [
    ...FREE_PLAN_MODELS,
    'anthropic/claude-haiku-4.5', // $1/$5
    'openai/gpt-5.1', // $1.25/$10
    'openai/gpt-5-mini', // $8/$24
    'x-ai/grok-3-mini',
  ] as ModelId[],
}

/**
 * Check if a model is available for free plan users
 */
export function isModelAvailableForFreePlan(model: string): boolean {
  return FREE_PLAN_MODELS.includes(model as ModelId)
}

/**
 * Check if a model is an advanced model requiring Plus/Pro subscription
 */
export function isAdvancedModel(model: string): boolean {
  return ADVANCED_MODELS.includes(model as ModelId)
}

/**
 * Get model tier (high/medium/low cost)
 */
export function getModelTier(model: string): 'high' | 'medium' | 'low' | null {
  if (MODEL_TIERS.high.includes(model as ModelId)) return 'high'
  if (MODEL_TIERS.medium.includes(model as ModelId)) return 'medium'
  if (MODEL_TIERS.low.includes(model as ModelId)) return 'low'
  return null
}

/**
 * Get user-friendly error message for model access restriction
 */
export function getModelAccessErrorMessage(plan: string, model: string): string {
  if (plan === 'free') {
    const modelCount = FREE_PLAN_MODELS.length
    const displayModels = FREE_PLAN_MODELS.slice(0, 3).join(', ')
    const remaining = modelCount - 3
    return `This model is not available on the Free plan. Please upgrade to Plus or Pro to access all models. Free plan includes: ${displayModels} and ${remaining} more models.`
  }

  if (isAdvancedModel(model)) {
    return `Advanced models require a Plus or Pro subscription. Please upgrade your plan to access ${model}.`
  }

  return 'This model is not available on your current plan. Please upgrade to access it.'
}