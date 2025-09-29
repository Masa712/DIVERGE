'use client'

import { useEffect } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Zap, Shield, Sparkles, CheckCircle } from 'lucide-react'
import { AnimatedBackground } from '@/components/ui/AnimatedBackground'

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Handle OAuth callback (when redirected from Supabase)
  useEffect(() => {
    // Check if this is an OAuth callback
    const code = searchParams.get('code')
    const redirect = searchParams.get('redirect')

    if (code && user && !loading) {
      // User just logged in via OAuth, check for redirect parameter
      if (redirect) {
        // Use the redirect parameter from URL
        router.replace(redirect)
      } else {
        // Default to chat if no specific redirect was provided
        router.replace('/chat')
      }
    }
  }, [user, loading, searchParams, router])

  const handleGetStarted = () => {
    if (user) {
      router.push('/chat')
    } else {
      // Redirect to auth with intended destination as parameter
      const params = new URLSearchParams({ redirect: '/chat' })
      router.push(`/auth?${params.toString()}`)
    }
  }

  const handleLogin = () => {
    router.push('/auth')
  }

  const features = [
    {
      icon: Sparkles,
      title: "Advanced AI Models",
      description: "Access to GPT-5, Claude Opus 4.1, Gemini 2.5 Pro, and more cutting-edge AI models",
      gradient: "from-blue-400 to-purple-500"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Optimized infrastructure for rapid response times and seamless conversations",
      gradient: "from-pink-400 to-orange-400"
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your conversations are encrypted and never used for training other models",
      gradient: "from-green-400 to-blue-500"
    }
  ]

  const plans = [
    {
      name: "Free",
      price: "0",
      period: "month",
      features: [
        "10,000 tokens per month",
        "5 sessions per month",
        "Basic AI models",
        "Community support"
      ]
    },
    {
      name: "Pro",
      price: "19",
      period: "month",
      features: [
        "500,000 tokens per month",
        "Unlimited sessions",
        "All AI models",
        "Priority support",
        "Advanced features"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "99",
      period: "month",
      features: [
        "Unlimited tokens",
        "Unlimited sessions",
        "All AI models",
        "Priority support",
        "Custom integrations",
        "Team management"
      ]
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <AnimatedBackground opacity={0.3} />
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin relative z-10" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 relative">
      {/* Animated Background */}
      <AnimatedBackground opacity={0.5} />
      
      {/* Navigation */}
      <nav className="relative z-10 border-b border-gray-200/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* D Logo */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">D</span>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Diverge</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/pricing')}
                className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Pricing
              </button>
              {user ? (
                <button
                  onClick={() => router.push('/chat')}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all transform hover:scale-105"
                >
                  Dashboard
                </button>
              ) : (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleLogin}
                    className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={handleGetStarted}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all transform hover:scale-105"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 relative z-10">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-gray-700">AI-Powered Conversations</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            The Future of
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              {" "}AI Conversations
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Experience the most advanced AI models in one unified platform. 
            From GPT-5 to Claude Opus, unlock the power of cutting-edge artificial intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleGetStarted}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-xl transition-all flex items-center justify-center transform hover:scale-105"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
            <button
              onClick={() => router.push('/pricing')}
              className="bg-white/80 backdrop-blur border border-gray-200 hover:border-gray-300 text-gray-700 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              View Pricing
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative z-10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Why Choose Diverge?</h2>
            <p className="text-xl text-gray-600">Built for professionals who demand the best AI experience</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="group bg-white/70 backdrop-blur-sm p-8 rounded-2xl border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-800">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 relative z-10 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600">Choose the plan that fits your needs</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <div key={index} className={`bg-white rounded-2xl p-8 relative shadow-xl hover:shadow-2xl transition-all duration-300 ${
                plan.popular ? 'border-2 border-purple-500 transform scale-105' : 'border border-gray-200'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold mb-3 text-gray-800">{plan.name}</h3>
                  <div className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    ${plan.price}
                    <span className="text-lg text-gray-500">/{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={handleGetStarted}
                  className={`w-full py-3 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200'
                  }`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative z-10">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl p-12 text-center shadow-2xl">
            <div className="relative z-10">
              <h2 className="text-4xl font-bold mb-4 text-white">Ready to Transform Your AI Experience?</h2>
              <p className="text-xl mb-8 text-blue-50 max-w-2xl mx-auto">
                Join thousands of professionals already using Diverge to unlock AI's full potential.
              </p>
              <button
                onClick={handleGetStarted}
                className="bg-white text-blue-600 px-8 py-4 rounded-xl text-lg font-bold hover:bg-gray-50 transition-all shadow-lg transform hover:scale-105"
              >
                Start Your Free Trial Today
              </button>
            </div>
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200 relative z-10 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              {/* D Logo */}
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center shadow-md">
                <span className="text-white text-base font-bold">D</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Diverge</span>
            </div>
            <div className="flex space-x-6 text-gray-600">
              <a href="#" className="hover:text-gray-900 transition-colors font-medium">Privacy Policy</a>
              <a href="#" className="hover:text-gray-900 transition-colors font-medium">Terms of Service</a>
              <a href="#" className="hover:text-gray-900 transition-colors font-medium">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}