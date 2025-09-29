import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/utils/logger'

export interface UsageData {
  userId: string
  tokensUsed: number
  modelId: string
  sessionId: string
  nodeId: string
}

/**
 * Check if user has sufficient quota for the requested operation
 */
export async function checkUserQuota(userId: string, estimatedTokens: number): Promise<{
  allowed: boolean
  currentUsage: number
  limit: number
  planId: string
}> {
  const supabase = createClient()
  
  try {
    // Get current usage quota
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setDate(1)
    nextMonth.setHours(0, 0, 0, 0)

    const { data: quota, error } = await supabase
      .from('usage_quotas')
      .select('*')
      .eq('user_id', userId)
      .gte('reset_date', nextMonth.toISOString())
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      log.error('Failed to fetch user quota', error)
      return { allowed: false, currentUsage: 0, limit: 0, planId: 'free' }
    }

    // If no quota record exists, initialize with free plan
    if (!quota) {
      const { error: initError } = await supabase.rpc('initialize_user_quota', {
        user_id: userId,
        plan_id: 'free'
      })

      if (initError) {
        log.error('Failed to initialize user quota', initError)
        return { allowed: false, currentUsage: 0, limit: 0, planId: 'free' }
      }

      // Return free plan limits
      return {
        allowed: estimatedTokens <= 10000,
        currentUsage: 0,
        limit: 10000,
        planId: 'free'
      }
    }

    const { monthly_tokens_used, monthly_tokens_limit, plan_id } = quota
    const wouldExceedLimit = monthly_tokens_limit !== -1 && 
                            (monthly_tokens_used + estimatedTokens) > monthly_tokens_limit

    return {
      allowed: !wouldExceedLimit,
      currentUsage: monthly_tokens_used,
      limit: monthly_tokens_limit,
      planId: plan_id
    }
  } catch (error) {
    log.error('Error checking user quota', error)
    return { allowed: false, currentUsage: 0, limit: 0, planId: 'free' }
  }
}

/**
 * Track actual token usage after API call
 */
export async function trackTokenUsage(usage: UsageData): Promise<boolean> {
  const supabase = createClient()
  
  try {
    // Use the database function to safely update token usage
    const { data, error } = await supabase.rpc('update_token_usage', {
      user_id: usage.userId,
      tokens_used: usage.tokensUsed
    })

    if (error) {
      log.error('Failed to update token usage', error)
      return false
    }

    if (!data) {
      log.warn('Token usage update rejected - quota exceeded', {
        userId: usage.userId,
        tokensUsed: usage.tokensUsed
      })
      return false
    }

    // Log usage for analytics
    await logUsageEvent(usage)

    log.debug('Token usage tracked successfully', {
      userId: usage.userId,
      tokensUsed: usage.tokensUsed,
      modelId: usage.modelId
    })

    return true
  } catch (error) {
    log.error('Error tracking token usage', error)
    return false
  }
}

/**
 * Log usage event for analytics and billing
 */
async function logUsageEvent(usage: UsageData): Promise<void> {
  const supabase = createClient()
  
  try {
    const { error } = await supabase.from('usage_logs').insert({
      user_id: usage.userId,
      session_id: usage.sessionId,
      node_id: usage.nodeId,
      model: usage.modelId,
      action: 'generate',
      prompt_tokens: 0, // Will be updated with actual values
      completion_tokens: usage.tokensUsed,
      cost_usd: calculateCost(usage.modelId, usage.tokensUsed),
      latency_ms: 0, // Will be updated with actual values
      cache_hit: false,
      created_at: new Date().toISOString()
    })

    if (error) {
      log.warn('Failed to log usage event', error)
    }
  } catch (error) {
    log.warn('Error logging usage event', error)
  }
}

/**
 * Calculate cost based on model pricing
 */
function calculateCost(modelId: string, tokens: number): number {
  // Cost per 1M tokens (in USD)
  const pricing: Record<string, { input: number, output: number }> = {
    'openai/gpt-5': { input: 20, output: 60 },
    'openai/gpt-5-mini': { input: 8, output: 24 },
    'openai/gpt-4o-2024-11-20': { input: 5, output: 15 },
    'anthropic/claude-opus-4.1': { input: 25, output: 100 },
    'anthropic/claude-opus-4': { input: 20, output: 80 },
    'anthropic/claude-sonnet-4': { input: 8, output: 32 },
    'google/gemini-2.5-flash': { input: 0.25, output: 0.75 },
    'google/gemini-2.5-pro': { input: 2.5, output: 7.5 },
    'x-ai/grok-4': { input: 18, output: 54 },
    'x-ai/grok-3': { input: 10, output: 30 },
    'x-ai/grok-3-mini': { input: 4, output: 12 },
  }

  const modelPricing = pricing[modelId] || { input: 5, output: 15 } // Default fallback
  
  // Assume all tokens are output tokens for simplicity (more conservative)
  return (tokens / 1000000) * modelPricing.output
}

/**
 * Get user's current subscription plan
 */
export async function getUserPlan(userId: string): Promise<string> {
  const supabase = createClient()
  
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_plan')
      .eq('user_id', userId)
      .single()

    return profile?.subscription_plan || 'free'
  } catch (error) {
    log.warn('Failed to get user plan', error)
    return 'free'
  }
}

/**
 * Check if user has access to advanced models
 */
export async function canUseAdvancedModels(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId)
  return plan === 'pro' || plan === 'enterprise' || plan === 'pro-yearly' || plan === 'enterprise-yearly'
}

/**
 * Estimate token usage for a prompt (rough estimation)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4)
}