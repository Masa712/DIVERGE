'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Position,
  ConnectionLineType,
  useNodesState,
  useEdgesState,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { ChatNode } from '@/types'
import { MessageNode } from './message-node'
import { CompactTreeLayout, TreeNode } from './CompactTreeLayout'
import { GradientBackground } from './GradientBackground'

interface Props {
  nodes: ChatNode[]
  currentNodeId?: string
  onNodeClick?: (nodeId: string) => void
  onNodeIdClick?: (nodeReference: string) => void
  onBackgroundClick?: () => void
  isLeftSidebarCollapsed?: boolean
  isRightSidebarOpen?: boolean
  rightSidebarWidth?: number
}

const nodeTypes = {
  message: MessageNode,
}

const COMPACT_LAYOUT_CONFIG = {
  horizontalSpacing: 250,
  verticalSpacing: 350,
  nodeWidth: 280,
  minSubtreeSpacing: 150,
}

// Inner component that uses ReactFlow hooks
function CompactTreeViewInner({ 
  nodes: chatNodes, 
  currentNodeId, 
  onNodeClick, 
  onNodeIdClick,
  onBackgroundClick,
  isLeftSidebarCollapsed = false,
  isRightSidebarOpen = false,
  rightSidebarWidth = 400
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const { fitView, setCenter, getZoom } = useReactFlow()
  const prevNodeCountRef = useRef(0)

  // Initialize layout engine
  const layoutEngine = useMemo(() => {
    return new CompactTreeLayout(COMPACT_LAYOUT_CONFIG)
  }, [])
  
  // Store positions for centering when clicking nodes
  const positionsRef = useRef<Map<string, { x: number, y: number }>>(new Map())

  // Calculate dynamic centering offset based on layout state
  const calculateCenteringOffset = useCallback(() => {
    const screenWidth = window.innerWidth
    const isMobile = screenWidth < 768 // md breakpoint
    const isTablet = screenWidth >= 768 && screenWidth < 1024 // lg breakpoint
    
    let xOffset = 140 // Half of node width (280/2)
    let yOffset = 50  // Base vertical offset

    if (isMobile || isTablet) {
      // Mobile/Tablet: Simpler centering approach
      // For mobile/tablet, we want to center more precisely
      // Reduce the base offset since mobile doesn't have sidebar complications
      xOffset = 140 // Base node half-width
      
      // Apply smaller adjustment for mobile to prevent over-shifting
      const mobileAdjustment = isMobile ? 50 : 75 // Less aggressive adjustment for mobile
      xOffset += mobileAdjustment
      yOffset += 200 // User requested 200px up adjustment
      
      console.log(`📱 Mobile/Tablet centering: screenWidth=${screenWidth}, xOffset=${xOffset}, yOffset=${yOffset}`)
    } else {
      // Desktop: Calculate the actual available content area
      const leftSidebarWidth = isLeftSidebarCollapsed ? 64 : 256
      const rightSidebarWidth_actual = isRightSidebarOpen ? rightSidebarWidth : 0
      
      // Calculate the center of the available content area
      const availableWidth = screenWidth - leftSidebarWidth - rightSidebarWidth_actual
      const contentAreaCenterX = leftSidebarWidth + (availableWidth / 2)
      
      // Calculate how much to shift from screen center to content area center
      const screenCenterX = screenWidth / 2
      let centerAdjustment = contentAreaCenterX - screenCenterX
      
      // Special adjustment for collapsed left sidebar to compensate for left shift
      if (isLeftSidebarCollapsed) {
        centerAdjustment += 320 // Add rightward shift when left sidebar is collapsed to center properly
      }
      
      // Apply the adjustment
      xOffset = 140 + centerAdjustment // 140 = half node width
      
      // Apply user's preferred offset adjustments for desktop
      xOffset += 100 // User requested 100px left adjustment
      yOffset += 200 // User requested 200px up adjustment
      
      console.log(`🖥️ Desktop centering: screenWidth=${screenWidth}, leftSidebarWidth=${leftSidebarWidth}, rightSidebarWidth=${rightSidebarWidth_actual}, availableWidth=${availableWidth}, contentAreaCenterX=${contentAreaCenterX}, centerAdjustment=${centerAdjustment}, isCollapsed=${isLeftSidebarCollapsed}, finalXOffset=${xOffset}`)
    }

    return { x: xOffset, y: yOffset }
  }, [isLeftSidebarCollapsed, isRightSidebarOpen, rightSidebarWidth])

  // Convert ChatNodes to TreeNodes
  const convertToTreeNodes = useCallback((chatNodes: ChatNode[]): TreeNode[] => {
    return chatNodes.map(node => ({
      id: node.id,
      parentId: node.parentId,
      depth: node.depth,
      children: [], // Will be populated by layout engine
    }))
  }, [])
  
  // Enhanced node click handler that also centers the clicked node
  const handleNodeClick = useCallback((nodeId: string) => {
    // Call original handler
    onNodeClick?.(nodeId)
    
    // Center on clicked node
    const position = positionsRef.current.get(nodeId)
    if (position) {
      const currentZoom = getZoom()
      const offset = calculateCenteringOffset()
      setCenter(
        position.x + offset.x,
        position.y + offset.y,
        { 
          zoom: currentZoom,
          duration: 500 
        }
      )
      console.log(`🎯 Centered on clicked node: ${nodeId}`)
    }
  }, [onNodeClick, setCenter, getZoom, calculateCenteringOffset])

  // Convert chat nodes to React Flow nodes and edges with balanced layout
  useEffect(() => {
    if (!chatNodes || chatNodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

//     console.log(`🌳 CompactTreeView: Processing ${chatNodes.length} nodes`)

    try {
      // Convert to tree nodes
      const treeNodes = convertToTreeNodes(chatNodes)
      
      // Calculate positions using compact layout
      const positions = layoutEngine.calculateLayout(treeNodes)
      
      // Store positions for later use
      positionsRef.current = positions

//       console.log(`📍 Calculated positions for ${positions.size} nodes`)

      // Create React Flow nodes
      const reactFlowNodes: Node[] = []
      const nodeMap = new Map<string, ChatNode>()
      
      chatNodes.forEach(node => nodeMap.set(node.id, node))

      positions.forEach((position, nodeId) => {
        const chatNode = nodeMap.get(nodeId)
        if (!chatNode) return

        const isCurrentNode = nodeId === currentNodeId
        const subtreeWidth = layoutEngine.getSubtreeWidth(nodeId)

        reactFlowNodes.push({
          id: nodeId,
          type: 'message',
          position: { x: position.x, y: position.y },
          data: {
            node: chatNode,
            isCurrentNode,
            subtreeWidth,
            onNodeClick: handleNodeClick,
          },
          draggable: false,
          selectable: true,
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        })
      })

      // Create edges
      const reactFlowEdges: Edge[] = []
      chatNodes.forEach(node => {
        if (node.parentId) {
          const parentPos = positions.get(node.parentId)
          const childPos = positions.get(node.id)
          
          if (parentPos && childPos) {
            reactFlowEdges.push({
              id: `${node.parentId}-${node.id}`,
              source: node.parentId,
              target: node.id,
              type: 'smoothstep',
              animated: false,
              style: { 
                stroke: isCurrentPath(node.id, currentNodeId, chatNodes) ? '#3b82f6' : '#e5e7eb',
                strokeWidth: isCurrentPath(node.id, currentNodeId, chatNodes) ? 3 : 2,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: isCurrentPath(node.id, currentNodeId, chatNodes) ? '#3b82f6' : '#e5e7eb',
              },
            })
          }
        }
      })

      setNodes(reactFlowNodes)
      setEdges(reactFlowEdges)

      // Check if a new node was added (node count increased) or if current node is streaming
      if (chatNodes.length > prevNodeCountRef.current || 
          (currentNodeId && chatNodes.find(n => n.id === currentNodeId && n.status === 'streaming'))) {
        // Find the node to center (prioritize streaming nodes, then current node, then newest)
        const nodeToCenter = chatNodes.find(n => n.status === 'streaming') || 
                            (currentNodeId ? chatNodes.find(n => n.id === currentNodeId) : null) ||
                            chatNodes[chatNodes.length - 1]
        
        if (nodeToCenter && positions.has(nodeToCenter.id)) {
          const position = positions.get(nodeToCenter.id)!
          // Center the node with a slight delay to ensure ReactFlow has processed the nodes
          setTimeout(() => {
            const currentZoom = getZoom()
            const offset = calculateCenteringOffset()
            setCenter(
              position.x + offset.x,
              position.y + offset.y,
              { 
                zoom: currentZoom > 0.8 ? currentZoom : 0.8,
                duration: 800 
              }
            )
            console.log(`🎯 Centered on node: ${nodeToCenter.id} (status: ${nodeToCenter.status})`)
          }, 100)
        }
      }
      
      // Update the previous node count
      prevNodeCountRef.current = chatNodes.length

    } catch (error) {
      console.error('❌ Error in BalancedTreeView layout calculation:', error)
      setNodes([])
      setEdges([])
    }
  }, [chatNodes, currentNodeId, layoutEngine, convertToTreeNodes, handleNodeClick, onNodeIdClick, setCenter, getZoom, calculateCenteringOffset])

  // Check if a node is in the current path
  const isCurrentPath = useCallback((nodeId: string, currentNodeId: string | undefined, nodes: ChatNode[]): boolean => {
    if (!currentNodeId) return false
    
    const nodeMap = new Map<string, ChatNode>()
    nodes.forEach(node => nodeMap.set(node.id, node))
    
    // Build path from current node to root
    const currentPath = new Set<string>()
    let current: ChatNode | undefined = nodeMap.get(currentNodeId)
    
    while (current) {
      currentPath.add(current.id)
      current = current.parentId ? nodeMap.get(current.parentId) : undefined
    }
    
    return currentPath.has(nodeId)
  }, [])



  const fitViewOptions = useMemo(() => ({
    padding: 0.2,
    includeHiddenNodes: false,
    minZoom: 0.1,
    maxZoom: 1.5,
  }), [])

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={fitViewOptions}
        attributionPosition="bottom-left"
        className="bg-transparent"
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        onPaneClick={onBackgroundClick}
      >
        <GradientBackground gap={20} size={1} opacity={0.3} />
      </ReactFlow>
    </div>
  )
}

// Test data generator for development
export function generateCompactTestData(): ChatNode[] {
  const nodes: ChatNode[] = []
  
  // Root node
  nodes.push({
    id: 'root-1',
    parentId: null,
    sessionId: 'test-session',
    model: 'openai/gpt-4o-2024-11-20' as any,
    systemPrompt: null,
    prompt: 'ホテル経営について教えてください',
    response: 'ホテル経営の基本について説明します...',
    status: 'completed',
    errorMessage: null,
    depth: 0,
    promptTokens: 50,
    responseTokens: 100,
    costUsd: 0.01,
    temperature: null,
    maxTokens: null,
    topP: null,
    metadata: {},
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
  })
  
  // Child A with 5 grandchildren (unbalanced)
  nodes.push({
    id: 'child-a',
    parentId: 'root-1',
    sessionId: 'test-session',
    model: 'openai/gpt-4o-2024-11-20' as any,
    systemPrompt: null,
    prompt: '顧客サービスについて詳しく',
    response: '顧客サービスの詳細について...',
    status: 'completed',
    errorMessage: null,
    depth: 1,
    promptTokens: 40,
    responseTokens: 80,
    costUsd: 0.008,
    temperature: null,
    maxTokens: null,
    topP: null,
    metadata: {},
    createdAt: new Date('2024-01-01T10:01:00Z'),
    updatedAt: new Date('2024-01-01T10:01:00Z'),
  })
  
  // Child B with 1 grandchild
  nodes.push({
    id: 'child-b',
    parentId: 'root-1',
    sessionId: 'test-session',
    model: 'anthropic/claude-sonnet-4' as any,
    systemPrompt: null,
    prompt: '運営効率について',
    response: '運営効率の改善方法...',
    status: 'completed',
    errorMessage: null,
    depth: 1,
    promptTokens: 35,
    responseTokens: 70,
    costUsd: 0.007,
    temperature: null,
    maxTokens: null,
    topP: null,
    metadata: {},
    createdAt: new Date('2024-01-01T10:02:00Z'),
    updatedAt: new Date('2024-01-01T10:02:00Z'),
  })
  
  // Child C with no grandchildren
  nodes.push({
    id: 'child-c',
    parentId: 'root-1',
    sessionId: 'test-session',
    model: 'google/gemini-2.5-flash',
    systemPrompt: null,
    prompt: '財務管理について',
    response: '財務管理のポイント...',
    status: 'completed',
    errorMessage: null,
    depth: 1,
    promptTokens: 30,
    responseTokens: 60,
    costUsd: 0.005,
    temperature: null,
    maxTokens: null,
    topP: null,
    metadata: {},
    createdAt: new Date('2024-01-01T10:03:00Z'),
    updatedAt: new Date('2024-01-01T10:03:00Z'),
  })
  
  // 5 grandchildren under Child A
  for (let i = 1; i <= 5; i++) {
    nodes.push({
      id: `grandchild-a-${i}`,
      parentId: 'child-a',
      sessionId: 'test-session',
      model: 'openai/gpt-4o-2024-11-20' as any,
      systemPrompt: null,
      prompt: `顧客サービスの詳細 ${i}`,
      response: `詳細な回答 ${i}...`,
      status: 'completed',
      errorMessage: null,
      depth: 2,
      promptTokens: 25,
      responseTokens: 50,
      costUsd: 0.004,
      temperature: null,
      maxTokens: null,
      topP: null,
      metadata: {},
      createdAt: new Date(`2024-01-01T10:0${3 + i}:00Z`),
      updatedAt: new Date(`2024-01-01T10:0${3 + i}:00Z`),
    })
  }
  
  // 1 grandchild under Child B
  nodes.push({
    id: 'grandchild-b-1',
    parentId: 'child-b',
    sessionId: 'test-session',
    model: 'anthropic/claude-sonnet-4' as any,
    systemPrompt: null,
    prompt: '運営効率の具体例',
    response: '具体的な効率化手法...',
    status: 'completed',
    errorMessage: null,
    depth: 2,
    promptTokens: 30,
    responseTokens: 60,
    costUsd: 0.006,
    temperature: null,
    maxTokens: null,
    topP: null,
    metadata: {},
    createdAt: new Date('2024-01-01T10:09:00Z'),
    updatedAt: new Date('2024-01-01T10:09:00Z'),
  })
  
  return nodes
}

// Wrapper component with ReactFlowProvider
export function CompactTreeView(props: Props) {
  return (
    <ReactFlowProvider>
      <CompactTreeViewInner {...props} />
    </ReactFlowProvider>
  )
}
