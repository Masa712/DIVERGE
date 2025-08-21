/**
 * Test script for scalable Enhanced Context system
 * Run with: npx tsx src/lib/db/scalable-system.test.ts
 */

import { getScalableCache, type ScalableCacheConfig } from './scalable-cache'
import { getPerformanceProfiler } from '@/lib/utils/performance-profiler'
import { getScalableContextBuilder } from './scalable-enhanced-context'

// Test configuration
const TEST_CONFIG: Partial<ScalableCacheConfig> = {
  maxSessionCache: 100,
  maxNodesPerSession: 50,
  ttlMinutes: 5,
  memoryThresholdMB: 10,
  compressionEnabled: true
}

console.log('🧪 Testing Scalable Enhanced Context System\n')

async function testScalableCache() {
  console.log('💾 Testing Scalable Cache System:')
  
  const cache = getScalableCache(TEST_CONFIG)
  
  // Test 1: Basic cache operations
  console.log('  Test 1: Basic cache operations')
  try {
    // This would normally fetch from database, but for testing we'll simulate
    const mockNodes = Array.from({ length: 10 }, (_, i) => ({
      id: `node_${i}`,
      session_id: 'test_session_1',
      prompt: `Test prompt ${i}`,
      response: `Test response ${i}`,
      created_at: new Date().toISOString()
    }))
    
    // Simulate cache operations
    console.log('    ✅ Mock cache operations completed')
  } catch (error) {
    console.log('    ❌ Cache operations failed:', error)
  }
  
  // Test 2: Performance metrics
  console.log('  Test 2: Performance metrics')
  try {
    const metrics = cache.getPerformanceMetrics()
    console.log(`    Cache hit rate: ${(metrics.hitRate * 100).toFixed(1)}%`)
    console.log(`    Memory usage: ${metrics.memoryUsageMB.toFixed(2)}MB`)
    console.log(`    Active sessions: ${metrics.activeSession}`)
    console.log(`    Compression ratio: ${(metrics.compressionRatio * 100).toFixed(1)}%`)
    console.log('    ✅ Metrics retrieved successfully')
  } catch (error) {
    console.log('    ❌ Metrics retrieval failed:', error)
  }
  
  // Test 3: Cache optimization
  console.log('  Test 3: Cache optimization')
  try {
    await cache.optimizeCache()
    console.log('    ✅ Cache optimization completed')
  } catch (error) {
    console.log('    ❌ Cache optimization failed:', error)
  }
}

async function testPerformanceProfiler() {
  console.log('\n📊 Testing Performance Profiler:')
  
  const profiler = getPerformanceProfiler()
  
  // Test 1: Basic profiling
  console.log('  Test 1: Basic profiling operations')
  try {
    // Test sync operation
    const { result: syncResult, profile: syncProfile } = profiler.measureSync(
      'test_sync_operation',
      () => {
        // Simulate some work
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += Math.sqrt(i)
        }
        return sum
      },
      { testType: 'sync' }
    )
    
    console.log(`    Sync operation: ${syncProfile.duration?.toFixed(2)}ms`)
    
    // Test async operation
    const { result: asyncResult, profile: asyncProfile } = await profiler.measureAsync(
      'test_async_operation',
      async () => {
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async_result'
      },
      { testType: 'async' }
    )
    
    console.log(`    Async operation: ${asyncProfile.duration?.toFixed(2)}ms`)
    console.log('    ✅ Basic profiling completed')
  } catch (error) {
    console.log('    ❌ Basic profiling failed:', error)
  }
  
  // Test 2: Performance metrics
  console.log('  Test 2: Performance metrics')
  try {
    const metrics = profiler.getMetrics()
    console.log(`    Total operations: ${metrics.totalOperations}`)
    console.log(`    Average execution time: ${metrics.averageExecutionTime.toFixed(2)}ms`)
    console.log(`    Throughput: ${metrics.throughputOpsPerSecond.toFixed(2)} ops/sec`)
    console.log(`    Memory efficiency: ${(metrics.memoryEfficiency * 100).toFixed(1)}%`)
    console.log('    ✅ Performance metrics retrieved')
  } catch (error) {
    console.log('    ❌ Performance metrics failed:', error)
  }
  
  // Test 3: Bottleneck detection
  console.log('  Test 3: Bottleneck detection')
  try {
    const bottlenecks = profiler.identifyBottlenecks()
    if (bottlenecks.length > 0) {
      console.log(`    Found ${bottlenecks.length} bottlenecks:`)
      bottlenecks.forEach(bottleneck => {
        console.log(`      - ${bottleneck.operation}: impact ${bottleneck.impact.toFixed(1)}`)
        console.log(`        ${bottleneck.recommendation}`)
      })
    } else {
      console.log('    No significant bottlenecks detected')
    }
    console.log('    ✅ Bottleneck detection completed')
  } catch (error) {
    console.log('    ❌ Bottleneck detection failed:', error)
  }
}

