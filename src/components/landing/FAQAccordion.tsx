'use client'

import { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

type FAQItem = {
  question: string
  answer: string
}

const faqData: FAQItem[] = [
  {
    question: "How is Diverge different from traditional AI chat?",
    answer: "Diverge visualizes conversations as a tree structure, allowing you to branch off and explore multiple ideas in parallel. You can also use multiple AI models on one platform and easily compare their responses."
  },
  {
    question: "Is the free plan sufficient?",
    answer: "The free plan offers 500,000 tokens, unlimited sessions, and 10 web searches per month with basic AI models, perfect for personal use. For frequent use or advanced models, consider upgrading to Plus or Pro."
  },
  {
    question: "How secure is my data?",
    answer: "All communications are encrypted and stored in secure cloud infrastructure. Your data is protected by strict privacy policies and regular security audits."
  },
  {
    question: "Can I use it on mobile?",
    answer: "Yes, Diverge is fully responsive and works smoothly on smartphones and tablets with an optimized touch interface."
  }
]

export function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="py-20 relative z-10 scroll-mt-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Find answers to common questions about Diverge
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqData.map((faq, index) => {
            const isOpen = openIndex === index

            return (
              <div
                key={index}
                className="glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left transition-all duration-200"
                >
                  <h3 className="text-lg font-semibold text-gray-800 pr-4">
                    {faq.question}
                  </h3>
                  <ChevronDownIcon
                    className={`w-6 h-6 text-gray-600 flex-shrink-0 transition-transform duration-300 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-5 pt-0">
                    <div className="border-t border-white/30 pt-4">
                      <p className="text-gray-700 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
