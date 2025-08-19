'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Position,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ChatNode } from '@/types'
import { MessageNode } from './message-node'
import { BalancedTreeView } from './BalancedTreeView'

interface Props {
  nodes: ChatNode[]
  currentNodeId?: string
  onNodeClick?: (nodeId: string) => void
  onBranchCreate?: (parentNodeId: string, prompt: string) => void
}

const nodeTypes = {
  message: MessageNode,
}

export function ChatTreeView({ 
  nodes: chatNodes, 
  currentNodeId, 
  onNodeClick, 
  onBranchCreate 
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [useBalancedLayout, setUseBalancedLayout] = useState(false)

  // Convert chat nodes to React Flow nodes and edges with improved layout
  useEffect(() => {
    if (!chatNodes || chatNodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    console.log('Processing chat nodes:', chatNodes.length, 'nodes')
    console.log('Sample node structure:', chatNodes[0])

    // Create a map for quick lookup and validate parent-child relationships
    const nodeMap = new Map(chatNodes.map(n => [n.id, n]))
    
    // Build parent-children relationships with validation
    const childrenMap = new Map<string, ChatNode[]>()
    const rootNodes: ChatNode[] = []
    
    chatNodes.forEach(node => {
      if (node.parentId && node.parentId !== null) {
        // Validate that parent exists
        if (!nodeMap.has(node.parentId)) {
          console.warn(`Node ${node.id} references non-existent parent ${node.parentId}`)
          rootNodes.push(node) // Treat as root if parent doesn't exist
          return
        }
        
        if (!childrenMap.has(node.parentId)) {
          childrenMap.set(node.parentId, [])
        }
        childrenMap.get(node.parentId)!.push(node)
      } else {
        rootNodes.push(node)
      }
    })
    
    console.log('Root nodes:', rootNodes.length)
    console.log('Parent-child relationships:', Array.from(childrenMap.entries()).map(([parent, children]) => 
      ({ parent, childCount: children.length })))
    
    // Sort children by creation time to maintain consistent ordering
    childrenMap.forEach(children => {
      children.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    })
    
    // Calculate positions with simple but reliable algorithm
    const nodePositions = new Map<string, { x: number; y: number }>()
    const horizontalSpacing = 450  // Increased spacing for better visual separation
    const verticalSpacing = 400    // Increased vertical spacing between levels
    
    // New approach: Group nodes by parent, then sort by creation time within each group
    const nodesByDepth = new Map<number, ChatNode[]>()
    
    // Group nodes by depth first
    chatNodes.forEach(node => {
      if (!nodesByDepth.has(node.depth)) {
        nodesByDepth.set(node.depth, [])
      }
      nodesByDepth.get(node.depth)!.push(node)
    })
    
    // For each depth level, group by parent and then sort by creation time
    const orderedNodesByDepth = new Map<number, ChatNode[]>()
    
    nodesByDepth.forEach((nodes, depth) => {
      if (depth === 0) {
        // Root nodes: just sort by creation time
        const sortedNodes = [...nodes].sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        orderedNodesByDepth.set(depth, sortedNodes)
      } else {
        // Group by parent, then sort each group by creation time
        const nodesByParent = new Map<string, ChatNode[]>()
        
        nodes.forEach(node => {
          const parentId = node.parentId || 'root'
          if (!nodesByParent.has(parentId)) {
            nodesByParent.set(parentId, [])
          }
          nodesByParent.get(parentId)!.push(node)
        })
        
        // Sort nodes within each parent group by creation time
        nodesByParent.forEach(parentNodes => {
          parentNodes.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          )
        })
        
        // Get parent nodes from previous depth to determine order
        const parentDepthNodes = orderedNodesByDepth.get(depth - 1) || []
        
        // Arrange children in the order of their parents
        const orderedNodes: ChatNode[] = []
        parentDepthNodes.forEach(parentNode => {
          const children = nodesByParent.get(parentNode.id) || []
          orderedNodes.push(...children)
        })
        
        // Add any orphaned nodes (nodes whose parents are not in the previous depth)
        nodesByParent.forEach((children, parentId) => {
          if (parentId !== 'root' && !parentDepthNodes.find(p => p.id === parentId)) {
            orderedNodes.push(...children)
          }
        })
        
        orderedNodesByDepth.set(depth, orderedNodes)
      }
    })
    
    // Position nodes: dynamic parent spacing to prevent child overlaps
    const finalPositions = new Map<string, { x: number; y: number }>()
    
    // Calculate required spacing for each depth level with improved overlap prevention
    const calculateRequiredSpacing = (depth: number): number => {
      if (depth >= orderedNodesByDepth.size - 1) return horizontalSpacing
      
      const currentNodes = orderedNodesByDepth.get(depth) || []
      const childNodes = orderedNodesByDepth.get(depth + 1) || []
      
      if (currentNodes.length === 0) return horizontalSpacing
      
      // Group children by parent
      const childrenByParent = new Map<string, number>()
      childNodes.forEach(node => {
        const parentId = node.parentId || 'root'
        childrenByParent.set(parentId, (childrenByParent.get(parentId) || 0) + 1)
      })
      
      // Calculate the total width needed for all children of all parents
      let totalRequiredWidth = 0
      let maxIndividualChildWidth = 0
      
      currentNodes.forEach(parentNode => {
        const childCount = childrenByParent.get(parentNode.id) || 0
        if (childCount > 0) {
          const childWidth = (childCount - 1) * horizontalSpacing
          maxIndividualChildWidth = Math.max(maxIndividualChildWidth, childWidth)
          totalRequiredWidth += childWidth
        }
      })
      
      // For multiple parents, we need to ensure enough space between them
      // so that their children don't overlap
      if (currentNodes.length > 1) {
        // Calculate minimum spacing needed to prevent child overlaps
        const averageChildWidth = totalRequiredWidth / Math.max(1, currentNodes.filter(n => childrenByParent.get(n.id) || 0 > 0).length)
        const minSpacingForNoOverlap = Math.max(
          horizontalSpacing,
          maxIndividualChildWidth + horizontalSpacing, // Space for largest child group + buffer
          averageChildWidth + horizontalSpacing * 1.5  // Average child width + extra buffer
        )
        
        console.log(`Depth ${depth} spacing calculation:`, {
          maxIndividualChildWidth,
          averageChildWidth,
          minSpacingForNoOverlap,
          currentNodes: currentNodes.length
        })
        
        return minSpacingForNoOverlap
      }
      
      // Single parent case
      const requiredSpacing = Math.max(horizontalSpacing, maxIndividualChildWidth + horizontalSpacing * 0.5)
      return requiredSpacing
    }
    
    // Position nodes level by level with dynamic spacing for ALL levels
    for (let depth = 0; depth < orderedNodesByDepth.size; depth++) {
      const nodesAtDepth = orderedNodesByDepth.get(depth) || []
      
      if (depth === 0) {
        // Root nodes: calculate spacing based on their children
        const requiredSpacing = calculateRequiredSpacing(depth)
        const nodeCount = nodesAtDepth.length
        const totalWidth = (nodeCount - 1) * requiredSpacing
        const startX = -totalWidth / 2
        
        nodesAtDepth.forEach((node, index) => {
          const x = startX + (index * requiredSpacing)
          const y = depth * verticalSpacing
          finalPositions.set(node.id, { x, y })
        })
        
        console.log(`Depth ${depth}: Using spacing ${requiredSpacing} for ${nodeCount} nodes`)
      } else {
        // Child nodes: group by parent and calculate dynamic spacing for each parent's children
        const parentNodes = orderedNodesByDepth.get(depth - 1) || []
        
        // Group children by parent
        const childrenByParent = new Map<string, ChatNode[]>()
        nodesAtDepth.forEach(node => {
          const parentId = node.parentId || 'root'
          if (!childrenByParent.has(parentId)) {
            childrenByParent.set(parentId, [])
          }
          childrenByParent.get(parentId)!.push(node)
        })
        
        // Calculate required spacing for this depth level
        const requiredChildSpacing = calculateRequiredSpacing(depth)
        
        // Position children under each parent with overlap prevention
        const allChildPositions: { nodeId: string, x: number, parentId: string }[] = []
        
        parentNodes.forEach(parentNode => {
          const children = childrenByParent.get(parentNode.id) || []
          if (children.length === 0) return
          
          const parentPos = finalPositions.get(parentNode.id)!
          const childCount = children.length
          
          // Ensure proper spacing for children
          if (childCount === 1) {
            // Single child: place directly under parent
            const x = parentPos.x
            const y = depth * verticalSpacing
            allChildPositions.push({ nodeId: children[0].id, x, parentId: parentNode.id })
            finalPositions.set(children[0].id, { x, y })
          } else {
            // Multiple children: use dynamic spacing
            const childTotalWidth = (childCount - 1) * requiredChildSpacing
            const childStartX = parentPos.x - childTotalWidth / 2
            
            children.forEach((child, index) => {
              const x = childStartX + (index * requiredChildSpacing)
              const y = depth * verticalSpacing
              
              // Store position for overlap checking
              allChildPositions.push({ nodeId: child.id, x, parentId: parentNode.id })
              finalPositions.set(child.id, { x, y })
            })
          }
        })
        
        // Enhanced overlap resolution for all node pairs
        const resolveOverlaps = () => {
          let hasOverlap = true
          let iterations = 0
          const maxIterations = 15
          
          while (hasOverlap && iterations < maxIterations) {
            hasOverlap = false
            iterations++
            
            // Sort positions by x coordinate
            allChildPositions.sort((a, b) => a.x - b.x)
            
            for (let i = 0; i < allChildPositions.length - 1; i++) {
              const current = allChildPositions[i]
              const next = allChildPositions[i + 1]
              
              const distance = Math.abs(next.x - current.x)
              const minDistance = requiredChildSpacing
              
              // Check for overlaps (including same parent nodes)
              if (distance < minDistance) {
                let adjustment = minDistance - distance
                
                // For nodes with same parent, ensure they don't overlap
                if (current.parentId === next.parentId) {
                  // Same parent nodes should be spaced according to requiredChildSpacing
                  adjustment = minDistance - (next.x - current.x)
                  console.log(`Same parent overlap detected: ${current.nodeId.slice(-8)} and ${next.nodeId.slice(-8)}, distance: ${distance}`)
                } else {
                  // Different parent nodes need at least minDistance
                  console.log(`Different parent overlap detected: ${current.nodeId.slice(-8)} (parent: ${current.parentId.slice(-8)}) and ${next.nodeId.slice(-8)} (parent: ${next.parentId.slice(-8)}), distance: ${distance}`)
                }
                
                if (adjustment > 0) {
                  // Push next node to the right
                  next.x = current.x + minDistance
                  
                  // Update position in finalPositions
                  const currentPos = finalPositions.get(next.nodeId)!
                  finalPositions.set(next.nodeId, { x: next.x, y: currentPos.y })
                  
                  hasOverlap = true
                  
                  console.log(`Overlap resolved: moved node ${next.nodeId.slice(-8)} to x=${Math.round(next.x)} (adjustment: +${Math.round(adjustment)}px)`)
                }
              }
            }
          }
          
          if (iterations >= maxIterations) {
            console.warn(`Max iterations reached while resolving overlaps at depth ${depth}`)
          } else if (iterations > 1) {
            console.log(`Overlap resolution completed in ${iterations} iterations at depth ${depth}`)
          }
        }
        
        // Apply overlap resolution
        if (allChildPositions.length > 1) {
          resolveOverlaps()
          
          // Re-center children under their parents after overlap resolution
          const recenterChildrenUnderParents = () => {
            console.log(`Re-centering children under parents at depth ${depth}`)
            
            // Group final positions by parent
            const childrenByParentAfterResolve = new Map<string, Array<{nodeId: string, x: number}>>()
            allChildPositions.forEach(child => {
              if (!childrenByParentAfterResolve.has(child.parentId)) {
                childrenByParentAfterResolve.set(child.parentId, [])
              }
              childrenByParentAfterResolve.get(child.parentId)!.push({
                nodeId: child.nodeId,
                x: child.x
              })
            })
            
            // For each parent, try to center its children while maintaining minimum distances
            childrenByParentAfterResolve.forEach((children, parentId) => {
              if (children.length < 2) return // Single children are already centered
              
              const parentPos = finalPositions.get(parentId)
              if (!parentPos) return
              
              // Sort children by current x position
              children.sort((a, b) => a.x - b.x)
              
              // Calculate current center of children
              const leftmostX = children[0].x
              const rightmostX = children[children.length - 1].x
              const currentCenterX = (leftmostX + rightmostX) / 2
              
              // Calculate desired offset to center under parent
              const desiredOffset = parentPos.x - currentCenterX
              
              // Check if we can apply this offset without creating overlaps
              const canApplyOffset = (offset: number) => {
                const newPositions = children.map(child => ({ ...child, x: child.x + offset }))
                
                // Check against all other nodes at this depth
                for (const otherChild of allChildPositions) {
                  if (children.some(c => c.nodeId === otherChild.nodeId)) continue // Skip self
                  
                  for (const newPos of newPositions) {
                    const distance = Math.abs(newPos.x - otherChild.x)
                    if (distance < requiredChildSpacing) {
                      return false
                    }
                  }
                }
                return true
              }
              
              // Apply centering if possible
              if (Math.abs(desiredOffset) > 10 && canApplyOffset(desiredOffset)) { // Only if significant improvement
                console.log(`Re-centering children of parent ${parentId.slice(-8)}: offset ${Math.round(desiredOffset)}px`)
                
                children.forEach(child => {
                  const newX = child.x + desiredOffset
                  
                  // Update in allChildPositions
                  const childInArray = allChildPositions.find(c => c.nodeId === child.nodeId)
                  if (childInArray) {
                    childInArray.x = newX
                  }
                  
                  // Update in finalPositions
                  const currentPos = finalPositions.get(child.nodeId)!
                  finalPositions.set(child.nodeId, { x: newX, y: currentPos.y })
                })
              } else if (Math.abs(desiredOffset) > 10) {
                console.log(`Cannot re-center children of parent ${parentId.slice(-8)}: would cause overlaps (desired offset: ${Math.round(desiredOffset)}px)`)
              }
            })
          }
          
          // Apply re-centering
          recenterChildrenUnderParents()
        }
        
        console.log(`Depth ${depth}: Using child spacing ${requiredChildSpacing} for children`)
        
        // Handle orphaned nodes
        const orphanedNodes = nodesAtDepth.filter(node => {
          const parentId = node.parentId || 'root'
          return parentId !== 'root' && !parentNodes.find(p => p.id === parentId)
        })
        
        if (orphanedNodes.length > 0) {
          const lastParentNode = parentNodes[parentNodes.length - 1]
          const lastParentPos = lastParentNode ? finalPositions.get(lastParentNode.id)! : { x: 0, y: 0 }
          const orphanStartX = lastParentPos.x + requiredChildSpacing * 2
          
          orphanedNodes.forEach((node, index) => {
            const x = orphanStartX + (index * requiredChildSpacing)
            const y = depth * verticalSpacing
            finalPositions.set(node.id, { x, y })
          })
        }
      }
    }
    
    // Copy final positions to main nodePositions map
    finalPositions.forEach((pos, nodeId) => {
      nodePositions.set(nodeId, pos)
    })
    
    // Create React Flow nodes
    const flowNodes: Node[] = chatNodes.map(node => {
      const position = nodePositions.get(node.id) || { x: 0, y: 0 }
      
      return {
        id: node.id,
        type: 'message',
        position,
        data: {
          node,
          isCurrentNode: node.id === currentNodeId,
          onNodeClick,
          onBranchCreate,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      }
    })

    // Create edges with proper styling - ensuring all parent-child connections
    const flowEdges: Edge[] = chatNodes
      .filter(node => node.parentId && node.parentId !== null)
      .filter(node => nodeMap.has(node.parentId!)) // Only create edges for valid parent references
      .map(node => {
        const isPartOfCurrentPath = node.id === currentNodeId || 
          (!!currentNodeId && isAncestor(node.id, currentNodeId, nodeMap))
        
        return {
          id: `${node.parentId}-${node.id}`,
          source: node.parentId!,
          target: node.id,
          type: 'smoothstep',
          animated: isPartOfCurrentPath,
          style: {
            stroke: isPartOfCurrentPath ? '#3b82f6' : '#6b7280',
            strokeWidth: isPartOfCurrentPath ? 3 : 2,
          },
        }
      })

    // Debug: Log layout information with dynamic parent spacing
    console.log('=== Layout Debug Info (Dynamic Parent Spacing) ===')
    console.log('Created edges:', flowEdges.length, 'edges')
    console.log('Created nodes:', flowNodes.length, 'nodes')
    
    // Show the ordered sequence for each depth
    console.log('=== Parent-Grouped Node Order ===')
    orderedNodesByDepth.forEach((nodes, depth) => {
      console.log(`Depth ${depth} (${nodes.length} nodes):`)
      nodes.forEach((node, index) => {
        console.log(`  ${index}: ${node.id.slice(-8)} (parent: ${node.parentId?.slice(-8) || 'root'}) - "${node.prompt?.slice(0, 20)}..." - ${new Date(node.createdAt).toLocaleTimeString()}`)
      })
    })
    
    // Show parent grouping analysis for non-root levels
    if (orderedNodesByDepth.size > 1) {
      console.log('=== Parent Grouping Verification ===')
      orderedNodesByDepth.forEach((nodes, depth) => {
        if (depth > 0) {
          const groupsByParent = new Map<string, ChatNode[]>()
          nodes.forEach(node => {
            const parentId = node.parentId || 'root'
            if (!groupsByParent.has(parentId)) {
              groupsByParent.set(parentId, [])
            }
            groupsByParent.get(parentId)!.push(node)
          })
          
          console.log(`Depth ${depth} groups:`)
          groupsByParent.forEach((children, parentId) => {
            console.log(`  Parent ${parentId.slice(-8)}: [${children.map(c => c.id.slice(-8)).join(', ')}] (${children.length} children)`)
          })
        }
      })
    }
    
    // Log final node positions by depth with overlap detection
    const debugNodesByDepth = new Map<number, Array<{ id: string, x: number, prompt: string, parentId: string | null }>>()
    flowNodes.forEach(node => {
      const chatNode = chatNodes.find(cn => cn.id === node.id)
      const depth = chatNode?.depth || 0
      if (!debugNodesByDepth.has(depth)) {
        debugNodesByDepth.set(depth, [])
      }
      debugNodesByDepth.get(depth)!.push({
        id: node.id.substring(0, 8),
        x: Math.round(node.position.x),
        prompt: chatNode?.prompt?.substring(0, 20) + '...' || '',
        parentId: chatNode?.parentId?.substring(0, 8) || null
      })
    })
    
    console.log('=== DETAILED COORDINATE DEBUG DATA ===')
    
    // Create comprehensive coordinate data for analysis
    const coordinateDebugData = {
      totalNodes: chatNodes.length,
      totalDepths: orderedNodesByDepth.size,
      horizontalSpacing,
      verticalSpacing,
      nodesByDepth: {} as Record<number, any[]>,
      overlaps: [] as any[],
      spacingAnalysis: {} as Record<number, any>
    }
    
    debugNodesByDepth.forEach((nodes, depth) => {
      const sortedNodes = nodes.sort((a, b) => a.x - b.x)
      
      // Store detailed node data
      coordinateDebugData.nodesByDepth[depth] = sortedNodes.map(node => ({
        id: node.id,
        shortId: node.id.substring(0, 8),
        parentId: node.parentId,
        shortParentId: node.parentId?.substring(0, 8) || null,
        x: Math.round(node.x),
        y: Math.round(depth * verticalSpacing), // y is depth * verticalSpacing
        prompt: node.prompt?.substring(0, 30) + '...' || 'No prompt',
        depth: depth
      }))
      
      console.log(`\n=== DEPTH ${depth} COORDINATES ===`)
      console.log(`Total nodes: ${nodes.length}`)
      console.table(coordinateDebugData.nodesByDepth[depth])
      
      // Detailed overlap detection
      for (let i = 0; i < sortedNodes.length - 1; i++) {
        const current = sortedNodes[i]
        const next = sortedNodes[i + 1]
        const distance = next.x - current.x
        const minRequired = 450 // horizontalSpacing
        
        if (distance < minRequired) {
          const overlapData = {
            depth,
            node1: {
              id: current.id.substring(0, 8),
              x: Math.round(current.x),
              parentId: current.parentId?.substring(0, 8) || null,
              prompt: current.prompt?.substring(0, 20) + '...'
            },
            node2: {
              id: next.id.substring(0, 8), 
              x: Math.round(next.x),
              parentId: next.parentId?.substring(0, 8) || null,
              prompt: next.prompt?.substring(0, 20) + '...'
            },
            actualDistance: Math.round(distance),
            requiredDistance: minRequired,
            overlap: Math.round(minRequired - distance)
          }
          
          coordinateDebugData.overlaps.push(overlapData)
          console.error(`🚨 OVERLAP at Depth ${depth}:`, overlapData)
        }
      }
      
      // Show spacing analysis for parent levels
      if (depth < orderedNodesByDepth.size - 1) {
        const childNodes = orderedNodesByDepth.get(depth + 1) || []
        const childrenByParent = new Map<string, number>()
        childNodes.forEach(node => {
          const parentId = node.parentId || 'root'
          childrenByParent.set(parentId, (childrenByParent.get(parentId) || 0) + 1)
        })
        
        const spacingData: any[] = []
        console.log(`\n=== SPACING ANALYSIS (Depth ${depth} -> ${depth + 1}) ===`)
        
        sortedNodes.forEach((node, index) => {
          const childCount = childrenByParent.get(node.id.substring(0, 8)) || 0
          const requiredChildWidth = childCount > 0 ? (childCount - 1) * horizontalSpacing : 0
          const nextNode = sortedNodes[index + 1]
          const actualSpacing = nextNode ? nextNode.x - node.x : 0
          const sufficient = !nextNode || actualSpacing >= requiredChildWidth + horizontalSpacing * 0.5
          
          const nodeSpacingData = {
            nodeId: node.id.substring(0, 8),
            position: Math.round(node.x),
            childCount,
            requiredChildWidth,
            actualSpacing: Math.round(actualSpacing),
            sufficient,
            deficit: sufficient ? 0 : Math.round((requiredChildWidth + horizontalSpacing * 0.5) - actualSpacing)
          }
          
          spacingData.push(nodeSpacingData)
          
          if (!sufficient) {
            console.warn(`⚠️  INSUFFICIENT SPACING:`, nodeSpacingData)
          }
        })
        
        coordinateDebugData.spacingAnalysis[depth] = spacingData
        console.table(spacingData)
      }
    })
    
    // Summary report
    console.log('\n=== OVERLAP SUMMARY ===')
    if (coordinateDebugData.overlaps.length > 0) {
      console.error(`🚨 ${coordinateDebugData.overlaps.length} overlaps detected!`)
      console.table(coordinateDebugData.overlaps)
      
      // Group overlaps by depth
      const overlapsByDepth = coordinateDebugData.overlaps.reduce((acc, overlap) => {
        acc[overlap.depth] = (acc[overlap.depth] || 0) + 1
        return acc
      }, {} as Record<number, number>)
      
      console.log('Overlaps by depth:', overlapsByDepth)
    } else {
      console.log('✅ No overlaps detected')
    }
    
    // Make debug data available globally for easy copying
    ;(window as any).treeDebugData = coordinateDebugData
    console.log('\n📋 Complete debug data available at: window.treeDebugData')
    console.log('💡 Copy with: copy(JSON.stringify(window.treeDebugData, null, 2))')
    
    // Validate that all edge sources and targets exist
    const nodeIds = new Set(flowNodes.map(n => n.id))
    const invalidEdges = flowEdges.filter(e => !nodeIds.has(e.source) || !nodeIds.has(e.target))
    if (invalidEdges.length > 0) {
      console.warn('Invalid edges detected:', invalidEdges)
    }
    console.log('=== End Layout Debug ===')
    
    
    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [chatNodes, currentNodeId, onNodeClick, onBranchCreate, setNodes, setEdges])

  // Helper function to check if a node is an ancestor of another
  const isAncestor = (
    nodeId: string, 
    targetId: string, 
    nodeMap: Map<string, ChatNode>
  ): boolean => {
    let current = nodeMap.get(targetId)
    while (current && current.parentId) {
      if (current.parentId === nodeId) return true
      current = nodeMap.get(current.parentId)
    }
    return false
  }

  const onNodeClickHandler = useCallback((_event: React.MouseEvent, node: Node) => {
    if (onNodeClick) {
      onNodeClick(node.id)
    }
  }, [onNodeClick])

  // Render balanced layout if enabled
  if (useBalancedLayout) {
    return (
      <BalancedTreeView
        nodes={chatNodes}
        currentNodeId={currentNodeId}
        onNodeClick={onNodeClick}
        onBranchCreate={onBranchCreate}
      />
    )
  }

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        edgesFocusable={false}
        edgesUpdatable={false}
        fitView
        fitViewOptions={{ padding: 0.3, minZoom: 0.5, maxZoom: 1.5 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: '#6b7280',
            strokeWidth: 2,
          },
        }}
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => 
            node.data?.isCurrentNode ? '#3b82f6' : '#cbd5e1'
          }
          nodeStrokeWidth={3}
          pannable
          zoomable
        />
        
        {/* Layout Toggle Panel */}
        <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 border">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Layout Engine</div>
            <div className="flex flex-col space-y-1">
              <button
                onClick={() => setUseBalancedLayout(false)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  !useBalancedLayout
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Legacy
              </button>
              <button
                onClick={() => setUseBalancedLayout(true)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  useBalancedLayout
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Balanced ✨
              </button>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}