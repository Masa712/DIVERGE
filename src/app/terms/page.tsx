'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AnimatedBackground } from '@/components/ui/AnimatedBackground'

export default function TermsOfServicePage() {
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
              Terms of Service
            </h1>
            <p className="text-gray-600 mb-8">Last Updated: January 10, 2026</p>

            <div className="space-y-8 text-gray-700">
              {/* 1. Introduction */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">1. Introduction</h2>
                <p className="leading-relaxed">
                  These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Diverge (&ldquo;the Service&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
                  By accessing or using the Service, you agree to be bound by these Terms.
                  If you do not agree to these Terms, you must not use the Service.
                </p>
              </section>

              {/* 2. Description of the Service */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">2. Description of the Service</h2>
                <p className="leading-relaxed mb-4">
                  Diverge is a conversational AI service that enables users to interact with multiple AI models and manage conversations through branching and parallel discussion paths.
                </p>
                <div className="ml-4 space-y-2">
                  <h3 className="font-semibold">Key features include:</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Interaction with multiple AI models provided by third-party providers</li>
                    <li>Conversation branching and tree-based management</li>
                    <li>Integrated web search functionality</li>
                    <li>Custom system prompt configuration</li>
                    <li>Storage and management of conversation history</li>
                  </ul>
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  Available features and AI models may change without prior notice due to technical, contractual, or operational reasons.
                </p>
              </section>

              {/* 3. Accounts */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">3. Accounts</h2>

                <div className="space-y-4 ml-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">3.1 Account Creation</h3>
                    <p className="mb-2">To use the Service, you must create an account.</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>You must be at least 13 years old</li>
                      <li>You must provide accurate and complete information</li>
                      <li>Each user may create only one account</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">3.2 Account Security</h3>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>You are responsible for maintaining the confidentiality of your login credentials</li>
                      <li>You must notify us immediately of any unauthorized use of your account</li>
                      <li>All activities conducted through your account are your responsibility</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">3.3 Suspension and Termination</h3>
                    <p className="mb-2">We may suspend or terminate your account in the following cases:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Violation of these Terms or applicable laws</li>
                      <li>Fraudulent, abusive, or malicious use of the Service</li>
                      <li>Security, legal, or regulatory requirements</li>
                      <li>Account deletion requested by the user</li>
                    </ul>
                    <p className="mt-3 text-sm text-gray-600">
                      For free plans, accounts that remain inactive for more than 90 days may be suspended or deleted after prior notice.
                    </p>
                    <p className="text-sm text-gray-600">
                      For paid plans, accounts will not be deleted solely due to inactivity while an active subscription is in place.
                    </p>
                  </div>
                </div>
              </section>

              {/* 4. Pricing, Subscriptions, and Fair Use */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">4. Pricing, Subscriptions, and Fair Use</h2>

                <div className="space-y-4 ml-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">4.1 Plans</h3>
                    <p className="leading-relaxed">
                      The Service offers various subscription plans (e.g., Free, Plus, Pro).
                      The specific features, usage limits, and pricing for each plan are described on our website or within the Service at the time of subscription.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">4.2 Payments</h3>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Payments for paid plans are processed via Stripe</li>
                      <li>Subscriptions are billed on a recurring basis</li>
                      <li>You may manage payment methods through the settings page</li>
                      <li>Failed payments may result in restricted access or suspension</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">4.3 Plan Changes and Cancellation</h3>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>You may change your subscription plan at any time</li>
                      <li>Upgrades take effect immediately</li>
                      <li>Downgrades take effect at the next billing cycle</li>
                      <li>Cancellations become effective at the end of the current billing cycle</li>
                      <li>No prorated refunds are provided</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">4.4 Price Changes</h3>
                    <p className="leading-relaxed">
                      We may change pricing or plan structures with at least 30 days&rsquo; notice.
                      Continued use of the Service after such changes constitutes acceptance of the new pricing.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">4.5 Fair Use and Usage Limits</h3>
                    <p className="mb-2 leading-relaxed">
                      To ensure the stability and sustainability of the Service, we reserve the right to enforce fair use policies, including but not limited to:
                    </p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Rate limits</li>
                      <li>Token usage caps</li>
                      <li>Temporary throttling or restriction of access</li>
                    </ul>
                    <p className="mt-3 text-sm text-gray-600">
                      If your usage significantly exceeds typical usage patterns or places an excessive burden on the Service or underlying AI providers, we may limit your usage, suspend access, or request that you upgrade to a different or custom plan.
                    </p>
                  </div>
                </div>
              </section>

              {/* 5. Acceptable Use and Prohibited Activities */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">5. Acceptable Use and Prohibited Activities</h2>

                <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                  <p className="font-semibold text-red-900 mb-2">Prohibited Activities</p>
                  <p className="text-red-800">
                    The following activities are strictly prohibited. Violation may result in suspension or termination.
                  </p>
                </div>

                <ul className="list-disc ml-6 space-y-2">
                  <li>Illegal activities or content that promotes illegal acts</li>
                  <li>Infringement of intellectual property, privacy, or other rights</li>
                  <li>Hate speech, discrimination, or violent content</li>
                  <li>Content harmful to minors</li>
                  <li>Spam, excessive automated requests, or abuse of system resources</li>
                  <li>Attempting to compromise the security or integrity of the Service</li>
                  <li>Impersonation of others</li>
                  <li>Circumventing rate limits or safeguards</li>
                  <li>Reverse engineering or unauthorized access</li>
                  <li>Creating multiple accounts for abusive purposes</li>
                  <li>Improper sharing of personal or confidential information</li>
                  <li>Generating content that violates the usage policies or terms of third-party AI providers used by the Service</li>
                </ul>
              </section>

              {/* 6. Content and Data */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">6. Content and Data</h2>

                <div className="space-y-4 ml-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">6.1 User Content</h3>
                    <p className="leading-relaxed mb-2">
                      You retain rights to the prompts you submit and the outputs generated for you.
                      By using the Service, you grant us a limited, non-exclusive license to process, store, and display such content solely for the purpose of providing and operating the Service.
                    </p>
                    <p className="text-sm text-gray-600">
                      We may remove content that violates these Terms or applicable laws.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">6.2 AI-Generated Content Disclaimer</h3>
                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 my-3">
                      <p className="font-semibold text-yellow-900 mb-2">Important Notice</p>
                      <ul className="text-yellow-800 space-y-1">
                        <li>AI-generated content may be inaccurate, incomplete, or misleading</li>
                        <li>Outputs must not be relied upon as medical, legal, or financial advice</li>
                        <li>You are responsible for verifying outputs before use</li>
                        <li>Use of AI-generated content is at your own risk</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">6.3 Data Backup</h3>
                    <p className="leading-relaxed">
                      While we take reasonable measures to back up data, we do not guarantee data integrity or availability.
                      You are encouraged to export and store important data regularly.
                    </p>
                  </div>
                </div>
              </section>

              {/* 7. Service Modifications and Availability */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">7. Service Modifications and Availability</h2>

                <div className="space-y-4 ml-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">7.1 Service Changes</h3>
                    <p className="leading-relaxed">
                      We may add, modify, or remove features at any time without prior notice.
                      Material changes will be communicated where reasonably possible.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">7.2 Temporary Suspension</h3>
                    <p className="mb-2">The Service may be temporarily unavailable due to:</p>
                    <ul className="list-disc ml-6 space-y-1">
                      <li>Scheduled maintenance</li>
                      <li>Emergency security measures</li>
                      <li>Third-party service outages</li>
                      <li>Unexpected technical issues</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-lg mb-2">7.3 Service Termination</h3>
                    <p className="leading-relaxed">
                      We may discontinue the Service, in whole or in part, with at least 30 days&rsquo; notice.
                      Where feasible, users will be given an opportunity to export their data prior to termination.
                    </p>
                  </div>
                </div>
              </section>

              {/* 8. Intellectual Property and Usage Rights */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">8. Intellectual Property and Usage Rights</h2>
                <p className="leading-relaxed mb-4">
                  All software, designs, logos, and related materials associated with the Service are owned by us or our licensors.
                </p>
                <p className="leading-relaxed mb-4">
                  Subject to these Terms, users may use the Service for personal or business purposes, including commercial use.
                </p>
                <div className="ml-4">
                  <p className="font-semibold mb-2">The following uses are prohibited without prior written consent:</p>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>Reselling or sublicensing the Service</li>
                    <li>Providing the Service as a competing product</li>
                    <li>Using the Service to build or train competing AI systems</li>
                  </ul>
                </div>
              </section>

              {/* 9. Disclaimer of Warranties */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">9. Disclaimer of Warranties</h2>
                <div className="bg-gray-50 border-l-4 border-gray-400 p-4 mb-4">
                  <p className="font-semibold text-gray-900 mb-2">&ldquo;As Is&rdquo; Service</p>
                  <p className="text-gray-700">
                    The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
                    We make no warranties regarding uninterrupted operation, accuracy of AI-generated content, or fitness for a particular purpose.
                  </p>
                </div>
              </section>

              {/* 10. Limitation of Liability */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">10. Limitation of Liability</h2>
                <p className="leading-relaxed mb-4">
                  To the maximum extent permitted by law, we shall not be liable for indirect, incidental, consequential, or special damages, including loss of data, profits, or business opportunities.
                </p>
                <p className="leading-relaxed mb-4">
                  Our total liability arising out of or relating to the Service shall not exceed the amount paid by you for the Service during the 12 months preceding the claim.
                </p>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                  <p className="font-semibold text-blue-900 mb-2">Consumer Contract Act Notice (Japan)</p>
                  <p className="text-blue-800 text-sm leading-relaxed">
                    If you are a consumer under the Consumer Contract Act of Japan:
                  </p>
                  <ul className="text-blue-800 text-sm ml-4 mt-2 space-y-1">
                    <li>• We are fully liable for damages caused by our intentional misconduct or gross negligence</li>
                    <li>• For damages caused by our ordinary negligence, our liability is limited as described in this section</li>
                  </ul>
                </div>
              </section>

              {/* 11. Indemnification */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">11. Indemnification</h2>
                <p className="leading-relaxed mb-2">
                  You agree to indemnify and hold us harmless from any claims, damages, losses, and expenses (including reasonable attorneys&rsquo; fees) arising from:
                </p>
                <ul className="list-disc ml-6 space-y-1">
                  <li>Your violation of these Terms</li>
                  <li>Your misuse of the Service</li>
                  <li>Content you submit or generate using the Service</li>
                </ul>
              </section>

              {/* 12. Governing Law and Jurisdiction */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">12. Governing Law and Jurisdiction</h2>
                <p className="leading-relaxed">
                  These Terms are governed by and construed in accordance with the laws of Japan.
                  Any disputes arising out of or relating to the Service shall be subject to the exclusive jurisdiction of the Tokyo District Court as the court of first instance.
                </p>
              </section>

              {/* 13. Changes to These Terms */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">13. Changes to These Terms</h2>
                <p className="leading-relaxed">
                  We may update these Terms from time to time.
                  Material changes will be notified within the Service.
                  Continued use of the Service after changes take effect constitutes acceptance of the revised Terms.
                </p>
              </section>

              {/* 14. Severability */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">14. Severability</h2>
                <p className="leading-relaxed">
                  If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.
                </p>
              </section>

              {/* 15. Contact Information */}
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">15. Contact Information</h2>
                <p className="leading-relaxed mb-4">
                  If you have any questions regarding these Terms, please contact:
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
                <p className="text-center text-gray-600 leading-relaxed">
                  By agreeing to these Terms, you commit to using Diverge responsibly and in accordance with all applicable laws.
                </p>
                <p className="text-center text-gray-600 mt-4">
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
