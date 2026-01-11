'use client'

import { Suspense } from 'react'
import { useAuth } from '@/components/providers/auth-provider'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { AnimatedBackground } from '@/components/ui/AnimatedBackground'
import { DemoChat } from '@/components/demo/demo-chat'
import { ParallaxSection } from '@/components/landing/ParallaxSection'
import { AnimatedHeroNode } from '@/components/landing/AnimatedHeroNode'
import { FAQAccordion } from '@/components/landing/FAQAccordion'
import Image from 'next/image'

function LandingPageContent() {
  const { user, loading } = useAuth()
  const router = useRouter()

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

  const plans = [
    {
      name: "Free",
      price: "0",
      period: "month",
      features: [
        "500,000 tokens per month",
        "5 basic AI models",
        "10 web searches per month",
        "Unlimited sessions",
        "Community support"
      ]
    },
    {
      name: "Plus",
      price: "20",
      period: "month",
      features: [
        "4,000,000 tokens per month",
        "All AI models with smart allocation",
        "200 web searches per month",
        "Unlimited sessions",
        "Priority support"
      ],
      popular: true
    },
    {
      name: "Pro",
      price: "50",
      period: "month",
      features: [
        "15,000,000 tokens per month",
        "All AI models unlimited",
        "Unlimited web searches",
        "Unlimited sessions",
        "Priority processing & support"
      ]
    }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AnimatedBackground opacity={0.4} />
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin relative z-10" />
      </div>
    )
  }

  return (
    <div className="min-h-screen text-gray-900 relative">
      {/* Animated Background */}
      <AnimatedBackground opacity={0.4} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 pt-6 pb-4">
        <div className="container mx-auto px-4">
          {/* Elliptical Navigation Container */}
          <div className="glass-nav rounded-full px-6 py-3 shadow-xl flex items-center justify-between max-w-7xl mx-auto">
            {/* Left: Diverge Logo */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden">
                <Image
                  src="/android-chrome-512x512.png"
                  alt="Diverge Logo"
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Center: Navigation Links */}
            <div className="flex items-center space-x-8 flex-1 justify-center mx-8">
              <a
                href="#about"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                About
              </a>
              <a
                href="#features"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Feature
              </a>
              <a
                href="#faq"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                FAQ
              </a>
              <a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Price
              </a>
            </div>

            {/* Right: Auth Buttons */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              {user ? (
                <button
                  onClick={() => router.push('/chat')}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-full font-semibold shadow-lg transition-all transform hover:scale-105"
                >
                  Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={handleLogin}
                    className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={handleGetStarted}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-full font-semibold shadow-lg transition-all transform hover:scale-105"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Animated Node */}
      <section className="pt-20">
        <AnimatedHeroNode />
      </section>

      {/* FAQ Section */}
      <FAQAccordion />

      {/* Pricing Section */}
      <section id="pricing" className="py-20 relative z-10 scroll-mt-24">
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
      <section id="contact" className="py-20 relative z-10">
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
      <footer className="glass-footer py-12 relative z-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              {/* D Logo */}
              <div className="w-8 h-8 rounded-lg overflow-hidden">
                <Image
                  src="/android-chrome-512x512.png"
                  alt="Diverge Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Diverge</span>
            </div>
            <div className="flex space-x-6 text-gray-600">
              <a href="/privacy" className="hover:text-gray-900 transition-colors font-medium">Privacy Policy</a>
              <a href="/terms" className="hover:text-gray-900 transition-colors font-medium">Terms of Service</a>
              <a href="https://x.com/diverge_ai" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors font-medium">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <AnimatedBackground opacity={0.4} />
        <div className="text-center relative z-10">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <LandingPageContent />
    </Suspense>
  )
}
