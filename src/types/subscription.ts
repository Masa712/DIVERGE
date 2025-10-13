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
    webSearchLimit: number // -1 for unlimited, 0 for none
    historyDays: number // -1 for unlimited
    customPromptsLimit: number
    exportFeatures: boolean
    apiAccess: boolean
    priorityProcessing: boolean
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
  webSearchesUsed: number
  webSearchesLimit: number
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
      '500,000 tokens per month',
      '5 basic AI models (DeepSeek V3.1, Gemini Flash, GPT-5 Nano, etc.)',
      '10 web searches per month',
      '3 sessions saved',
      '7 days history',
      'Community support'
    ],
    limits: {
      monthlyTokens: 500000,
      sessionsPerMonth: 3,
      advancedModels: false,
      prioritySupport: false,
      webSearchLimit: 10,
      historyDays: 7,
      customPromptsLimit: 0,
      exportFeatures: false,
      apiAccess: false,
      priorityProcessing: false
    },
    stripePriceId: '' // No Stripe needed for free plan
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'Perfect for power users and professionals',
    price: 2000, // $20.00
    currency: 'usd',
    interval: 'month',
    features: [
      '4,000,000 tokens per month (hybrid limits)',
      'All AI models with smart allocation',
      '200 web searches per month',
      'Unlimited sessions',
      '90 days history',
      '1 custom system prompt',
      'Markdown export',
      'Smart mode (cost optimization)',
      'Priority support'
    ],
    limits: {
      monthlyTokens: 4000000,
      sessionsPerMonth: -1, // unlimited
      advancedModels: true,
      prioritySupport: true,
      webSearchLimit: 200,
      historyDays: 90,
      customPromptsLimit: 1,
      exportFeatures: true,
      apiAccess: false,
      priorityProcessing: false
    },
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_MONTHLY || 'price_plus_monthly',
    popular: true
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For developers and enterprise users',
    price: 5000, // $50.00
    currency: 'usd',
    interval: 'month',
    features: [
      '15,000,000 tokens per month (unlimited)',
      'All AI models unlimited',
      'Unlimited web searches',
      'Unlimited sessions',
      'Unlimited history',
      '5 custom system prompts',
      'All export formats (MD/JSON/HTML/PDF)',
      '10,000 API calls per month',
      'Priority processing',
      'Session sharing with edit access',
      'Priority support'
    ],
    limits: {
      monthlyTokens: 15000000,
      sessionsPerMonth: -1, // unlimited
      advancedModels: true,
      prioritySupport: true,
      webSearchLimit: -1, // unlimited
      historyDays: -1, // unlimited
      customPromptsLimit: 5,
      exportFeatures: true,
      apiAccess: true,
      priorityProcessing: true
    },
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly'
  }
]

export const YEARLY_PLANS: SubscriptionPlan[] = [
  {
    ...SUBSCRIPTION_PLANS[1], // Plus plan
    id: 'plus-yearly',
    name: 'Plus (Yearly)',
    price: 20000, // $200.00 (2 months free)
    interval: 'year',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS_YEARLY || 'price_plus_yearly'
  },
  {
    ...SUBSCRIPTION_PLANS[2], // Pro plan
    id: 'pro-yearly',
    name: 'Pro (Yearly)',
    price: 50000, // $500.00 (2 months free)
    interval: 'year',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly'
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