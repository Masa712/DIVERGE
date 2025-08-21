/**
 * Enhanced Context Performance Cache
 * Optimizes repeated node lookups and reference resolution
 */

import { createClient } from '@/lib/supabase/server'
import { ChatNode } from '@/types'

// In-memory cache for session nodes (scoped to request lifecycle)
const sessionNodeCache = new Map<string, Map<string, any>>()
const shortIdCache = new Map<string, Map<string, string>>() // sessionId -> shortId -> fullId mapping

/**
 * Clear cache for a specific session (e.g., when new nodes are added)
 */
export function clearSessionCache(sessionId: string) {
  sessionNodeCache.delete(sessionId)
  shortIdCache.delete(sessionId)
  console.log(`🗑️ Cleared cache for session ${sessionId}`)
}

/**
 * Get nodes for a session with caching
 */
export async function getCachedSessionNodes(sessionId: string): Promise<any[]> {
  // Check cache first
  if (sessionNodeCache.has(sessionId)) {
    const cachedNodes = sessionNodeCache.get(sessionId)!
    console.log(`💾 Cache hit: ${cachedNodes.size} nodes for session ${sessionId}`)
    return Array.from(cachedNodes.values())
  }

  // Fetch from database
  const supabase = createClient()
  const { data: allNodes, error } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error || !allNodes) {
    console.error('Failed to fetch session nodes:', error)
    return []
  }

  // Cache the results
  const nodeMap = new Map<string, any>()
  const shortIdMap = new Map<string, string>()
  
  allNodes.forEach(node => {
    nodeMap.set(node.id, node)
    shortIdMap.set(node.id.slice(-8), node.id) // short ID -> full ID mapping
  })

  sessionNodeCache.set(sessionId, nodeMap)
  shortIdCache.set(sessionId, shortIdMap)

  console.log(`📦 Cached ${allNodes.length} nodes for session ${sessionId}`)
  return allNodes
}

/**
 * Fast reference resolution using cached short ID mapping
 */
export async function resolveNodeReferences(
  sessionId: string,
  referenceIds: string[]
): Promise<{ refId: string; node: any | null }[]> {
  // Ensure session nodes are cached
  await getCachedSessionNodes(sessionId)
  
  const nodeMap = sessionNodeCache.get(sessionId)
  const shortIdMap = shortIdCache.get(sessionId)
  
  if (!nodeMap || !shortIdMap) {
    return referenceIds.map(refId => ({ refId, node: null }))
  }

  const results = referenceIds.map(refId => {
    // Try direct full ID lookup first
    if (nodeMap.has(refId)) {
      return { refId, node: nodeMap.get(refId) }
    }
    
    // Try short ID lookup
    const fullId = shortIdMap.get(refId)
    if (fullId && nodeMap.has(fullId)) {
      return { refId, node: nodeMap.get(fullId) }
    }
    
    return { refId, node: null }
  })

  console.log(`🔍 Resolved ${results.filter(r => r.node).length}/${referenceIds.length} references via cache`)
  return results
}

/**
 * Get specific nodes by IDs with caching
 */
export async function getCachedNodesByIds(
  sessionId: string,
  nodeIds: string[]
): Promise<any[]> {
  const nodeMap = sessionNodeCache.get(sessionId)
  
  if (nodeMap) {
    // Use cache
    const nodes = nodeIds
      .map(id => nodeMap.get(id))
      .filter(node => node !== undefined)
    
    console.log(`💾 Cache hit: ${nodes.length}/${nodeIds.length} nodes`)
    return nodes
  }

  // Fallback to database query for specific IDs
  const supabase = createClient()
  const { data: nodes, error } = await supabase
    .from('chat_nodes')
    .select('*')
    .in('id', nodeIds)

  if (error) {
    console.error('Failed to fetch nodes by IDs:', error)
    return []
  }

  return nodes || []
}

/**
 * Optimized sibling node query with parent-specific caching
 */
export async function getCachedSiblingNodes(
  parentNodeId: string,
  sessionId: string
): Promise<any[]> {
  const supabase = createClient()
  
  // Direct query for siblings - more efficient than full session scan
  const { data: siblingNodes, error } = await supabase
    .from('chat_nodes')
    .select('*')
    .eq('parent_id', parentNodeId)
    .order('created_at', { ascending: true })
    
  if (error || !siblingNodes) {
    console.log(`❌ Failed to get siblings for parent ${parentNodeId}:`, error?.message)
    return []
  }
  
  console.log(`👥 Found ${siblingNodes.length} siblings for parent ${parentNodeId}`)
  return siblingNodes
}

/**
 * Performance metrics tracking
 */
interface PerformanceMetrics {
  cacheHits: number
  cacheMisses: number
  dbQueries: number
  avgResponseTime: number
}

const performanceMetrics: PerformanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  dbQueries: 0,
  avgResponseTime: 0
}

export function getPerformanceMetrics(): PerformanceMetrics {
  return { ...performanceMetrics }
}

export function resetPerformanceMetrics() {
  performanceMetrics.cacheHits = 0
  performanceMetrics.cacheMisses = 0
  performanceMetrics.dbQueries = 0
  performanceMetrics.avgResponseTime = 0
}