'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/providers/auth-provider'
import { useError } from '@/components/providers/error-provider'
import { SUBSCRIPTION_PLANS, YEARLY_PLANS, formatPrice } from '@/types/subscription'
import { getStripe } from '@/lib/stripe/client'
import { Check, Star } from 'lucide-react'

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const { user } = useAuth()
  const { showError } = useError()
  const router = useRouter()
  const searchParams = useSearchParams()

  const plans = isYearly ? [...SUBSCRIPTION_PLANS.slice(0, 1), ...YEARLY_PLANS] : SUBSCRIPTION_PLANS

  // Check for plan parameter on mount (when redirected after auth)
  useEffect(() => {
    const planParam = searchParams.get('plan')
    if (planParam && user) {
      // Find the plan and trigger subscription
      const plan = plans.find(p => p.id === planParam)
      if (plan && plan.stripePriceId) {
        // Trigger subscription automatically
        handleSubscribe(plan.id, plan.stripePriceId)
      }
    }
  }, [searchParams, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubscribe = async (planId: string, priceId: string) => {
    if (!user) {
      // Redirect to auth page with plan information as URL parameter
      const params = new URLSearchParams({
        redirect: `/pricing?plan=${planId}`
      })
      router.push(`/auth?${params.toString()}`)
      return
    }

    if (planId === 'free') {
      router.push('/chat')
      return
    }

    setLoading(planId)

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          planId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout session')
      }

      const { sessionId } = await response.json()
      const stripe = await getStripe()

      if (!stripe) {
        throw new Error('Stripe failed to load')
      }

      const { error } = await stripe.redirectToCheckout({
        sessionId,
      })

      if (error) {
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      showError(error instanceof Error ? error.message : 'Failed to start checkout')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">
            Choose Your <span className="text-blue-400">AI Plan</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Unlock the full potential of AI-powered conversations with flexible pricing plans
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-slate-800 p-1 rounded-lg flex">
            <button
              onClick={() => setIsYearly(false)}
              className={`px-6 py-2 rounded-md transition-colors ${
                !isYearly
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`px-6 py-2 rounded-md transition-colors ${
                isYearly
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Yearly
              <span className="ml-2 text-sm bg-green-500 text-white px-2 py-1 rounded">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-slate-800 rounded-2xl p-8 border-2 transition-all duration-300 hover:scale-105 ${
                plan.popular
                  ? 'border-blue-500 shadow-2xl shadow-blue-500/20'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center">
                    <Star className="w-4 h-4 mr-1" />
                    Most Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-slate-400 mb-4">{plan.description}</p>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">
                    {formatPrice(plan.price)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-slate-400">
                      /{plan.interval}
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.id, plan.stripePriceId)}
                disabled={loading === plan.id}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  plan.popular
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                    : plan.id === 'free'
                    ? 'bg-slate-700 hover:bg-slate-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === plan.id ? (
                  <span className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Processing...
                  </span>
                ) : plan.id === 'free' ? (
                  'Get Started Free'
                ) : (
                  `Subscribe to ${plan.name}`
                )}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-slate-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-3">
                Can I change plans anytime?
              </h3>
              <p className="text-slate-300">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately with prorated billing.
              </p>
            </div>
            <div className="bg-slate-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-3">
                What happens if I exceed my token limit?
              </h3>
              <p className="text-slate-300">
                You'll be notified when approaching your limit. Once exceeded, you'll need to upgrade or wait for the next billing cycle.
              </p>
            </div>
            <div className="bg-slate-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-3">
                Is there a free trial?
              </h3>
              <p className="text-slate-300">
                Our Free plan includes 10,000 tokens monthly. No credit card required to get started.
              </p>
            </div>
            <div className="bg-slate-800 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-3">
                How secure is my data?
              </h3>
              <p className="text-slate-300">
                We use enterprise-grade security with end-to-end encryption. Your conversations are private and secure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}