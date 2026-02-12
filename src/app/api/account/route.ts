import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, createAppError, ErrorCategory } from '@/lib/errors/error-handler'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { cancelSubscription } from '@/lib/stripe/server'
import { log } from '@/lib/utils/logger'

interface SubscriptionRecord {
  id: string
  stripe_subscription_id: string | null
  status: string
  cancel_at_period_end: boolean | null
}

export const DELETE = withErrorHandler(async (_request: NextRequest) => {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError) {
    throw createAppError('Failed to verify authentication', ErrorCategory.AUTHENTICATION, {
      cause: authError
    })
  }

  if (!user) {
    throw createAppError('User authentication required', ErrorCategory.AUTHENTICATION)
  }

  const serviceSupabase = createServiceRoleClient()

  const { data: subscriptions, error: subscriptionFetchError } = await serviceSupabase
    .from('user_subscriptions')
    .select('id, stripe_subscription_id, status, cancel_at_period_end')
    .eq('user_id', user.id)
    .in('status', ['active', 'trialing', 'past_due', 'unpaid'])

  if (subscriptionFetchError) {
    throw createAppError('Failed to look up billing subscriptions', ErrorCategory.DATABASE, {
      cause: subscriptionFetchError,
      context: { userId: user.id }
    })
  }

  if (subscriptions && subscriptions.length > 0) {
    const activeSubscriptions = subscriptions as SubscriptionRecord[]

    for (const subscription of activeSubscriptions) {
      if (!subscription.stripe_subscription_id) {
        continue
      }

      log.info('Cancelling Stripe subscription prior to account deletion', {
        userId: user.id,
        subscriptionId: subscription.id,
        stripeSubscriptionId: subscription.stripe_subscription_id
      })

      try {
        await cancelSubscription(subscription.stripe_subscription_id, true)
      } catch (error) {
        throw createAppError('Failed to cancel billing subscription', ErrorCategory.EXTERNAL_API, {
          cause: error as Error,
          context: {
            userId: user.id,
            subscriptionId: subscription.id,
            stripeSubscriptionId: subscription.stripe_subscription_id
          }
        })
      }

      const { error: subscriptionUpdateError } = await serviceSupabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false
        })
        .eq('id', subscription.id)

      if (subscriptionUpdateError) {
        log.warn('Failed to mark subscription as canceled after Stripe cancellation', {
          userId: user.id,
          subscriptionId: subscription.id,
          error: subscriptionUpdateError.message
        })
      }
    }
  }

  const { error: deleteError } = await serviceSupabase.auth.admin.deleteUser(user.id)

  if (deleteError) {
    throw createAppError('Failed to delete user account', ErrorCategory.INTERNAL, {
      cause: deleteError,
      context: { userId: user.id }
    })
  }

  const { error: signOutError } = await supabase.auth.signOut()

  if (signOutError) {
    log.warn('Failed to clear session cookies after account deletion', {
      userId: user.id,
      error: signOutError.message
    })
  }

  log.info('User account deleted', { userId: user.id })

  return NextResponse.json({
    success: true,
    message: 'Account deleted successfully'
  })
})
