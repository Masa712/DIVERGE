import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/utils/logger'
import { calculateCostUsd } from '@/lib/billing/cost-calculator'

export interface UsageData {
  userId: string
  tokensUsed: number
  promptTokens?: number
  completionTokens?: number
  modelId: string
  sessionId: string
  nodeId: string
}

/**
 * Helper function to get current usage quota for any plan type
 * Works for both calendar-based (Free) and subscription-based (Plus/Pro) resets
 * FIXED: Uses "next reset after now" instead of hardcoded next month
 */
async function getCurrentUsageQuota(userId: string) {
  const supabase = await createClient()
  const now = new Date()

  const { data, error } = await supabase
    .from('usage_quotas')
    .select('*')
    .eq('user_id', userId)
    .gte('reset_date', now.toISOString())  // reset_date >= now
    .order('reset_date', { ascending: true })  // earliest first
    .limit(1)
    .maybeSingle()

  return { data, error }
}

/**
 * Check if user has sufficient cost budget for the requested operation
 */
export async function checkUserQuota(userId: string, estimatedCostUsd: number): Promise<{
  allowed: boolean
  currentCostUsed: number
  costLimit: number
  currentUsage: number
  limit: number
  planId: string
}> {
  const supabase = await createClient()

  try {
    const { data: quota, error } = await getCurrentUsageQuota(userId)

    if (error && error.code !== 'PGRST116') {
      log.error('Failed to fetch user quota', error)
      return { allowed: false, currentCostUsed: 0, costLimit: 0, currentUsage: 0, limit: 0, planId: 'free' }
    }

    if (!quota) {
      const { error: initError } = await supabase.rpc('initialize_user_quota', {
        p_user_id: userId,
        p_plan_id: 'free'
      })

      if (initError) {
        log.error('Failed to initialize user quota', initError)
        return { allowed: false, currentCostUsed: 0, costLimit: 0, currentUsage: 0, limit: 0, planId: 'free' }
      }

      return {
        allowed: estimatedCostUsd <= 1.0,
        currentCostUsed: 0,
        costLimit: 1.0,
        currentUsage: 0,
        limit: 500000,
        planId: 'free'
      }
    }

    const costUsed = Number(quota.monthly_cost_used) || 0
    const costLimit = Number(quota.monthly_cost_limit) || 1.0
    const wouldExceedBudget = costLimit !== -1 && (costUsed + estimatedCostUsd) > costLimit

    return {
      allowed: !wouldExceedBudget,
      currentCostUsed: costUsed,
      costLimit: costLimit,
      currentUsage: quota.monthly_tokens_used,
      limit: quota.monthly_tokens_limit,
      planId: quota.plan_id
    }
  } catch (error) {
    log.error('Error checking user quota', error)
    return { allowed: false, currentCostUsed: 0, costLimit: 0, currentUsage: 0, limit: 0, planId: 'free' }
  }
}

/**
 * Track actual token usage after API call
 */
