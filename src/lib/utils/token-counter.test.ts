/**
 * Simple test script for token counter accuracy
 * Run with: npx tsx src/lib/utils/token-counter.test.ts
 */

import { 
  countTokens, 
  countMessageTokens, 
  estimateTokensFallback,
  truncateToTokenLimit,
  getModelTokenLimit
} from './token-counter'

// Test cases
const testTexts = [
  "Hello, world!",
  "This is a longer piece of text that should have more tokens than the previous example.",
  "コンテキスト構築システムのパフォーマンス最適化を行います。", // Japanese text
  "function buildEnhancedContext(nodeId: string, options = {}) { return context; }", // Code
  `
  This is a multi-line text that contains:
  - Bullet points
  - Multiple sentences and paragraphs
  - Various punctuation marks!
  - Numbers like 123, 456, and 789
  - Special characters: @#$%^&*()
  
  It should be interesting to see how the token counting performs.
  `,
]

const testMessages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is machine learning?' },
  { role: 'assistant', content: 'Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data.' },
]

console.log('🧪 Testing Token Counter Accuracy\n')

// Test 1: Basic token counting
console.log('📊 Basic Token Counting:')
testTexts.forEach((text, index) => {
  const tikTokenCount = countTokens(text, 'gpt-4o')
  const fallbackCount = estimateTokensFallback(text)
  const accuracy = tikTokenCount > 0 ? fallbackCount / tikTokenCount : 0
  
  console.log(`  Text ${index + 1}:`)
  console.log(`    Tiktoken:  ${tikTokenCount} tokens`)
  console.log(`    Fallback:  ${fallbackCount} tokens`)
  console.log(`    Accuracy:  ${(accuracy * 100).toFixed(1)}%`)
  console.log(`    Text:      "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`)
  console.log()
})

// Test 2: Message token counting
console.log('💬 Message Token Counting:')
const messageTokens = countMessageTokens(testMessages, 'gpt-4o')
const individualTokens = testMessages.reduce((total, msg) => 
  total + countTokens(msg.content, 'gpt-4o') + countTokens(msg.role, 'gpt-4o') + 4, 2
)

console.log(`  Message format tokens: ${messageTokens}`)
console.log(`  Individual sum:        ${individualTokens}`)
console.log(`  Overhead efficiency:   ${((messageTokens - individualTokens) / messageTokens * 100).toFixed(1)}%`)
console.log()

// Test 3: Model limits
console.log('🎯 Model Token Limits:')
const models = ['gpt-4o', 'gpt-4', 'claude-3.5-sonnet', 'gpt-3.5-turbo']
models.forEach(model => {
  const limit = getModelTokenLimit(model)
  console.log(`  ${model}: ${limit.toLocaleString()} tokens`)
})
console.log()

// Test 4: Truncation
console.log('✂️ Text Truncation Test:')
const longText = testTexts[4] // The multi-line text
const result = truncateToTokenLimit(longText, 'gpt-4o', 50)
console.log(`  Original: ${countTokens(longText, 'gpt-4o')} tokens`)
console.log(`  Target:   50 tokens`)
console.log(`  Result:   ${result.tokenCount} tokens`)
console.log(`  Truncated: ${result.truncated}`)
console.log(`  Text:     "${result.text.slice(0, 100)}${result.text.length > 100 ? '...' : ''}"`)
console.log()

// Test 5: Language-specific accuracy
console.log('🌏 Language-Specific Accuracy:')
const languageTests = [
  { lang: 'English', text: 'The quick brown fox jumps over the lazy dog.' },
  { lang: 'Japanese', text: '素早い茶色の狐が怠惰な犬の上を跳ぶ。' },
  { lang: 'Code', text: 'const result = await buildContext(nodeId, { maxTokens: 1000 });' },
  { lang: 'Mixed', text: 'Enhanced context システムで performance を最適化します。' },
]

languageTests.forEach(({ lang, text }) => {
  const tikTokenCount = countTokens(text, 'gpt-4o')
  const fallbackCount = estimateTokensFallback(text)
  const accuracy = tikTokenCount > 0 ? (fallbackCount / tikTokenCount) * 100 : 0
  
  console.log(`  ${lang}: ${tikTokenCount} (tiktoken) vs ${fallbackCount} (fallback) = ${accuracy.toFixed(1)}% accuracy`)
})

console.log('\n✅ Token Counter Testing Complete!')

export {}