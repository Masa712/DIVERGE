/**
 * Test script for flexible context strategies
 * Run with: npx tsx src/lib/db/context-strategies.test.ts
 */

import {
  inferOptimalStrategy,
  getDefaultPriority,
  calculateRelevanceScore,
  calculateNodeWeights
} from './context-strategies'
import type { ChatNode, ModelId } from '@/types'

// Mock chat nodes for testing
const mockNodes: ChatNode[] = [
  {
    id: 'node-1',
    parentId: null,
    sessionId: 'session-1',
    model: 'openai/gpt-4o' as ModelId,
    prompt: 'What is machine learning?',
    response: 'Machine learning is a subset of AI that focuses on algorithms that can learn from data.',
    status: 'completed',
    depth: 0,
    promptTokens: 10,
    responseTokens: 25,
    costUsd: 0.01,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:05:00Z'),
    systemPrompt: 'You are a helpful AI assistant.',
    errorMessage: null,
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1.0,
    metadata: {}
  },
  {
    id: 'node-2',
    parentId: 'node-1',
    sessionId: 'session-1',
    model: 'openai/gpt-4o' as ModelId,
    prompt: 'How do neural networks work?',
    response: 'Neural networks consist of interconnected nodes that process information through weighted connections.',
    status: 'completed',
    depth: 1,
    promptTokens: 12,
    responseTokens: 30,
    costUsd: 0.015,
    createdAt: new Date('2024-01-01T11:00:00Z'),
    updatedAt: new Date('2024-01-01T11:05:00Z'),
    systemPrompt: null,
    errorMessage: null,
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1.0,
    metadata: {}
  },
  {
    id: 'node-3',
    parentId: 'node-1',
    sessionId: 'session-1',
    model: 'openai/gpt-4o' as ModelId,
    prompt: 'Can you brainstorm creative applications for AI?',
    response: 'AI can be used in art generation, music composition, creative writing, and innovative design.',
    status: 'completed',
    depth: 1,
    promptTokens: 15,
    responseTokens: 28,
    costUsd: 0.018,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    updatedAt: new Date('2024-01-01T12:05:00Z'),
    systemPrompt: null,
    errorMessage: null,
    temperature: 0.8,
    maxTokens: 1000,
    topP: 1.0,
    metadata: {}
  }
]

console.log('🧪 Testing Context Strategies System\n')

// Test 1: Strategy Inference
console.log('📋 Strategy Inference Tests:')
const testPrompts = [
  { prompt: 'Compare machine learning and deep learning approaches', expected: 'analytical' },
  { prompt: 'Help me brainstorm creative ideas for a mobile app', expected: 'exploratory' },
  { prompt: 'What does @node_123 say about neural networks?', expected: 'reference-heavy' },
  { prompt: 'How do I implement a REST API?', expected: 'focused' },
  { prompt: 'Design a creative story about robots', expected: 'creative' },
  { prompt: 'Tell me about artificial intelligence', expected: 'comprehensive' },
]

testPrompts.forEach(({ prompt, expected }) => {
  const inferred = inferOptimalStrategy(prompt)
  const priority = getDefaultPriority(inferred)
  const match = inferred === expected ? '✅' : '❌'
  
  console.log(`  ${match} "${prompt.slice(0, 40)}..."`)
  console.log(`      Inferred: ${inferred} (${priority}) | Expected: ${expected}`)
})

console.log('\n📊 Relevance Scoring Tests:')
const targetPrompt = 'How do neural networks process information?'
const candidatePrompts = [
  'What are neural networks and how do they work?',
  'Machine learning algorithms for data processing',
  'Creative applications of artificial intelligence',
  'Understanding deep learning architectures'
]

candidatePrompts.forEach(candidate => {
  const score = calculateRelevanceScore(targetPrompt, candidate)
  console.log(`  Target: "${targetPrompt}"`)
  console.log(`  Candidate: "${candidate}"`)
  console.log(`  Relevance Score: ${(score * 100).toFixed(1)}%\n`)
})

console.log('⚖️ Node Weighting Tests:')
const strategies = ['comprehensive', 'focused', 'exploratory', 'analytical', 'creative'] as const
const priorities = ['relevance', 'recency', 'completeness', 'depth', 'breadth'] as const

strategies.forEach(strategy => {
  console.log(`\n  Strategy: ${strategy}`)
  const priority = getDefaultPriority(strategy)
  const weightedNodes = calculateNodeWeights(mockNodes, 'How can AI be used creatively?', strategy, priority, 'gpt-4o')
  
  weightedNodes.forEach(({ node, weight, reason }) => {
    console.log(`    [${node.id.slice(-6)}] Weight: ${(weight * 100).toFixed(1)}% | Reason: ${reason}`)
    console.log(`      "${node.prompt.slice(0, 50)}${node.prompt.length > 50 ? '...' : ''}"`)
  })
})

console.log('\n🎯 Priority Impact Analysis:')
priorities.forEach(priority => {
  console.log(`\n  Priority: ${priority}`)
  const weightedNodes = calculateNodeWeights(mockNodes, 'Tell me about neural networks', 'comprehensive', priority, 'gpt-4o')
  
  weightedNodes.forEach(({ node, weight, reason }) => {
    const age = Math.round((Date.now() - node.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    console.log(`    [${node.id.slice(-6)}] ${(weight * 100).toFixed(1)}% | Age: ${age}d | Tokens: ${node.promptTokens + node.responseTokens}`)
  })
})

console.log('\n🔍 Edge Case Tests:')

// Test empty nodes
console.log('  Empty nodes array:')
const emptyWeights = calculateNodeWeights([], 'test prompt', 'comprehensive', 'relevance', 'gpt-4o')
console.log(`    Result: ${emptyWeights.length} weighted nodes`)

// Test single node
console.log('  Single node:')
const singleWeights = calculateNodeWeights([mockNodes[0]], 'test prompt', 'focused', 'relevance', 'gpt-4o')
console.log(`    Weight: ${(singleWeights[0].weight * 100).toFixed(1)}% | Reason: ${singleWeights[0].reason}`)

// Test relevance edge cases
console.log('  Relevance edge cases:')
const identicalScore = calculateRelevanceScore('test prompt', 'test prompt')
const emptyScore = calculateRelevanceScore('', '')
const noMatchScore = calculateRelevanceScore('machine learning', 'cooking recipes')

console.log(`    Identical strings: ${(identicalScore * 100).toFixed(1)}%`)
console.log(`    Empty strings: ${(emptyScore * 100).toFixed(1)}%`)
console.log(`    No match: ${(noMatchScore * 100).toFixed(1)}%`)

console.log('\n✅ Context Strategies Testing Complete!')

export {}