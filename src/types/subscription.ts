export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number // in cents
  currency: string
  interval: 'month' | 'year'
  features: string[]
  limits: {
    monthlyTokens: number
    sessionsPerMonth: number
    advancedModels: boolean
    prioritySupport: boolean
    webSearch: boolean
    exportFeatures: boolean
  }
  stripePriceId: string
  popular?: boolean
}

export interface UserSubscription {
  id: string
  userId: string
  planId: string
  stripeSubscriptionId: string
  stripeCustomerId: string
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UsageQuota {
  userId: string
  planId: string
  monthlyTokensUsed: number
  monthlyTokensLimit: number
  sessionsThisMonth: number
  sessionsLimit: number
  resetDate: Date
}

// Default subscription plans
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic AI conversations',
    price: 0,
    currency: 'usd',
    interval: 'month',
    features: [
      'Up to 10,000 tokens per month',
      'Basic AI models (GPT-4o)',
      'Up to 5 sessions per month',
      'Community support'
    ],
    limits: {
      monthlyTokens: 10000,
      sessionsPerMonth: 5,
      advancedModels: false,
      prioritySupport: false,
      webSearch: false,
      exportFeatures: false
    },
    stripePriceId: '' // No Stripe needed for free plan
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Perfect for professionals and power users',
    price: 2000, // $20.00
    currency: 'usd',
    interval: 'month',
    features: [
      'Up to 100,000 tokens per month',
      'Access to all AI models including GPT-5, Claude Opus 4',
      'Unlimited sessions',
      'Web search capabilities',
      'Export conversations',
      'Priority support'
    ],
    limits: {
      monthlyTokens: 100000,
      sessionsPerMonth: -1, // unlimited
      advancedModels: true,
      prioritySupport: true,
      webSearch: true,
      exportFeatures: true
    },
    stripePriceId: 'price_pro_monthly', // Will be set from Stripe dashboard
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For teams and organizations with high usage',
    price: 10000, // $100.00
    currency: 'usd',
    interval: 'month',
    features: [
      'Unlimited tokens',
      'Access to all AI models',
      'Unlimited sessions',
      'Web search capabilities',
      'Advanced export features',
      'Priority support',
      'Custom integrations',
      'Team management'
    ],
    limits: {
      monthlyTokens: -1, // unlimited
      sessionsPerMonth: -1, // unlimited
      advancedModels: true,
      prioritySupport: true,
      webSearch: true,
      exportFeatures: true
    },
    stripePriceId: 'price_enterprise_monthly' // Will be set from Stripe dashboard
  }
]

export const YEARLY_PLANS: SubscriptionPlan[] = [
  {
    ...SUBSCRIPTION_PLANS[1], // Pro plan
    id: 'pro-yearly',
    name: 'Pro (Yearly)',
    price: 20000, // $200.00 (2 months free)
    interval: 'year',
    stripePriceId: 'price_pro_yearly'
  },
  {
    ...SUBSCRIPTION_PLANS[2], // Enterprise plan
    id: 'enterprise-yearly',
    name: 'Enterprise (Yearly)',
    price: 100000, // $1000.00 (2 months free)
    interval: 'year',
    stripePriceId: 'price_enterprise_yearly'
  }
]

export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return [...SUBSCRIPTION_PLANS, ...YEARLY_PLANS].find(plan => plan.id === planId)
}

export function formatPrice(price: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(price / 100)
}