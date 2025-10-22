import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler, createAppError, ErrorCategory } from '@/lib/errors/error-handler'
import { getPlanById } from '@/types/subscription'

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

  if (subscriptionData?.plan_id) {
    planId = subscriptionData.plan_id
  } else if (usageData?.plan_id) {
    planId = usageData.plan_id
  } else {
    // Fallback to user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_plan')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile?.subscription_plan) {
      planId = profile.subscription_plan
    }
  }

  const plan = getPlanById(planId)

  return NextResponse.json({
    success: true,
    data: {
      subscription: subscriptionData,
      usage: usageData,
      plan: plan
    }
  })
})
