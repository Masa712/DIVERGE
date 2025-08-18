'use client'

import { useCallback, useEffect, useMemo } from 'react'
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
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ChatNode } from '@/types'
import { MessageNode } from './message-node'

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
    
    // Position nodes: center-aligned at each depth level
    const adjustedPositions = new Map<string, { x: number; y: number }>()
    
    // Calculate center-aligned positions for each depth
    orderedNodesByDepth.forEach((nodes, depth) => {
      const nodeCount = nodes.length
      const totalWidth = (nodeCount - 1) * horizontalSpacing
      const startX = -totalWidth / 2  // Center the entire row
      
      nodes.forEach((node, index) => {
        const x = startX + (index * horizontalSpacing)
        const y = depth * verticalSpacing
        adjustedPositions.set(node.id, { x, y })
      })
    })
    
    // Copy center-aligned positions to main nodePositions map
    adjustedPositions.forEach((pos, nodeId) => {
      nodePositions.set(nodeId, pos)
    })
    
    // Use center-aligned positions directly (no additional adjustments needed)
    
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

    // Debug: Log layout information with parent grouping and center alignment
    console.log('=== Layout Debug Info (Parent-Grouped & Center-Aligned) ===')
    console.log('Created edges:', flowEdges.length, 'edges')
    console.log('Created nodes:', flowNodes.length, 'nodes')
    
    // Show the ordered sequence for each depth
    console.log('=== Parent-Grouped Node Order ===')
    orderedNodesByDepth.forEach((nodes, depth) => {
      console.log(`Depth ${depth} (${nodes.length} nodes):`)
      nodes.forEach((node, index) => {
        console.log(`  ${index}: ${node.id.slice(-8)} (parent: ${node.parentId?.slice(-8) || 'root'}) - "${node.userPrompt?.slice(0, 20)}..." - ${new Date(node.createdAt).toLocaleTimeString()}`)
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
        prompt: chatNode?.userPrompt?.substring(0, 20) + '...' || '',
        parentId: chatNode?.parentId?.substring(0, 8) || null
      })
    })
    
    console.log('=== Final Positions (Center-Aligned) ===')
    debugNodesByDepth.forEach((nodes, depth) => {
      const sortedNodes = nodes.sort((a, b) => a.x - b.x)
      const nodeCount = nodes.length
      const totalWidth = (nodeCount - 1) * horizontalSpacing
      const expectedCenterX = 0  // Should be centered at 0
      const actualCenterX = nodeCount > 1 
        ? (sortedNodes[0].x + sortedNodes[sortedNodes.length - 1].x) / 2
        : sortedNodes[0]?.x || 0
      
      console.log(`Depth ${depth} (${nodeCount} nodes):`, {
        nodes: sortedNodes,
        totalWidth,
        expectedCenter: expectedCenterX,
        actualCenter: Math.round(actualCenterX),
        isCentered: Math.abs(actualCenterX - expectedCenterX) < 1
      })
      
      // Check for overlaps at this depth
      for (let i = 0; i < sortedNodes.length - 1; i++) {
        const current = sortedNodes[i]
        const next = sortedNodes[i + 1]
        const distance = next.x - current.x
        if (distance < 400) { // Less than minimum spacing
          console.warn(`⚠️  OVERLAP DETECTED at depth ${depth}:`, {
            node1: current,
            node2: next,
            distance: distance,
            minRequired: 450
          })
        }
      }
    })
    
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

  return (
    <div className="h-full w-full">
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
      </ReactFlow>
    </div>
  )
}