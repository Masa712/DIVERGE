import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler, createAppError, ErrorCategory } from '@/lib/errors/error-handler'
import { getPlanById } from '@/types/subscription'
import { log } from '@/lib/utils/logger'

// GET - Fetch billing data (subscription, usage, plan)
export const GET = withErrorHandler(async (request: NextRequest) => {
  const supabase = createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw createAppError(
      'User authentication required',
      ErrorCategory.AUTHENTICATION
    )
  }

  // Calculate the first day of next month at UTC midnight without overflow issues
  const now = new Date()
  const nextMonth = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1, // first day of next month
    0, 0, 0, 0
  ))

  // Fetch active subscription
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

  // Fetch usage quota
  const { data: usageData, error: usageError } = await supabase
    .from('usage_quotas')
    .select('*')
    .eq('user_id', user.id)
    .eq('reset_date', nextMonth.toISOString())
    .maybeSingle()

  if (usageError && usageError.code !== 'PGRST116') {
    throw createAppError(
      'Failed to fetch usage quota',
      ErrorCategory.DATABASE,
      { context: { userId: user.id }, cause: usageError }
    )
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
