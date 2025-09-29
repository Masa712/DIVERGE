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
  const headersList = headers()
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

  log.info('Subscription deleted successfully', { subscriptionId: subscription.id })
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
  
  const subscriptionData = {
    user_id: userId,
    plan_id: sub.metadata?.plan_id || 'unknown',
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer as string,
    status: sub.status,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
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
      subscription_plan: subscription.metadata?.plan_id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}