export async function trackTokenUsage(usage: UsageData): Promise<boolean> {
  const supabase = await createClient()

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

    // Track cost usage (authoritative quota enforcement)
    const costUsd = calculateCostUsd(
      usage.modelId,
      usage.promptTokens || 0,
      usage.completionTokens || usage.tokensUsed
    )
    const { error: costError } = await supabase.rpc('update_cost_usage', {
      p_user_id: usage.userId,
      p_cost_usd: costUsd
    })
    if (costError) {
      log.warn('Failed to update cost usage', costError)
    }

    // Log usage for analytics
    await logUsageEvent(usage)

    log.debug('Token usage tracked successfully', {
      userId: usage.userId,
      tokensUsed: usage.tokensUsed,
      costUsd,
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
  const supabase = await createClient()
  
  try {
    const { error } = await supabase.from('usage_logs').insert({
      user_id: usage.userId,
      session_id: usage.sessionId,
      node_id: usage.nodeId,
      model: usage.modelId,
      action: 'generate',
      prompt_tokens: usage.promptTokens || 0,
      completion_tokens: usage.completionTokens || usage.tokensUsed,
      cost_usd: calculateCostUsd(usage.modelId, usage.promptTokens || 0, usage.completionTokens || usage.tokensUsed),
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
 * Get user's current subscription plan
 */
export async function getUserPlan(userId: string): Promise<string> {
  const supabase = await createClient()

  try {
    // FIXED: Use helper function to get current quota (works for all plan types)
    const { data: quota, error } = await getCurrentUsageQuota(userId)

    if (error || !quota) {
      log.warn('Failed to get user plan from usage_quotas, defaulting to free', error)

      // Try to initialize quota for this user
      await supabase.rpc('initialize_user_quota', {
        p_user_id: userId,
        p_plan_id: 'free'
      })

      return 'free'
    }

    return quota.plan_id || 'free'
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
  return plan === 'plus' || plan === 'pro' || plan === 'enterprise' ||
         plan === 'plus-yearly' || plan === 'pro-yearly' || plan === 'enterprise-yearly'
}

/**
 * Check if user can perform web search
 */
export async function canUseWebSearch(userId: string): Promise<{
  allowed: boolean
  currentUsage: number
  limit: number
}> {
  const supabase = await createClient()

  try {
    // Use database function to check web search quota
    const { data, error } = await supabase.rpc('can_use_web_search', {
      user_id: userId
    })

    if (error) {
      log.error('Failed to check web search quota', error)
      return { allowed: false, currentUsage: 0, limit: 0 }
    }

    // FIXED: Use helper function to get current quota (works for all plan types)
    const { data: quota } = await getCurrentUsageQuota(userId)

    return {
      allowed: data === true,
      currentUsage: quota?.web_searches_used || 0,
      limit: quota?.web_searches_limit || 10
    }
  } catch (error) {
    log.error('Error checking web search quota', error)
    return { allowed: false, currentUsage: 0, limit: 0 }
  }
}

/**
 * Increment web search usage counter
 */
export async function trackWebSearchUsage(userId: string): Promise<boolean> {
  const supabase = await createClient()

  try {
    // Use database function to increment web search usage
    const { data, error } = await supabase.rpc('increment_web_search_usage', {
      user_id: userId
    })

    if (error) {
      log.error('Failed to increment web search usage', error)
      return false
    }

    if (!data) {
      log.warn('Web search usage update rejected - quota exceeded', {
        userId
      })
      return false
    }

    log.debug('Web search usage tracked successfully', {
      userId
    })

    return true
  } catch (error) {
    log.error('Error tracking web search usage', error)
    return false
  }
}

/**
 * Check if user can create a new session
 */
export async function canCreateSession(userId: string): Promise<{
  allowed: boolean
  currentSessions: number
  limit: number
}> {
  const supabase = await createClient()

  try {
    // FIXED: Use helper function to get current quota (works for all plan types)
    const { data: quota, error } = await getCurrentUsageQuota(userId)

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      log.error('Failed to fetch session quota', error)
      return { allowed: false, currentSessions: 0, limit: 0 }
    }

    // If no quota record exists, initialize with free plan
    if (!quota) {
      const { error: initError } = await supabase.rpc('initialize_user_quota', {
        p_user_id: userId,
        p_plan_id: 'free'
      })

      if (initError) {
        log.error('Failed to initialize user quota', initError)
        return { allowed: false, currentSessions: 0, limit: 0 }
      }

      // Return free plan limits (unlimited sessions)
      return {
        allowed: true,
        currentSessions: 0,
        limit: -1
      }
    }

    const { sessions_this_month, sessions_limit } = quota

    // -1 means unlimited
    if (sessions_limit === -1) {
      return {
        allowed: true,
        currentSessions: sessions_this_month,
        limit: -1
      }
    }

    // Check if user has reached the limit
    const canCreate = sessions_this_month < sessions_limit

    return {
      allowed: canCreate,
      currentSessions: sessions_this_month,
      limit: sessions_limit
    }
  } catch (error) {
    log.error('Error checking session creation quota', error)
    return { allowed: false, currentSessions: 0, limit: 0 }
  }
}

/**
 * Increment session count for the user
 */
export async function incrementSessionCount(userId: string): Promise<boolean> {
  const supabase = await createClient()

  try {
    // FIXED: Use helper function to get current quota (works for all plan types)
    const { data: quota, error: fetchError } = await getCurrentUsageQuota(userId)

    if (fetchError) {
      log.error('Failed to fetch session quota for increment', fetchError)
      return false
    }

    if (!quota) {
      log.warn('No quota record found for user', { userId })
      return false
    }

    // Check if incrementing would exceed limit (-1 means unlimited)
    if (quota.sessions_limit !== -1 && quota.sessions_this_month >= quota.sessions_limit) {
      log.warn('Session limit reached, cannot increment', {
        userId,
        currentSessions: quota.sessions_this_month,
        limit: quota.sessions_limit
      })
      return false
    }

    // Increment session count (update using the actual reset_date from the quota)
    const { error: updateError } = await supabase
      .from('usage_quotas')
      .update({
        sessions_this_month: quota.sessions_this_month + 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('reset_date', quota.reset_date)  // Use actual reset_date, not calculated

    if (updateError) {
      log.error('Failed to increment session count', updateError)
      return false
    }

    log.debug('Session count incremented successfully', {
      userId,
      newCount: quota.sessions_this_month + 1
    })

    return true
  } catch (error) {
    log.error('Error incrementing session count', error)
    return false
  }
}

/**
 * Estimate token usage for a prompt (rough estimation)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4)
}
