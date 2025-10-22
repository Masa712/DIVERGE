/**
 * Fix account subscription plans to 'free' for data consistency
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function fixAccountPlans() {
  const accounts = [
    {
      email: 'seeks.and.noise@gmail.com',
      userId: 'a5765d37-5266-4658-84c1-99dfb4d629fb',
      currentPlan: 'plus'
    },
    {
      email: 'masayuki.va@gmail.com',
      userId: 'cecdd977-d894-49d3-875d-c66d7b77fecd',
      currentPlan: 'pro'
    }
  ]

  console.log('🔧 Fixing account subscription plans to "free"...\n')

  for (const account of accounts) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`📧 Processing: ${account.email}`)
    console.log(`   User ID: ${account.userId}`)
    console.log(`   Current plan: ${account.currentPlan}`)
    console.log('='.repeat(60))

    try {
      // Update user_profiles.subscription_plan to 'free'
      const { data: updatedProfile, error: updateError } = await supabase
        .from('user_profiles')
        .update({ subscription_plan: 'free' })
        .eq('user_id', account.userId)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Failed to update profile:', updateError)
        continue
      }

      console.log('✅ Successfully updated user_profiles.subscription_plan to "free"')

      // Verify the update
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_plan')
        .eq('user_id', account.userId)
        .single()

      console.log(`   Verified plan: ${profile?.subscription_plan}`)

      // Check usage_quotas (should already be 'free')
      const nextMonth = new Date()
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
      nextMonth.setUTCDate(1)
      nextMonth.setUTCHours(0, 0, 0, 0)

      const { data: usage } = await supabase
        .from('usage_quotas')
        .select('plan_id')
        .eq('user_id', account.userId)
        .eq('reset_date', nextMonth.toISOString())
        .maybeSingle()

      if (usage) {
        console.log(`   Usage quota plan: ${usage.plan_id}`)
      } else {
        console.log('   ⚠️  No usage quota found for current period')
      }

    } catch (error) {
      console.error('❌ Unexpected error:', error)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ All accounts updated to free plan')
  console.log('='.repeat(60))
}

fixAccountPlans()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
