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
import './mobile-optimizations.css'
import { ChatNode } from '@/types'
import { MessageNode } from './message-node'
import { CompactTreeLayout, TreeNode } from './CompactTreeLayout'
import { log } from '@/lib/utils/logger'

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
  const prevSessionIdRef = useRef<string | null>(null)
  const isReactFlowInitialized = useRef(false)

  // Initialize layout engine
  const layoutEngine = useMemo(() => {
    return new CompactTreeLayout(COMPACT_LAYOUT_CONFIG)
  }, [])
  
  // Store positions for centering when clicking nodes
  const positionsRef = useRef<Map<string, { x: number, y: number }>>(new Map())

  // Calculate centering settings based on device type and layout state
  // Note: Using a function instead of useCallback to avoid unnecessary re-renders
  // This function is called on-demand rather than being recreated on dependency changes
  const calculateCenteringSettings = (overrideRightSidebarWidth?: number) => {
    const screenWidth = window.innerWidth
    const isMobile = screenWidth < 768 // md breakpoint
    const isTablet = screenWidth >= 768 && screenWidth < 1024 // lg breakpoint

    if (isMobile || isTablet) {
      // Mobile/Tablet: Fixed settings for consistent centering
      return {
        xOffset: 180,     // Consistent with current working values
        yOffset: 300,     // Consistent with current working values
        zoom: 0.8,       // Standard zoom for mobile/tablet
        minZoom: 0.65,    // Minimum zoom level
        duration: 800,    // Animation duration
        device: 'mobile'  // Device type identifier
      }
    } else {
      // Desktop: Dynamic calculation based on sidebar states
      const leftSidebarWidth = isLeftSidebarCollapsed ? 94 : 410
      const actualRightSidebarWidth = overrideRightSidebarWidth !== undefined ? overrideRightSidebarWidth : rightSidebarWidth
      const rightSidebarWidth_actual = isRightSidebarOpen ? (actualRightSidebarWidth + 30) : 0
      
      // Calculate the center of the available content area
      const availableWidth = screenWidth - leftSidebarWidth - rightSidebarWidth_actual
      const contentAreaCenterX = leftSidebarWidth + (availableWidth / 2)
      const screenCenterX = screenWidth / 2
      const pixelOffsetNeeded = contentAreaCenterX - screenCenterX
      const reactFlowOffsetX = pixelOffsetNeeded * -1
      
      return {
        xOffset: 140 + reactFlowOffsetX,  // Dynamic offset for desktop
        yOffset: 250,                     // Desktop Y offset
        zoom: 0.8,                        // Desktop zoom
        minZoom: 0.8,                     // Desktop minimum zoom
        duration: 800,                    // Animation duration
        device: 'desktop',                // Device type identifier
        // Debug info for desktop
        debugInfo: {
          screenWidth,
          leftSidebarWidth,
          rightSidebarWidth_actual,
          availableWidth,
          contentAreaCenterX,
          screenCenterX,
          pixelOffsetNeeded,
          reactFlowOffsetX
        }
      }
    }
  }

  // Convert ChatNodes to TreeNodes
  const convertToTreeNodes = useCallback((chatNodes: ChatNode[]): TreeNode[] => {
    return chatNodes.map(node => ({
      id: node.id,
      parentId: node.parentId,
      depth: node.depth,
      children: [], // Will be populated by layout engine
    }))
  }, [])
  
  // Node click handler (without centering)
  const handleNodeClick = useCallback((nodeId: string) => {
    // Call original handler only - no centering on click
    onNodeClick?.(nodeId)
    log.debug('Node clicked', { nodeId })
  }, [onNodeClick])

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

      // Detect session change by checking if the first node's session ID changed
      const currentSessionId = chatNodes[0]?.sessionId || null
      const isSessionChanged = currentSessionId && currentSessionId !== prevSessionIdRef.current
      
      // Also check if this is the first render with nodes (initial load)
      const isInitialLoad = prevSessionIdRef.current === null && currentSessionId !== null
      
      // Check if this is a new session or initial load
      if (isSessionChanged || isInitialLoad) {
        // New session opened or initial load - center on the first/root node
        log.info(isInitialLoad ? 'Initial session load' : 'Session changed', { 
          sessionId: currentSessionId,
          isInitialLoad 
        })
        const rootNode = chatNodes.find(n => n.parentId === null) || chatNodes[0]
        
        if (rootNode && positions.has(rootNode.id)) {
          const position = positions.get(rootNode.id)!
          
          // Function to perform centering
          const performCentering = () => {
            // Get centering settings from centralized function
            const settings = calculateCenteringSettings()
            
            setCenter(
              position.x + settings.xOffset,
              position.y + settings.yOffset,
              { 
                zoom: settings.zoom,
                duration: isInitialLoad ? 0 : settings.duration // No animation on initial load
              }
            )
            
            // Log centering action
            log.debug('Centered root node', {
              nodeId: rootNode.id,
              device: settings.device,
              offset: { x: settings.xOffset, y: settings.yOffset },
              zoom: settings.zoom,
              isInitialLoad
            })
          }
          
          if (isInitialLoad) {
            // For initial load, wait for React Flow to be initialized
            const checkAndCenter = () => {
              if (isReactFlowInitialized.current) {
                performCentering()
              } else {
                setTimeout(checkAndCenter, 100)
              }
            }
            setTimeout(checkAndCenter, 100)
          } else {
            // For session changes, center immediately
            setTimeout(performCentering, 100)
          }
        }
        
        // Update session ID reference
        prevSessionIdRef.current = currentSessionId
      } else if (chatNodes.length > prevNodeCountRef.current || 
          (currentNodeId && chatNodes.find(n => n.id === currentNodeId && n.status === 'streaming'))) {
        // New node was added (not a new session) - center on streaming/newest node
        const nodeToCenter = chatNodes.find(n => n.status === 'streaming') || 
                            (currentNodeId ? chatNodes.find(n => n.id === currentNodeId) : null) ||
                            chatNodes[chatNodes.length - 1]
        
        if (nodeToCenter && positions.has(nodeToCenter.id)) {
          const position = positions.get(nodeToCenter.id)!
          setTimeout(() => {
            const currentZoom = getZoom()
            
            // Get centering settings from centralized function
            const settings = calculateCenteringSettings()
            
            // Use current zoom if it's higher than minimum, otherwise use settings zoom
            const finalZoom = currentZoom > settings.minZoom ? currentZoom : settings.zoom
            
            setCenter(
              position.x + settings.xOffset,
              position.y + settings.yOffset,
              { 
                zoom: finalZoom,
                duration: settings.duration
              }
            )
            
            // Logging based on device type
            // Log centering on new node
            log.debug('Centered on new node', {
              nodeId: nodeToCenter.id,
              device: settings.device,
              offset: { x: settings.xOffset, y: settings.yOffset },
              zoom: finalZoom
            })
          }, 100)
        }
      }
      
      // Update the previous node count
      prevNodeCountRef.current = chatNodes.length

    } catch (error) {
      log.error('Error in BalancedTreeView layout calculation', error)
      setNodes([])
      setEdges([])
    }
  }, [chatNodes, currentNodeId, layoutEngine, convertToTreeNodes, handleNodeClick, setCenter, getZoom, isLeftSidebarCollapsed, isRightSidebarOpen])

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

  // Handle sidebar width changes without re-rendering nodes
  // This effect only adjusts the view position when right sidebar width changes
  useEffect(() => {
    // Skip if we don't have positions or nodes
    if (!positionsRef.current || positionsRef.current.size === 0) return
    
    // Skip initial render and only respond to actual width changes
    if (rightSidebarWidth === 400) return // Default width, skip
    
    // If we have a current node, re-center on it with new width
    if (currentNodeId && positionsRef.current.has(currentNodeId)) {
      const position = positionsRef.current.get(currentNodeId)!
      const currentZoom = getZoom()
      
      // ===== 右サイドバー専用の調整設定 =====
      // ここで独立した微調整が可能です
      const screenWidth = window.innerWidth
      const isMobile = screenWidth < 768
      
      if (isMobile) {
        // モバイルでは調整不要
        return
      }
      
      // デスクトップ用の専用計算
      const leftSidebarWidth = isLeftSidebarCollapsed ? 94 : 410
      const rightSidebarWidth_actual = isRightSidebarOpen ? (rightSidebarWidth + 30) : 0
      
      // 利用可能な表示領域
      const availableWidth = screenWidth - leftSidebarWidth - rightSidebarWidth_actual
      const contentAreaCenterX = leftSidebarWidth + (availableWidth / 2)
      const screenCenterX = screenWidth / 2
      const pixelOffsetNeeded = contentAreaCenterX - screenCenterX
      
      // ===== カスタム調整パラメータ =====
      // これらの値を変更して微調整できます
      const customXAdjustment = 95  // X軸の追加調整値（正の値で右へ、負の値で左へ）
      const customYAdjustment = 0  // Y軸の追加調整値（正の値で下へ、負の値で上へ）
      const customDuration = 200   // アニメーション時間（ミリ秒）
      const maintainZoom = true    // ズームレベルを維持するか
      
      // 最終的なオフセット計算
      const xOffset = 140 + (-pixelOffsetNeeded) + customXAdjustment
      const yOffset = 250 + customYAdjustment
      
      // Smoothly adjust view position without re-rendering nodes
      setCenter(
        position.x + xOffset,
        position.y + yOffset,
        { 
          zoom: maintainZoom ? currentZoom : 0.8, // ズーム制御
          duration: customDuration
        }
      )
      
      log.debug('Adjusted view for sidebar width change (custom)', {
        rightSidebarWidth,
        nodeId: currentNodeId,
        offset: { x: xOffset, y: yOffset },
        customAdjustments: { x: customXAdjustment, y: customYAdjustment }
      })
    }
  }, [rightSidebarWidth, currentNodeId, getZoom, setCenter, isLeftSidebarCollapsed, isRightSidebarOpen]) // Only react to sidebar width changes

  const fitViewOptions = useMemo(() => ({
    padding: 0.2,
    includeHiddenNodes: false,
    minZoom: 0.1,
    maxZoom: 1.5,
  }), [])

  // Optimize for mobile devices
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  
  // Mobile-specific performance settings
  const mobileOptimizations = useMemo(() => {
    if (!isMobile) return {}
    return {
      elevateNodesOnSelect: false,
      nodesDraggable: false, // Disable dragging on mobile
      nodesConnectable: false,
      elementsSelectable: true,
      panOnDrag: [1], // Only allow panning with single finger
      selectNodesOnDrag: false,
      zoomOnPinch: true,
      panOnScroll: false,
      zoomOnScroll: false,
      zoomOnDoubleClick: false,
    }
  }, [isMobile])

  // Handle React Flow initialization
  const handleInit = useCallback(() => {
    isReactFlowInitialized.current = true
    log.debug('React Flow initialized')
    
    // If we have nodes on initialization, center on the root node
    // This handles the initial load case (root -> session)
    if (chatNodes && chatNodes.length > 0 && positionsRef.current.size > 0) {
      const rootNode = chatNodes.find(n => n.parentId === null) || chatNodes[0]
      const position = positionsRef.current.get(rootNode.id)
      
      if (position) {
        const settings = calculateCenteringSettings()
        
        // Use the exact same setCenter logic as session -> session
        setCenter(
          position.x + settings.xOffset,
          position.y + settings.yOffset,
          { 
            zoom: settings.zoom,
            duration: 0  // No animation on initial load
          }
        )
        
        log.debug('Initial centering on React Flow init', {
          nodeId: rootNode.id,
          position,
          settings
        })
      }
    }
  }, [chatNodes, calculateCenteringSettings, setCenter])

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView={false}
        fitViewOptions={fitViewOptions}
        attributionPosition="bottom-left"
        className="bg-transparent"
        minZoom={isMobile ? 0.5 : 0.1}
        maxZoom={isMobile ? 1.5 : 2}
        // Set a reasonable default to avoid the jump from top-left
        defaultViewport={{ 
          x: 900,  // Approximate center position
          y: 250,  // Approximate center position
          zoom: 0.8 
        }}
        onPaneClick={onBackgroundClick}
        onInit={handleInit}
        {...mobileOptimizations}
      >
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
