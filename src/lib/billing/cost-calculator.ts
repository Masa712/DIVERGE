import { AVAILABLE_MODELS } from '@/types'
import { CREDIT_RATE_USD } from '@/types/subscription'

// Build pricing lookup from authoritative AVAILABLE_MODELS
const PRICING_MAP = new Map<string, { input: number; output: number }>(
  AVAILABLE_MODELS.map(m => [m.id, m.costPerMillionTokens])
)

// Default pricing for unknown models (conservative estimate)
const DEFAULT_PRICING = { input: 5, output: 15 }

/**
 * Get pricing for a model (cost per 1M tokens)
 */
export function getModelPricing(modelId: string): { input: number; output: number } {
  return PRICING_MAP.get(modelId) || DEFAULT_PRICING
}

/**
 * Calculate actual cost in USD from input and output tokens
 */
export function calculateCostUsd(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = getModelPricing(modelId)
  const inputCost = (promptTokens / 1_000_000) * pricing.input
  const outputCost = (completionTokens / 1_000_000) * pricing.output
  return Math.round((inputCost + outputCost) * 10000) / 10000
}

/**
 * Estimate cost for pre-check (before API call)
 */
export function estimateCostUsd(
  modelId: string,
  estimatedInputTokens: number,
  maxOutputTokens: number
): number {
  return calculateCostUsd(modelId, estimatedInputTokens, maxOutputTokens)
}

/**
 * Convert USD amount to credits for display (preserves 3 decimal places)
 */
export function usdToCredits(usd: number): number {
  return Math.round((usd / CREDIT_RATE_USD) * 1000) / 1000
}

/**
 * Format a credit value for display (shows decimals only when needed)
 */
export function formatCredits(credits: number): string {
  if (credits >= 100 || Number.isInteger(credits)) {
    return Math.round(credits).toLocaleString()
  }
  // Remove trailing zeros: 0.100 → 0.1, 0.050 → 0.05, 0.003 → 0.003
  return parseFloat(credits.toFixed(3)).toString()
}

/**
 * Format credit usage for error/display messages
 */
export function formatCreditUsage(costUsed: number, costLimit: number): string {
  const creditsUsed = usdToCredits(costUsed)
  const creditsLimit = usdToCredits(costLimit)
  return `${formatCredits(creditsUsed)} / ${formatCredits(creditsLimit)}`
}
