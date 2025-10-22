import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession, createCustomer } from '@/lib/stripe/server'
import { log } from '@/lib/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const { priceId, planId } = await request.json()
    
    if (!priceId || !planId) {
      return NextResponse.json(
        { error: 'Price ID and Plan ID are required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user already has a Stripe customer ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await createCustomer(
        user.email!,
        user.user_metadata?.display_name || user.email,
        {
          user_id: user.id,
          plan_id: planId,
        }
      )
      
      customerId = customer.id

      // Update user profile with Stripe customer ID
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/settings?billing_success=true&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}/settings?billing_canceled=true`

    const session = await createCheckoutSession(
      customerId,
      priceId,
      successUrl,
      cancelUrl,
      {
        user_id: user.id,
        plan_id: planId,
      }
    )

    log.info('Checkout session created for user', {
      userId: user.id,
      planId,
      sessionId: session.id,
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    log.error('Error creating checkout session', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
