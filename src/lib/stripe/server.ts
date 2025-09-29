import Stripe from 'stripe'
import { log } from '@/lib/utils/logger'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
  typescript: true,
})

export async function createCustomer(
  email: string, 
  name?: string,
  metadata?: Stripe.MetadataParam
): Promise<Stripe.Customer> {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    })
    
    log.info('Stripe customer created', { customerId: customer.id, email })
    return customer
  } catch (error) {
    log.error('Failed to create Stripe customer', error)
    throw error
  }
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Stripe.MetadataParam
): Promise<Stripe.Checkout.Session> {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      subscription_data: {
        metadata,
      },
    })
    
    log.info('Stripe checkout session created', { 
      sessionId: session.id, 
      customerId, 
      priceId 
    })
    
    return session
  } catch (error) {
    log.error('Failed to create checkout session', error)
    throw error
  }
}

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    
    log.info('Stripe portal session created', { 
      sessionId: session.id, 
      customerId 
    })
    
    return session
  } catch (error) {
    log.error('Failed to create portal session', error)
    throw error
  }
}

export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return subscription
  } catch (error) {
    log.error('Failed to retrieve subscription', error)
    return null
  }
}

export async function cancelSubscription(
  subscriptionId: string,
  atPeriodEnd = true
): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: atPeriodEnd,
    })
    
    log.info('Stripe subscription cancelled', { 
      subscriptionId, 
      atPeriodEnd 
    })
    
    return subscription
  } catch (error) {
    log.error('Failed to cancel subscription', error)
    throw error
  }
}

export async function updateSubscription(
  subscriptionId: string,
  priceId: string
): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
      proration_behavior: 'create_prorations',
    })
    
    log.info('Stripe subscription updated', { 
      subscriptionId, 
      newPriceId: priceId 
    })
    
    return updatedSubscription
  } catch (error) {
    log.error('Failed to update subscription', error)
    throw error
  }
}