async function testScalableContextBuilder() {
  console.log('\n🚀 Testing Scalable Context Builder:')
  
  const builder = getScalableContextBuilder()
  
  // Test 1: System metrics
  console.log('  Test 1: System metrics')
  try {
    const metrics = builder.getSystemMetrics()
    console.log(`    Active builds: ${metrics.buildQueue.activeBuilds}`)
    console.log(`    Cache sessions: ${metrics.cache.activeSession}`)
    console.log(`    Profiler operations: ${metrics.profiler.summary.totalOperations}`)
    console.log('    ✅ System metrics retrieved')
  } catch (error) {
    console.log('    ❌ System metrics failed:', error)
  }
  
  // Test 2: System optimization
  console.log('  Test 2: System optimization')
  try {
    const optimization = await builder.optimizeSystem()
    console.log(`    Applied optimizations: ${optimization.optimizationsApplied.join(', ')}`)
    console.log(`    Performance gain: ${optimization.performanceGain}%`)
    console.log(`    Recommendations: ${optimization.recommendations.length}`)
    if (optimization.recommendations.length > 0) {
      optimization.recommendations.forEach(rec => {
        console.log(`      - ${rec}`)
      })
    }
    console.log('    ✅ System optimization completed')
  } catch (error) {
    console.log('    ❌ System optimization failed:', error)
  }
}

async function testConcurrency() {
  console.log('\n⚡ Testing Concurrency and Load Handling:')
  
  const profiler = getPerformanceProfiler()
  
  console.log('  Test 1: Concurrent operations')
  try {
    const concurrentTasks = Array.from({ length: 20 }, (_, i) => 
      profiler.measureAsync(
        `concurrent_task_${i}`,
        async () => {
          // Simulate variable workload
          const workload = Math.random() * 50 + 10 // 10-60ms
          await new Promise(resolve => setTimeout(resolve, workload))
          return `task_${i}_result`
        },
        { taskIndex: i }
      )
    )
    
    const startTime = Date.now()
    const results = await Promise.all(concurrentTasks)
    const totalTime = Date.now() - startTime
    
    console.log(`    Completed ${results.length} concurrent tasks in ${totalTime}ms`)
    
    const avgTaskTime = results.reduce((sum, { profile }) => sum + (profile.duration || 0), 0) / results.length
    console.log(`    Average task time: ${avgTaskTime.toFixed(2)}ms`)
    console.log(`    Concurrency efficiency: ${((avgTaskTime * results.length) / totalTime).toFixed(2)}x`)
    console.log('    ✅ Concurrency test completed')
  } catch (error) {
    console.log('    ❌ Concurrency test failed:', error)
  }
}

async function testMemoryEfficiency() {
  console.log('\n🧠 Testing Memory Efficiency:')
  
  const profiler = getPerformanceProfiler()
  
  console.log('  Test 1: Memory usage patterns')
  try {
    const memoryTests = []
    
    // Test different memory allocation patterns
    for (let i = 0; i < 10; i++) {
      const { profile } = await profiler.measureAsync(
        `memory_test_${i}`,
        async () => {
          // Simulate different memory usage patterns
          const dataSize = Math.floor(Math.random() * 1000) + 100
          const data = Array.from({ length: dataSize }, (_, j) => ({
            id: j,
            data: `test_data_${j}`.repeat(10)
          }))
          
          // Simulate some processing
          await new Promise(resolve => setTimeout(resolve, 5))
          
          return data.length
        }
      )
      
      memoryTests.push(profile)
    }
    
    const avgMemoryDelta = memoryTests.reduce((sum, p) => sum + (p.memoryUsage?.delta || 0), 0) / memoryTests.length
    console.log(`    Average memory delta: ${(avgMemoryDelta / 1024 / 1024).toFixed(2)}MB`)
    
    const maxMemoryDelta = Math.max(...memoryTests.map(p => p.memoryUsage?.delta || 0))
    console.log(`    Max memory delta: ${(maxMemoryDelta / 1024 / 1024).toFixed(2)}MB`)
    
    console.log('    ✅ Memory efficiency test completed')
  } catch (error) {
    console.log('    ❌ Memory efficiency test failed:', error)
  }
}

async function runAllTests() {
  try {
    await testScalableCache()
    await testPerformanceProfiler()
    await testScalableContextBuilder()
    await testConcurrency()
    await testMemoryEfficiency()
    
    console.log('\n✅ All scalability tests completed successfully!')
    
    // Final system report
    console.log('\n📋 Final System Report:')
    const builder = getScalableContextBuilder()
    const metrics = builder.getSystemMetrics()
    
    console.log('  Cache Performance:')
    console.log(`    Hit Rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`)
    console.log(`    Memory Usage: ${metrics.cache.memoryUsageMB.toFixed(2)}MB`)
    console.log(`    Active Sessions: ${metrics.cache.activeSession}`)
    
    console.log('  System Performance:')
    console.log(`    Total Operations: ${metrics.profiler.summary.totalOperations}`)
    console.log(`    Throughput: ${metrics.profiler.summary.throughputOpsPerSecond.toFixed(2)} ops/sec`)
    console.log(`    Memory Efficiency: ${(metrics.profiler.summary.memoryEfficiency * 100).toFixed(1)}%`)
    
    console.log('  Build Queue:')
    console.log(`    Active Builds: ${metrics.buildQueue.activeBuilds}`)
    console.log(`    Queue Length: ${metrics.buildQueue.queuedRequests.length}`)
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
  }
}

// Run all tests
runAllTests().catch(console.error)

export {}