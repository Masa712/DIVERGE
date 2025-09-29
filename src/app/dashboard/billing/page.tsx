'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SubscriptionPlan, UserSubscription, UsageQuota, getPlanById, formatPrice } from '@/types/subscription'
import { CreditCard, Calendar, TrendingUp, AlertCircle, ExternalLink } from 'lucide-react'

interface BillingData {
  subscription: UserSubscription | null
  usage: UsageQuota | null
  plan: SubscriptionPlan | null
}

export default function BillingDashboard() {
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const { user } = useAuth()
  const { showError } = useError()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }

    // Check for success/cancel params
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    
    if (success === 'true') {
      // Payment successful
      setTimeout(() => {
        window.history.replaceState(null, '', '/dashboard/billing')
      }, 3000)
    } else if (canceled === 'true') {
      showError('Payment was canceled. You can try again anytime.')
      window.history.replaceState(null, '', '/dashboard/billing')
    }

    fetchBillingData()
  }, [user, searchParams])

  const fetchBillingData = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Fetch subscription data
      const { data: subscriptionData } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      // Fetch usage data
      const { data: usageData } = await supabase
        .from('usage_quotas')
        .select('*')
        .eq('user_id', user.id)
        .gte('reset_date', new Date().toISOString())
        .single()

      const plan = subscriptionData 
        ? getPlanById(subscriptionData.plan_id) 
        : getPlanById('free')

      setBillingData({
        subscription: subscriptionData,
        usage: usageData,
        plan: plan || null,
      })
    } catch (error) {
      console.error('Error fetching billing data:', error)
      showError('Failed to load billing information')
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = async () => {
    if (!billingData?.subscription) {
      router.push('/pricing')
      return
    }

    setPortalLoading(true)
    
    try {
      const response = await fetch('/api/stripe/create-portal', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to create portal session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error creating portal session:', error)
      showError('Failed to open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  const getUsagePercentage = (used: number, limit: number): number => {
    if (limit === -1) return 0 // unlimited
    return Math.min((used / limit) * 100, 100)
  }

  const getUsageColor = (percentage: number): string => {
    if (percentage < 50) return 'bg-green-500'
    if (percentage < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-300">Loading billing information...</p>
        </div>
      </div>
    )
  }

  const success = searchParams.get('success')

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {success === 'true' && (
          <div className="bg-green-800 border border-green-600 text-green-100 px-6 py-4 rounded-lg mb-8">
            <div className="flex items-center">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">Payment Successful!</h3>
                <p className="text-sm">Your subscription has been activated. Welcome to {billingData?.plan?.name}!</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Billing & Usage</h1>
          <p className="text-slate-400">Manage your subscription and monitor your usage</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Current Plan */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <CreditCard className="w-6 h-6 text-blue-400 mr-3" />
                  <h2 className="text-xl font-semibold text-white">Current Plan</h2>
                </div>
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {portalLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  {billingData?.subscription ? 'Manage Billing' : 'Upgrade Plan'}
                </button>
              </div>

              {billingData?.plan && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white">{billingData.plan.name}</h3>
                      <p className="text-slate-400">{billingData.plan.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        {formatPrice(billingData.plan.price)}
                      </div>
                      {billingData.plan.price > 0 && (
                        <div className="text-slate-400">/{billingData.plan.interval}</div>
                      )}
                    </div>
                  </div>

                  {billingData.subscription && (
                    <div className="grid md:grid-cols-2 gap-4 p-4 bg-slate-700 rounded-lg">
                      <div className="flex items-center">
                        <Calendar className="w-5 h-5 text-slate-400 mr-2" />
                        <div>
                          <p className="text-sm text-slate-400">Current Period</p>
                          <p className="text-white">
                            {new Date(billingData.subscription.currentPeriodStart).toLocaleDateString()} - 
                            {new Date(billingData.subscription.currentPeriodEnd).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${
                          billingData.subscription.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                        }`} />
                        <div>
                          <p className="text-sm text-slate-400">Status</p>
                          <p className="text-white capitalize">{billingData.subscription.status}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Usage Statistics */}
            <div className="bg-slate-800 rounded-lg p-6">
              <div className="flex items-center mb-6">
                <TrendingUp className="w-6 h-6 text-green-400 mr-3" />
                <h2 className="text-xl font-semibold text-white">Usage This Month</h2>
              </div>

              {billingData?.usage ? (
                <div className="space-y-6">
                  {/* Token Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-300">Tokens Used</span>
                      <span className="text-white">
                        {billingData.usage.monthlyTokensUsed.toLocaleString()} / {' '}
                        {billingData.usage.monthlyTokensLimit === -1 
                          ? 'Unlimited' 
                          : billingData.usage.monthlyTokensLimit.toLocaleString()
                        }
                      </span>
                    </div>
                    {billingData.usage.monthlyTokensLimit !== -1 && (
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            getUsageColor(getUsagePercentage(
                              billingData.usage.monthlyTokensUsed, 
                              billingData.usage.monthlyTokensLimit
                            ))
                          }`}
                          style={{ 
                            width: `${getUsagePercentage(
                              billingData.usage.monthlyTokensUsed, 
                              billingData.usage.monthlyTokensLimit
                            )}%` 
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Session Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-300">Sessions Used</span>
                      <span className="text-white">
                        {billingData.usage.sessionsThisMonth} / {' '}
                        {billingData.usage.sessionsLimit === -1 
                          ? 'Unlimited' 
                          : billingData.usage.sessionsLimit
                        }
                      </span>
                    </div>
                    {billingData.usage.sessionsLimit !== -1 && (
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            getUsageColor(getUsagePercentage(
                              billingData.usage.sessionsThisMonth, 
                              billingData.usage.sessionsLimit
                            ))
                          }`}
                          style={{ 
                            width: `${getUsagePercentage(
                              billingData.usage.sessionsThisMonth, 
                              billingData.usage.sessionsLimit
                            )}%` 
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-slate-400">
                    Usage resets on {new Date(billingData.usage.resetDate).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400">No usage data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Plan Features */}
          <div className="space-y-8">
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Plan Features</h3>
              {billingData?.plan ? (
                <ul className="space-y-3">
                  {billingData.plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span className="text-slate-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400">No plan information available</p>
              )}
            </div>

            {!billingData?.subscription && (
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg p-6 text-white">
                <h3 className="text-lg font-semibold mb-2">Upgrade Now</h3>
                <p className="text-blue-100 mb-4 text-sm">
                  Get access to advanced AI models, unlimited sessions, and priority support.
                </p>
                <button
                  onClick={() => router.push('/pricing')}
                  className="w-full bg-white text-blue-600 font-semibold py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  View Plans
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}