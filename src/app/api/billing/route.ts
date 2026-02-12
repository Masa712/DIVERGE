import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler, createAppError, ErrorCategory } from '@/lib/errors/error-handler'
import { getPlanById } from '@/types/subscription'
import { log } from '@/lib/utils/logger'

// GET - Fetch billing data (subscription, usage, plan)
export const GET = withErrorHandler(async (request: NextRequest) => {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
    )
  }

  // Fetch active subscription first
  const { data: subscriptionData, error: subError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (subError && subError.code !== 'PGRST116') {
    throw createAppError(
      'Failed to fetch subscription',
      ErrorCategory.DATABASE,
      { context: { userId: user.id }, cause: subError }
    )
  }

  // FIXED: Fetch current usage quota - use "next reset after now" instead of exact match
  // This avoids timestamp precision issues (milliseconds vs microseconds)
  const now = new Date()

  const { data: usageData, error: usageError } = await supabase
    .from('usage_quotas')
    .select('*')
    .eq('user_id', user.id)
    .gte('reset_date', now.toISOString())  // reset_date >= now
    .order('reset_date', { ascending: true })  // earliest first
    .limit(1)
    .maybeSingle()

  if (usageError && usageError.code !== 'PGRST116') {
    throw createAppError(
      'Failed to fetch usage quota',
      ErrorCategory.DATABASE,
      { context: { userId: user.id }, cause: usageError }
    )
  }

  if (usageData) {
    console.log('📅 [Billing API] Found usage quota with reset date:', new Date(usageData.reset_date).toISOString())
  } else {
    console.log('⚠️ [Billing API] No usage quota found for user')
  }

  // Determine plan with priority: subscription > usage_quota > user_profile > default free
  let planId = 'free'

  // Debug log to identify the issue
  console.log('🔍 [Billing API] Determining plan:', {
    userId: user.id,
    subscriptionPlanId: subscriptionData?.plan_id,
    usagePlanId: usageData?.plan_id,
    hasSubscription: !!subscriptionData,
    subscriptionStatus: subscriptionData?.status,
  })

  if (subscriptionData?.plan_id) {
    planId = subscriptionData.plan_id
    console.log('✅ [Billing API] Using plan from subscription:', planId)
  } else if (usageData?.plan_id) {
    planId = usageData.plan_id
    console.log('✅ [Billing API] Using plan from usage quota:', planId)
  } else {
    // Fallback to user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_plan')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile?.subscription_plan) {
      planId = profile.subscription_plan
      console.log('✅ [Billing API] Using plan from user profile:', planId)
    } else {
      console.log('⚠️ [Billing API] No plan found, defaulting to free')
    }
  }

  let plan = getPlanById(planId)

  // Handle unknown plan IDs
  if (planId === 'unknown' || !plan) {
    console.error('❌ [Billing API] Unknown plan ID detected:', planId)
    // If user has active subscription but unknown plan, default to Plus
    if (subscriptionData && subscriptionData.status === 'active') {
      console.log('🔧 [Billing API] Active subscription with unknown plan - defaulting to Plus')
      planId = 'plus'
      plan = getPlanById(planId) // Re-fetch plan with corrected ID
    }
  }

  console.log('📊 [Billing API] Final plan determined:', {
    planId,
    planName: plan?.name,
    webSearchLimit: plan?.limits.webSearchLimit,
  })

  return NextResponse.json({
    success: true,
    data: {
      subscription: subscriptionData,
      usage: usageData,
      plan: plan
    }
  })
})
