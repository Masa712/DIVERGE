/**
 * Check RLS policies for user_subscriptions and usage_quotas
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function checkRLSPolicies() {
  console.log('🔍 Checking RLS policies...\n')

  try {
    // Check user_subscriptions policies
    console.log('1️⃣ Checking user_subscriptions RLS policies...')
    const { data: subPolicies, error: subError } = await supabaseAdmin
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'user_subscriptions')

    if (subError) {
      console.error('❌ Error fetching policies:', subError)
    } else if (subPolicies && subPolicies.length > 0) {
      console.log(`✅ Found ${subPolicies.length} policy/policies:`)
      subPolicies.forEach(policy => {
        console.log(`   - ${policy.policyname} (${policy.cmd})`)
        console.log(`     Permissive: ${policy.permissive}`)
        console.log(`     Roles: ${policy.roles}`)
        console.log(`     Using: ${policy.qual || 'N/A'}`)
        console.log('')
      })
    } else {
      console.log('⚠️  No RLS policies found for user_subscriptions')
    }

    // Check usage_quotas policies
    console.log('2️⃣ Checking usage_quotas RLS policies...')
    const { data: quotaPolicies, error: quotaError } = await supabaseAdmin
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'usage_quotas')

    if (quotaError) {
      console.error('❌ Error fetching policies:', quotaError)
    } else if (quotaPolicies && quotaPolicies.length > 0) {
      console.log(`✅ Found ${quotaPolicies.length} policy/policies:`)
      quotaPolicies.forEach(policy => {
        console.log(`   - ${policy.policyname} (${policy.cmd})`)
        console.log(`     Permissive: ${policy.permissive}`)
        console.log(`     Roles: ${policy.roles}`)
        console.log(`     Using: ${policy.qual || 'N/A'}`)
        console.log('')
      })
    } else {
      console.log('⚠️  No RLS policies found for usage_quotas')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

checkRLSPolicies()
  .then(() => {
    console.log('✅ Check complete')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
