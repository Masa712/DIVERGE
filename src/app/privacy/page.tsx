'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AnimatedBackground } from '@/components/ui/AnimatedBackground'

export default function PrivacyPolicyPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen text-gray-900 relative">
      <AnimatedBackground opacity={0.3} />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="container mx-auto px-4 py-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Home</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 md:p-12">
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Privacy Policy
            </h1>
            <p className="text-gray-600 mb-8">Last Updated: January 10, 2026</p>

            <div className="space-y-8 text-gray-700">
              {/* 1. Introduction */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">1. Introduction</h2>
                <p className="leading-relaxed mb-4">
                  Diverge (&ldquo;the Service&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) respects your privacy and is committed to protecting your personal information.
                  This Privacy Policy explains how we collect, use, store, and protect personal data when you use the Service.
                </p>
                <p className="leading-relaxed">
                  The operator of the Service (the &ldquo;Operator&rdquo;) is identified in the page based on the Act on Specified Commercial Transactions, which also provides our contact details and address.
                </p>
              </section>

              {/* 2. Information We Collect */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">2. Information We Collect</h2>
                <p className="leading-relaxed mb-4">We collect the following categories of information:</p>

                <div className="space-y-4 ml-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">2.1 Account Information</h3>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Email address</li>
                      <li>Username (optional)</li>
                      <li>Authentication information provided via OAuth or social login providers</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">2.2 Usage Information</h3>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Conversation history between you and the AI</li>
                      <li>Session metadata (conversation titles, creation and update timestamps)</li>
                      <li>AI model types used</li>
                      <li>Token usage and cost-related information</li>
                      <li>Web search queries and usage counts</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">2.3 Technical Information</h3>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>IP address</li>
                      <li>Browser type and version</li>
                      <li>Device information</li>
                      <li>Access logs</li>
                      <li>Error and diagnostic logs (via Sentry)</li>
                    </ul>
                    <p className="text-sm text-gray-600 mt-2">
                      Where technically feasible, we take reasonable measures to mask or minimize the inclusion of sensitive personal information in error logs.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">2.4 Payment Information</h3>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Billing details</li>
                      <li>Subscription plan information</li>
                      <li>Payment history</li>
                    </ul>
                    <p className="text-sm text-gray-600 mt-2">
                      Payment processing is handled by Stripe. We do not store credit card information on our servers.
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. Purpose of Use */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">3. Purpose of Use</h2>
                <p className="leading-relaxed mb-4">We use collected information for the following purposes:</p>
                <ul className="list-disc ml-6 space-y-2">
                  <li>Providing, operating, and maintaining the Service</li>
                  <li>Managing user accounts and authentication</li>
                  <li>Providing customer support</li>
                  <li>Improving the Service and developing new features</li>
                  <li>Preventing fraud, abuse, and unauthorized use</li>
                  <li>Analyzing usage trends (via PostHog)</li>
                  <li>Detecting and fixing errors (via Sentry)</li>
                  <li>Billing and payment processing (via Stripe)</li>
                  <li>Complying with applicable laws and regulations</li>
                </ul>
              </section>

              {/* 4. Handling of Conversation Data */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">4. Handling of Conversation Data</h2>

                <div className="space-y-4 ml-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">4.1 Storage and Developer Access</h3>
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                      <p className="font-semibold text-blue-900 mb-2">Important Information</p>
                      <p className="text-blue-800">
                        Conversation content between you and the AI is stored in our database to provide the Service.
                      </p>
                    </div>
                    <p className="mb-2">Authorized developers may access such data only when necessary for:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Responding to user support requests</li>
                      <li>Investigating and resolving technical issues</li>
                      <li>Detecting and addressing abuse or illegal activity</li>
                      <li>Complying with legal or regulatory requirements</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">4.2 Access Controls and Security</h3>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Access is restricted to the minimum number of authorized personnel</li>
                      <li>All access is logged</li>
                      <li>Unauthorized or non-business access is prohibited</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">4.3 Encryption</h3>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>All communications are encrypted using SSL/TLS</li>
                      <li>Database connections are encrypted</li>
                      <li>Data is protected using Supabase security features, including Row Level Security (RLS)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">4.4 AI Training Policy</h3>
                    <p className="mb-2">
                      Conversation data collected by the Service is <strong>not used</strong> to train, fine-tune, or retrain our own AI models.
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      To generate responses, conversation content is transmitted to third-party AI providers via API.
                      Many AI providers do not use API-submitted data for training by default; however, data handling policies may vary depending on the specific provider or model selected by the user.
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      We transmit data strictly for the purpose of generating responses and take reasonable measures to ensure secure handling in accordance with applicable agreements and policies.
                    </p>
                  </div>
                </div>
              </section>

              {/* 5. Sharing with Third-Party Services */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">5. Sharing with Third-Party Services</h2>
                <p className="leading-relaxed mb-4">We use the following third-party services:</p>

                <div className="space-y-3 ml-4">
                  <div className="border-l-2 border-gray-300 pl-4">
                    <h3 className="font-semibold">Supabase</h3>
                    <p className="text-sm text-gray-600">Database and authentication</p>
                  </div>
                  <div className="border-l-2 border-gray-300 pl-4">
                    <h3 className="font-semibold">AI providers (via OpenRouter, OpenAI, Anthropic, etc.)</h3>
                    <p className="text-sm text-gray-600">AI response generation</p>
                  </div>
                  <div className="border-l-2 border-gray-300 pl-4">
                    <h3 className="font-semibold">Stripe</h3>
                    <p className="text-sm text-gray-600">Payment processing</p>
                  </div>
                  <div className="border-l-2 border-gray-300 pl-4">
                    <h3 className="font-semibold">PostHog</h3>
                    <p className="text-sm text-gray-600">Usage analytics (anonymized where possible)</p>
                  </div>
                  <div className="border-l-2 border-gray-300 pl-4">
                    <h3 className="font-semibold">Sentry</h3>
                    <p className="text-sm text-gray-600">Error tracking and diagnostics</p>
                  </div>
                  <div className="border-l-2 border-gray-300 pl-4">
                    <h3 className="font-semibold">Tavily</h3>
                    <p className="text-sm text-gray-600">Web search query processing</p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                  Each provider processes data in accordance with its own privacy policy.
                </p>

                <div className="mt-6">
                  <h3 className="font-semibold text-lg mb-2">International Data Transfers</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Some third-party providers operate servers outside Japan, primarily in the United States or other countries.
                    Personal data may therefore be transferred to foreign jurisdictions.
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    We take appropriate contractual, organizational, and technical measures to ensure that such transfers are conducted in compliance with applicable laws and that an adequate level of data protection is maintained.
                  </p>
                </div>
              </section>

              {/* 6. Web Search Function Notice */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">6. Web Search Function Notice</h2>
                <p className="leading-relaxed mb-4">
                  When you use the web search feature, parts of your input may be sent as search queries to external search providers such as Tavily.
                </p>
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
                  <p className="text-yellow-900">
                    You are responsible for ensuring that sensitive or confidential information is not included in search queries.
                    Search queries are processed externally in accordance with the respective provider&rsquo;s policies.
                  </p>
                </div>
              </section>

              {/* 7. Data Retention */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">7. Data Retention</h2>
                <ul className="list-disc ml-6 space-y-2">
                  <li><strong>Account information:</strong> retained until account deletion</li>
                  <li><strong>Conversation history:</strong> retained until deleted by the user or as required by law</li>
                  <li><strong>Analytics data:</strong> anonymized and retained for service improvement</li>
                  <li><strong>Log data:</strong> typically retained for 30 to 90 days</li>
                </ul>
              </section>

              {/* 8. Your Rights */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">8. Your Rights</h2>
                <p className="leading-relaxed mb-4">Depending on applicable laws, you may have the following rights:</p>
                <ul className="list-disc ml-6 space-y-2">
                  <li><strong>Right to request disclosure</strong> of retained personal data</li>
                  <li><strong>Right to access</strong> your personal data</li>
                  <li><strong>Right to correct</strong> inaccurate information</li>
                  <li><strong>Right to request deletion</strong> of personal data (including account deletion)</li>
                  <li><strong>Right to data portability</strong></li>
                  <li><strong>Right to object</strong> to certain processing activities</li>
                </ul>
                <p className="mt-4 text-sm text-gray-600">
                  You may exercise these rights via the settings page or by contacting support.
                </p>
              </section>

              {/* 9. Cookies */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">9. Cookies</h2>
                <p className="leading-relaxed mb-4">We use cookies to:</p>
                <ul className="list-disc ml-6 space-y-2">
                  <li>Maintain login sessions</li>
                  <li>Store user preferences</li>
                  <li>Analyze service usage</li>
                </ul>
                <p className="mt-4 text-sm text-gray-600">
                  You may disable cookies via your browser settings, but some features may not function properly.
                  In certain regions, consent may be requested before using non-essential cookies.
                </p>
              </section>

              {/* 10. Children's Privacy */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">10. Children&rsquo;s Privacy</h2>
                <p className="leading-relaxed">
                  The Service is not intended for children under the age of 13.
                  We do not knowingly collect personal information from children under 13.
                  If you believe such information has been provided, please contact us.
                </p>
              </section>

              {/* 11. Changes to This Privacy Policy */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">11. Changes to This Privacy Policy</h2>
                <p className="leading-relaxed">
                  We may update this Privacy Policy from time to time.
                  Material changes will be notified within the Service.
                  Continued use of the Service after changes take effect constitutes acceptance of the revised policy.
                </p>
              </section>

              {/* 12. Governing Law and Jurisdiction */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">12. Governing Law and Jurisdiction</h2>
                <p className="leading-relaxed">
                  This Privacy Policy is governed by and construed in accordance with the laws of Japan.
                  Any disputes relating to this policy shall be subject to the exclusive jurisdiction of the district court having jurisdiction over the location of the Operator&rsquo;s head office (e.g., the Tokyo District Court).
                </p>
              </section>

              {/* 13. Contact Information */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">13. Contact Information</h2>
                <p className="leading-relaxed mb-4">
                  For questions or concerns regarding this Privacy Policy, please contact:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-semibold">Diverge Support Team</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Via the support section in the settings page
                  </p>
                </div>
              </section>

              {/* Signature */}
              <section className="border-t pt-8 mt-12">
                <p className="text-center text-gray-600">
                  © 2026 Diverge. All rights reserved.
                </p>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
