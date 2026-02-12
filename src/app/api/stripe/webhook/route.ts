import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/server'
import { createClient } from '@supabase/supabase-js'
import { log } from '@/lib/utils/logger'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    log.error('Missing Stripe signature or webhook secret')
    return NextResponse.json(
      { error: 'Missing signature or webhook secret' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (error) {
    log.error('Webhook signature verification failed', error)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
      
      default:
        log.info('Unhandled webhook event type', { type: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    log.error('Error processing webhook', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  log.info('Processing checkout completed', { sessionId: session.id })

  if (!session.metadata?.user_id || !session.subscription) {
    log.error('Missing metadata in checkout session', { sessionId: session.id })
    return
  }

  const userId = session.metadata.user_id
  const subscriptionId = session.subscription as string

  // Retrieve the subscription to get all details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  
  await upsertSubscription(userId, subscription)
  log.info('Checkout completed successfully', { userId, subscriptionId })
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  log.info('Processing subscription update', { subscriptionId: subscription.id })

  const userId = subscription.metadata?.user_id
  if (!userId) {
    log.error('Missing user_id in subscription metadata', { 
      subscriptionId: subscription.id 
    })
    return
  }

  await upsertSubscription(userId, subscription)
  log.info('Subscription updated successfully', { userId, subscriptionId: subscription.id })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  log.info('Processing subscription deletion', { subscriptionId: subscription.id })

  const userId = subscription.metadata?.user_id

  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    log.error('Failed to update subscription status', error)
    throw error
  }

  // Revert user to free plan
  if (userId) {
    await supabaseAdmin
      .from('user_profiles')
      .update({
        subscription_status: 'canceled',
        subscription_plan: 'free',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    // Update usage_quotas back to free plan
    await updateUsageQuotaPlan(userId, 'free')
  }

  log.info('Subscription deleted successfully', { subscriptionId: subscription.id, userId })
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  log.info('Processing payment succeeded', { invoiceId: invoice.id })

  // Handle subscription ID from invoice - cast to any to bypass type checking
  const invoiceWithSubscription = invoice as any
  const subscriptionId = typeof invoiceWithSubscription.subscription === 'string' 
    ? invoiceWithSubscription.subscription 
    : invoiceWithSubscription.subscription?.id

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const userId = subscription.metadata?.user_id
    
    if (userId) {
      await upsertSubscription(userId, subscription)
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  log.error('Payment failed', { 
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amount: invoice.amount_due,
  })

  // You might want to send notifications to users here
  // or update subscription status to 'past_due'
}

async function upsertSubscription(userId: string, subscription: Stripe.Subscription) {
  // Cast subscription to any to bypass TypeScript strict checking for webhook data
  const sub = subscription as any

  const planId = sub.metadata?.plan_id || 'unknown'
  const currentPeriodStart = convertStripeTimestamp(
    sub.current_period_start,
    sub.items?.data?.[0]?.current_period_start,
    'current_period_start'
  )
  const currentPeriodEnd = convertStripeTimestamp(
    sub.current_period_end,
    sub.items?.data?.[0]?.current_period_end,
    'current_period_end'
  )

  const subscriptionData = {
    user_id: userId,
    plan_id: planId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer as string,
    status: sub.status,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabaseAdmin
    .from('user_subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'stripe_subscription_id',
    })

  if (error) {
    log.error('Failed to upsert subscription', error)
    throw error
  }

  // Update user profile with subscription status
  await supabaseAdmin
    .from('user_profiles')
    .update({
      subscription_status: subscription.status,
      subscription_plan: planId,
      stripe_customer_id: sub.customer as string,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  // Update usage_quotas with new plan limits (pass subscription for cycle-based reset)
  await updateUsageQuotaPlan(userId, planId, subscription)
}

/**
 * Update usage quota plan and limits for a user
 * FIXED: Use subscription cycle (current_period_end) instead of calendar month
 */
async function updateUsageQuotaPlan(
  userId: string,
  planId: string,
  subscription?: Stripe.Subscription
) {
  // Get plan limits
  const limits = getPlanLimits(planId)

  log.info('Updating usage quota plan', { userId, planId, limits })

  // FIX: Update ALL existing quotas for this user (current and future)
  const { data: allQuotas, error: fetchError } = await supabaseAdmin
    .from('usage_quotas')
    .select('*')
    .eq('user_id', userId)
    .order('reset_date', { ascending: true })

  if (fetchError) {
    log.error('Failed to fetch existing quotas', { userId, error: fetchError })
  } else if (allQuotas && allQuotas.length > 0) {
    // Update all existing quotas to new plan
    const { error: updateError } = await supabaseAdmin
      .from('usage_quotas')
      .update({
        plan_id: planId,
        monthly_tokens_limit: limits.monthly_tokens_limit,
        sessions_limit: limits.sessions_limit,
        web_searches_limit: limits.web_searches_limit,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      log.error('Failed to update existing quotas', { userId, planId, error: updateError })
    } else {
      log.info('Updated all existing quotas', { userId, planId, count: allQuotas.length })
    }
  } else {
    log.info('No existing quotas found, will create new one', { userId })
  }

  // FIXED: Calculate reset date based on subscription cycle, not calendar month
  let nextResetDate: Date

  // Cast to any to access webhook-specific fields not in Stripe SDK types
  const sub = subscription as any

  if (subscription && sub.current_period_end) {
    // For paid subscriptions: use Stripe subscription cycle
    const periodEnd = typeof sub.current_period_end === 'number'
      ? new Date(sub.current_period_end * 1000)
      : new Date(sub.current_period_end)

    nextResetDate = periodEnd
    log.info('Using subscription period end as reset date', {
      userId,
      resetDate: nextResetDate.toISOString()
    })
  } else {
    // For free plan: use first day of next month (calendar-based)
    const now = new Date()
    nextResetDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1,
      0, 0, 0, 0
    ))
    log.info('Using calendar month for free plan', {
      userId,
      resetDate: nextResetDate.toISOString()
    })
  }

  // Check if quota exists for next period
  const { data: nextPeriodQuota } = await supabaseAdmin
    .from('usage_quotas')
    .select('*')
    .eq('user_id', userId)
    .eq('reset_date', nextResetDate.toISOString())
    .maybeSingle()

  if (!nextPeriodQuota) {
    // Create new quota record for next period
    const { error: insertError } = await supabaseAdmin
      .from('usage_quotas')
      .insert({
        user_id: userId,
        plan_id: planId,
        monthly_tokens_used: 0,
        monthly_tokens_limit: limits.monthly_tokens_limit,
        sessions_this_month: 0,
        sessions_limit: limits.sessions_limit,
        web_searches_used: 0,
        web_searches_limit: limits.web_searches_limit,
        reset_date: nextResetDate.toISOString(),
      })

    if (insertError) {
      log.error('Failed to create next period quota', { userId, planId, error: insertError })
    } else {
      log.info('Created next period quota successfully', { userId, planId, resetDate: nextResetDate.toISOString() })
    }
  } else {
    log.info('Next period quota already exists and was updated', { userId, planId })
  }
}

/**
 * Get plan limits based on plan ID
 */
function getPlanLimits(planId: string): {
  monthly_tokens_limit: number
  sessions_limit: number
  web_searches_limit: number
} {
  const planLimits: Record<string, { monthly_tokens_limit: number; sessions_limit: number; web_searches_limit: number }> = {
    free: {
      monthly_tokens_limit: 500000,
      sessions_limit: -1,
      web_searches_limit: 10,
    },
    plus: {
      monthly_tokens_limit: 4000000,
      sessions_limit: -1, // unlimited
      web_searches_limit: 200,
    },
    'plus-yearly': {
      monthly_tokens_limit: 4000000,
      sessions_limit: -1, // unlimited
      web_searches_limit: 200,
    },
    pro: {
      monthly_tokens_limit: 15000000,
      sessions_limit: -1, // unlimited
      web_searches_limit: -1, // unlimited
    },
    'pro-yearly': {
      monthly_tokens_limit: 15000000,
      sessions_limit: -1, // unlimited
      web_searches_limit: -1, // unlimited
    },
  }

  return planLimits[planId] || planLimits.free
}

function convertStripeTimestamp(
  value: number | string | null | undefined,
  fallback: number | string | null | undefined,
  fieldName: string
): string {
  const source = value ?? fallback

  if (source === null || source === undefined) {
    log.warn('Missing timestamp value from Stripe payload, defaulting to now', { fieldName })
    return new Date().toISOString()
  }

  if (typeof source === 'number') {
    return new Date(source * 1000).toISOString()
  }

  const parsed = new Date(source)

  if (Number.isNaN(parsed.getTime())) {
    log.warn('Invalid timestamp value from Stripe payload, defaulting to now', {
      fieldName,
      value: source,
    })
    return new Date().toISOString()
  }

  return parsed.toISOString()
}
