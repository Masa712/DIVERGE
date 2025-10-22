/**
 * Check status of specific email accounts
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function checkAccounts() {
  const emailsToCheck = [
    'divergeia.info@gmail.com',
    'seeks.ad.noise@gmail.com',
    'masayuki.va@gmail.com'
  ]

  console.log('🔍 Checking account status for multiple emails...\n')

  for (const email of emailsToCheck) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📧 Email: ${email}`)
    console.log('='.repeat(60))

    try {
      // Get user from auth
      const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()

      if (authError) {
        console.error('❌ Auth error:', authError)
        continue
      }

      const user = users.find(u => u.email === email)

      if (!user) {
        console.log('⚠️  User not found in auth system')
        continue
      }

      console.log('\n✅ User found in auth')
      console.log(`   User ID: ${user.id}`)
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`)
      console.log(`   Last sign in: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`)

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('❌ Profile error:', profileError)
      } else if (profile) {
        console.log('\n📝 Profile:')
        console.log(`   Display name: ${profile.display_name || 'Not set'}`)
        console.log(`   Subscription plan: ${profile.subscription_plan || 'free'}`)
        console.log(`   Default model: ${profile.default_model || 'Not set'}`)
        console.log(`   Stripe customer ID: ${profile.stripe_customer_id || 'Not set'}`)
      } else {
        console.log('\n⚠️  No profile found')
      }

      // Get active subscription
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (subError && subError.code !== 'PGRST116') {
        console.error('❌ Subscription error:', subError)
      } else if (subscription) {
        console.log('\n💳 Active Subscription:')
        console.log(`   Plan: ${subscription.plan_id}`)
        console.log(`   Status: ${subscription.status}`)
        console.log(`   Stripe subscription ID: ${subscription.stripe_subscription_id}`)
        console.log(`   Current period: ${new Date(subscription.current_period_start).toLocaleDateString()} - ${new Date(subscription.current_period_end).toLocaleDateString()}`)
        console.log(`   Cancel at period end: ${subscription.cancel_at_period_end}`)
      } else {
        console.log('\n📭 No active subscription (Free plan)')
      }

      // Get usage quota
      const nextMonth = new Date()
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
      nextMonth.setUTCDate(1)
      nextMonth.setUTCHours(0, 0, 0, 0)

      const { data: usage, error: usageError } = await supabase
        .from('usage_quotas')
        .select('*')
        .eq('user_id', user.id)
        .eq('reset_date', nextMonth.toISOString())
        .maybeSingle()

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('❌ Usage error:', usageError)
      } else if (usage) {
        console.log('\n📊 Current Usage:')
        console.log(`   Plan: ${usage.plan_id}`)
        console.log(`   Tokens: ${usage.monthly_tokens_used || 0} / ${usage.monthly_tokens_limit === -1 ? 'Unlimited' : usage.monthly_tokens_limit}`)
        console.log(`   Sessions: ${usage.sessions_this_month || 0} / ${usage.sessions_limit === -1 ? 'Unlimited' : usage.sessions_limit}`)
        console.log(`   Web searches: ${usage.web_searches_used || 0} / ${usage.web_searches_limit === -1 ? 'Unlimited' : usage.web_searches_limit}`)
        console.log(`   Reset date: ${new Date(usage.reset_date).toLocaleDateString()}`)
      } else {
        console.log('\n⚠️  No usage quota found for current period')
      }

    } catch (error) {
      console.error('❌ Unexpected error:', error)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Check complete')
}

checkAccounts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
