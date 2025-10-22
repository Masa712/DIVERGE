/**
 * Sync Stripe subscription to Supabase
 * Usage: node scripts/sync-stripe-subscription.js <email>
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const Stripe = require('stripe')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function syncSubscription() {
  const email = process.argv[2]

  if (!email) {
    console.log('[ERROR] Usage: node scripts/sync-stripe-subscription.js <email>')
    process.exit(1)
  }

  console.log(`[SYNC] Syncing Stripe subscription for: ${email}\n`)

  try {
    // Get user from Supabase
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) throw authError

    const user = users.find(u => u.email === email)
    if (!user) {
      console.log('[ERROR] User not found in Supabase')
      process.exit(1)
    }

    console.log(`[OK] Found user in Supabase`)
    console.log(`     User ID: ${user.id}\n`)

    // Search for customer in Stripe
    console.log('[SEARCH] Searching for customer in Stripe...')
    const customers = await stripe.customers.list({
      email: email,
      limit: 1
    })

    if (customers.data.length === 0) {
      console.log('[ERROR] No customer found in Stripe with this email')
      console.log('        Make sure the payment was completed successfully')
      process.exit(1)
    }

    const customer = customers.data[0]
    console.log(`[OK] Found Stripe customer`)
    console.log(`     Customer ID: ${customer.id}\n`)

    // Get subscriptions for this customer
    console.log('[SEARCH] Fetching subscriptions...')
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 10
    })

    if (subscriptions.data.length === 0) {
      console.log('[ERROR] No subscriptions found for this customer')
      process.exit(1)
    }

    console.log(`[OK] Found ${subscriptions.data.length} subscription(s)\n`)

    // Process each subscription
    for (const subscription of subscriptions.data) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`[PROCESS] Subscription: ${subscription.id}`)
      console.log(`          Status: ${subscription.status}`)
      console.log(`          Plan: ${subscription.items.data[0]?.price?.id || 'unknown'}`)
      console.log('='.repeat(60))

      // Determine plan_id from price_id
      const priceId = subscription.items.data[0]?.price?.id
      let planId = 'unknown'

      // Map price IDs to plan IDs
      const priceIdMap = {
        [process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY]: 'plus',
        [process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_YEARLY]: 'plus-yearly',
        [process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY]: 'pro',
        [process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY]: 'pro-yearly',
      }

      planId = priceIdMap[priceId] || 'unknown'

      if (planId === 'unknown') {
        console.log(`[WARNING] Unknown price ID: ${priceId}`)
        console.log('          Attempting to determine plan from metadata...')
        planId = subscription.metadata?.plan_id || 'plus'
      }

      console.log(`\n[SYNC] Syncing to Supabase...`)
      console.log(`       Plan ID: ${planId}`)

      // Update user profile with Stripe customer ID
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customer.id,
          subscription_status: subscription.status,
          subscription_plan: planId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        })

      if (profileError) {
        console.error('[ERROR] Failed to update user profile:', profileError)
        continue
      }

      console.log('[OK] Updated user profile')

      // Get period dates from subscription items
      const periodStart = subscription.items?.data?.[0]?.current_period_start || subscription.current_period_start
      const periodEnd = subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end

      console.log('[DEBUG] Period dates:')
      console.log('        current_period_start:', periodStart)
      console.log('        current_period_end:', periodEnd)

      if (!periodStart || !periodEnd) {
        console.error('[ERROR] Missing period dates in subscription')
        continue
      }

      // Upsert subscription
      let subscriptionData
      try {
        subscriptionData = {
          user_id: user.id,
          plan_id: planId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customer.id,
          status: subscription.status,
          current_period_start: new Date(periodStart * 1000).toISOString(),
          current_period_end: new Date(periodEnd * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end || false,
          updated_at: new Date().toISOString(),
        }
      } catch (dateError) {
        console.error('[ERROR] Failed to convert dates:', dateError.message)
        continue
      }

      const { error: subError } = await supabase
        .from('user_subscriptions')
        .upsert(subscriptionData, {
          onConflict: 'stripe_subscription_id',
        })

      if (subError) {
        console.error('[ERROR] Failed to upsert subscription:', subError)
        continue
      }

      console.log('[OK] Upserted subscription')

      // Update usage quota
      const limits = getPlanLimits(planId)
      const nextMonth = new Date()
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
      nextMonth.setUTCDate(1)
      nextMonth.setUTCHours(0, 0, 0, 0)

      const { data: existingQuota } = await supabase
        .from('usage_quotas')
        .select('*')
        .eq('user_id', user.id)
        .eq('reset_date', nextMonth.toISOString())
        .maybeSingle()

      if (existingQuota) {
        const { error: updateError } = await supabase
          .from('usage_quotas')
          .update({
            plan_id: planId,
            monthly_tokens_limit: limits.monthly_tokens_limit,
            sessions_limit: limits.sessions_limit,
            web_searches_limit: limits.web_searches_limit,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('reset_date', nextMonth.toISOString())

        if (updateError) {
          console.error('[ERROR] Failed to update usage quota:', updateError)
        } else {
          console.log('[OK] Updated usage quota')
        }
      } else {
        const { error: insertError } = await supabase
          .from('usage_quotas')
          .insert({
            user_id: user.id,
            plan_id: planId,
            monthly_tokens_used: 0,
            monthly_tokens_limit: limits.monthly_tokens_limit,
            sessions_this_month: 0,
            sessions_limit: limits.sessions_limit,
            web_searches_used: 0,
            web_searches_limit: limits.web_searches_limit,
            reset_date: nextMonth.toISOString(),
          })

        if (insertError) {
          console.error('[ERROR] Failed to create usage quota:', insertError)
        } else {
          console.log('[OK] Created usage quota')
        }
      }

      console.log('\n[SUCCESS] Subscription synced successfully!')
    }

    console.log(`\n${'='.repeat(60)}`)
    console.log('[COMPLETE] All subscriptions synced!')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n[ERROR]', error.message)
    process.exit(1)
  }
}

function getPlanLimits(planId) {
  const planLimits = {
    free: {
      monthly_tokens_limit: 500000,
      sessions_limit: 3,
      web_searches_limit: 10,
    },
    plus: {
      monthly_tokens_limit: 4000000,
      sessions_limit: -1,
      web_searches_limit: 200,
    },
    'plus-yearly': {
      monthly_tokens_limit: 4000000,
      sessions_limit: -1,
      web_searches_limit: 200,
    },
    pro: {
      monthly_tokens_limit: 15000000,
      sessions_limit: -1,
      web_searches_limit: -1,
    },
    'pro-yearly': {
      monthly_tokens_limit: 15000000,
      sessions_limit: -1,
      web_searches_limit: -1,
    },
  }

  return planLimits[planId] || planLimits.free
}

syncSubscription()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[ERROR] Fatal error:', error)
    process.exit(1)
  })
