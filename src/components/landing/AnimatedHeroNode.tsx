'use client'

import { useEffect, useRef, useState } from 'react'
import { PaperAirplaneIcon, PlusIcon, MagnifyingGlassIcon, BoltIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { User, Bot, Settings, Copy, GitBranch, Layers, Sparkles } from 'lucide-react'

type FeatureNode = {
  title: string
  description: string
  icon: typeof GitBranch
  accent: string
  details: string[]
}

export function AnimatedHeroNode() {
  const heroRef = useRef<HTMLDivElement | null>(null)
  const [isAnimated, setIsAnimated] = useState(false)
  const [showText, setShowText] = useState(false)
  const [viewportSize, setViewportSize] = useState({ width: 1024, height: 768 })
  const [heroProgress, setHeroProgress] = useState(0)
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)
  const [typewriterProgress, setTypewriterProgress] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    // Start z-axis animation after component mounts
    const animationTimer = setTimeout(() => {
      setIsAnimated(true)
    }, 100)

    // Show text after node animation completes
    const textTimer = setTimeout(() => {
      setShowText(true)
    }, 1200)

    return () => {
      clearTimeout(animationTimer)
      clearTimeout(textTimer)
    }
  }, [])

  // Handle expansion completion after hover
  useEffect(() => {
    if (hoveredFeature !== null) {
      setIsExpanded(false)
      // Wait for expansion animation to complete (500ms)
      const expandTimer = setTimeout(() => {
        setIsExpanded(true)
      }, 500)

      return () => clearTimeout(expandTimer)
    } else {
      setIsExpanded(false)
    }
  }, [hoveredFeature])

  // Typewriter effect for feature details (starts after expansion)
  useEffect(() => {
    if (hoveredFeature !== null && isExpanded) {
      setTypewriterProgress(0)
      // childNodes is defined below but is effectively constant
      const featureDetails = [
        ["Branch off at any point to explore different ideas", "Visual tree structure for easy conversation tracking", "Navigate between different paths seamlessly", "Compare multiple conversation branches"],
        ["GPT-4, Claude, Gemini, and more", "Switch models without losing context", "Compare responses from different AI models", "Optimize for performance, cost, or quality"],
        ["Enhanced Context: Auto-optimize conversation context", "Web Search: Real-time internet information", "Auto-generated titles for organization", "Reference nodes with @mentions"]
      ]
      const totalChars = featureDetails[hoveredFeature].reduce((sum, detail) => sum + detail.length, 0)
      const duration = 800 // Total duration in ms
      const charsPerMs = totalChars / duration
      let currentProgress = 0

      const interval = setInterval(() => {
        currentProgress += charsPerMs * 16 // ~60fps
        if (currentProgress >= totalChars) {
          setTypewriterProgress(totalChars)
          clearInterval(interval)
        } else {
          setTypewriterProgress(Math.floor(currentProgress))
        }
      }, 16)

      return () => clearInterval(interval)
    } else {
      setTypewriterProgress(0)
    }
  }, [hoveredFeature, isExpanded])

  // Track viewport size for SVG line calculations
  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    // Set initial size
    updateViewportSize()

    // Update on resize
    window.addEventListener('resize', updateViewportSize)
    return () => window.removeEventListener('resize', updateViewportSize)
  }, [])

  useEffect(() => {
    const updateProgress = () => {
      if (!heroRef.current) return
      const heroElement = heroRef.current
      const rect = heroElement.getBoundingClientRect()
      const heroHeight = heroElement.offsetHeight
      const totalScrollable = heroHeight - window.innerHeight

      if (totalScrollable <= 0) {
        setHeroProgress(rect.top < 0 ? 1 : 0)
        return
      }

      const heroTop = rect.top + window.scrollY
      const scrollTop = window.scrollY
      const progress = (scrollTop - heroTop) / totalScrollable
      setHeroProgress(Math.min(Math.max(progress, 0), 1))
    }

    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)

    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [])

  const scrollPercent = heroProgress * 100

  // Phase 1: Chat input appears (0% - 5%) - moved from Phase 2
  const inputProgress = Math.max(0, Math.min(1, scrollPercent / 5))

  // Phase 2: Question text appears in input (5% - 15%)
  const questionProgress = Math.max(0, Math.min(1, (scrollPercent - 5) / 10))

  // Phase 3: Left & Right sidebars slide in (15% - 25%)
  const sidebarProgress = Math.max(0, Math.min(1, (scrollPercent - 15) / 10))

  // Phase 4: AI response appears (25% - 35%)
  const responseProgress = Math.max(0, Math.min(1, (scrollPercent - 25) / 10))

  // Blank period (35% - 40%): AI response complete, no new animations

  // Phase 5: New question appears in input (40% - 50%)
  const newQuestionProgress = Math.max(0, Math.min(1, (scrollPercent - 40) / 10))

  // Phase 6: Sidebars and input fade out (50% - 95%) - 45% duration (3x of 15%)
  const fadeOutProgress = Math.max(0, Math.min(1, (scrollPercent - 50) / 45))

  // Phase 7a (60% - 70%): Edges extend from parent to children (starts after chat input fades)
  const edgeProgress = Math.max(0, Math.min(1, (scrollPercent - 60) / 10))
  // Phase 7b (70% - 80%): Child nodes appear
  const childNodesProgress = Math.max(0, Math.min(1, (scrollPercent - 70) / 10))

  // Question and answer text
  const questionText = "What is node-based AI chatting?"
  const answerText = "Node-based AI chatting visualizes conversations as an interactive tree structure. Each message becomes a node, allowing you to branch off at any point to explore different ideas, compare responses from multiple AI models, and maintain context across complex discussions."
  const newQuestionText = "What is Diverge's feature?"

  // Calculate how much of the question to show (typewriter effect)
  const visibleQuestionLength = Math.floor(questionText.length * questionProgress)
  const displayQuestion = questionProgress > 0 && newQuestionProgress === 0
    ? questionText.substring(0, visibleQuestionLength)
    : ''

  // Calculate AI response typewriter effect
  const visibleAnswerLength = Math.floor(answerText.length * responseProgress)
  const displayAnswer = responseProgress > 0
    ? answerText.substring(0, visibleAnswerLength)
    : ''

  // Calculate new question typewriter effect
  const visibleNewQuestionLength = Math.floor(newQuestionText.length * newQuestionProgress)
  const displayNewQuestion = newQuestionProgress > 0
    ? newQuestionText.substring(0, visibleNewQuestionLength)
    : ''

  // Three child nodes content
  const childNodes: FeatureNode[] = [
    {
      title: "Node-Based Conversation",
      description: "Visualize and navigate conversations as an interactive tree structure",
      icon: GitBranch,
      accent: 'from-emerald-400 to-green-500',
      details: [
        "Branch off at any point to explore different ideas",
        "Visual tree structure for easy conversation tracking",
        "Navigate between different paths seamlessly",
        "Compare multiple conversation branches"
      ]
    },
    {
      title: "Multi-AI Model Support",
      description: "Access multiple AI models in one unified platform",
      icon: Layers,
      accent: 'from-blue-400 to-purple-500',
      details: [
        "GPT-4, Claude, Gemini, and more",
        "Switch models without losing context",
        "Compare responses from different AI models",
        "Optimize for performance, cost, or quality"
      ]
    },
    {
      title: "Intelligent Features",
      description: "Enhanced context, web search, and smart organization",
      icon: Sparkles,
      accent: 'from-amber-400 to-pink-500',
      details: [
        "Enhanced Context: Auto-optimize conversation context",
        "Web Search: Real-time internet information",
        "Auto-generated titles for organization",
        "Reference nodes with @mentions"
      ]
    }
  ]

  // Calculate child node positions (horizontal layout like actual app)
  const nodeWidth = 350 // Match parent node width
  const horizontalSpacing = Math.min(220, Math.max(120, viewportSize.width * 0.12))
  const verticalSpacing = Math.min(380, Math.max(260, viewportSize.height * 0.45))
  const totalChildrenWidth = nodeWidth * 3 + horizontalSpacing * 2
  const startX = -totalChildrenWidth / 2

  // Calculate dynamic Y offset to center different elements during animation
  const centerOffsetY = (-verticalSpacing * 0.25 * edgeProgress) + (-verticalSpacing * 0.25 * childNodesProgress)

  const showSidebars = viewportSize.width >= 1200

  // Dynamic parent node content based on animation progress and hover state
  const getParentNodeContent = () => {
    // If hovering on a child node and Phase 8 is complete
    if (hoveredFeature !== null && childNodesProgress === 1) {
      const feature = childNodes[hoveredFeature]
      // Show feature details only after expansion is complete
      if (isExpanded) {
        return {
          type: 'details' as const,
          title: feature.title,
          details: feature.details
        }
      } else {
        // During expansion, show feature title
        return { type: 'text' as const, value: feature.title, lineBreak: false }
      }
    }

    // Otherwise show text based on progress
    if (fadeOutProgress > 0) {
      return { type: 'text' as const, value: 'Core Feature', lineBreak: true }
    } else if (questionProgress === 1) {
      return { type: 'text' as const, value: 'What is node-based AI chatting?', lineBreak: false }
    } else {
      return { type: 'text' as const, value: 'Diverge', lineBreak: false }
    }
  }

  // Dynamic font size based on text length
  const getParentNodeFontSize = (text: string) => {
    if (text === 'What is node-based AI chatting?') {
      return 'text-2xl md:text-3xl lg:text-4xl' // Smaller for long text
    } else {
      return 'text-3xl md:text-4xl lg:text-5xl' // Original size
    }
  }

  return (
    <div ref={heroRef} className="relative z-10" style={{ minHeight: '600vh' }}>
      {/* Sticky Container - remains fixed in center until all child nodes appear */}
      <div
        className="top-20 h-[calc(100vh-5rem)] flex items-center justify-center"
        style={{
          position: scrollPercent < 80 ? 'fixed' : 'sticky',
          left: scrollPercent < 80 ? 0 : undefined,
          right: scrollPercent < 80 ? 0 : undefined,
          transform: `translateY(${centerOffsetY}px)`,
        }}
      >
        {/* Parent Node with perspective */}
        <div
          className={`
            relative
            ${isAnimated ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            perspective: '1000px',
            transform: isAnimated
              ? 'translateZ(0px) scale(1) translateY(-30px)'
              : 'translateZ(300px) scale(1.5) translateY(-30px)',
            transition: 'transform 1s ease-out, opacity 1s ease-out',
            zIndex: 20,
          }}
        >
          {/* Chat Node Style - Gradient Border */}
          <div
            className="rounded-lg p-0.5 shadow-lg bg-gradient-to-br from-yellow-400 via-emerald-500 to-sky-500 transition-all duration-500"
            style={{
              width: hoveredFeature !== null ? '525px' : '350px', // 1.5x when hovered
            }}
          >
            {/* Inner Content with Background */}
            <div
              className="rounded-md p-8 bg-gradient-to-br from-green-50 to-emerald-50 overflow-hidden transition-all duration-500"
              style={{ height: hoveredFeature !== null ? '312px' : '240px' }} // 1.3x when hovered
            >
              {/* Model Badge */}
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium">
                  diverge
                </span>
                <span className="text-sm font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {(() => {
                    const content = getParentNodeContent()
                    if (content.type === 'text') {
                      if (content.value === 'What is node-based AI chatting?') {
                        return '#about'
                      } else if (content.value === 'Core Feature') {
                        return '#feature'
                      }
                    }
                    return '#welcome'
                  })()}
                </span>
              </div>

              {/* Text Content */}
              <div
                className={`
                  text-center
                  transition-all
                  duration-500
                  ease-out
                  py-4
                  flex
                  ${(() => {
                    const content = getParentNodeContent()
                    return content.type === 'details' ? 'items-start' : 'items-center'
                  })()}
                  justify-center
                  ${showText ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                `}
                style={{ height: hoveredFeature !== null ? '180px' : '120px', overflow: 'auto' }}
              >
                {(() => {
                  const content = getParentNodeContent()
                  if (content.type === 'details') {
                    // Calculate typewriter effect
                    let charCount = 0
                    const visibleDetails = content.details.map(detail => {
                      const detailStart = charCount
                      charCount += detail.length
                      const visibleLength = Math.max(0, Math.min(detail.length, typewriterProgress - detailStart))
                      return detail.substring(0, visibleLength)
                    })

                    return (
                      <div className="w-full px-2">
                        <h2 className="text-2xl font-bold text-gray-800 mb-3">{content.title}</h2>
                        <ul className="text-left text-sm space-y-2">
                          {visibleDetails.map((detail, idx) => (
                            detail.length > 0 && (
                              <li key={idx} className="text-gray-700 leading-relaxed">
                                • {detail}
                                {idx === visibleDetails.findIndex(d => d.length < content.details[idx].length) && (
                                  <span className="animate-pulse">|</span>
                                )}
                              </li>
                            )
                          ))}
                        </ul>
                      </div>
                    )
                  } else {
                    // Handle line break for "Core Feature"
                    const textParts = content.lineBreak ? content.value.split(' ') : [content.value]
                    return (
                      <h1 className={`${getParentNodeFontSize(content.value)} text-gray-800 font-medium`}>
                        {content.lineBreak ? (
                          <>
                            {textParts[0]}
                            <br />
                            {textParts.slice(1).join(' ')}
                          </>
                        ) : (
                          content.value
                        )}
                      </h1>
                    )
                  }
                })()}
              </div>

            </div>
          </div>
        </div>

        {/* Phase 2-3: Chat Input */}
        <div
          className="fixed bottom-8 left-1/2 w-full max-w-2xl px-6"
          style={{
            opacity: inputProgress,
            transform: `translateX(-50%) translateY(${(1 - inputProgress) * 30 + fadeOutProgress * 150}vh)`,
            pointerEvents: inputProgress > 0 && fadeOutProgress < 1 ? 'auto' : 'none',
          }}
        >
          <div
            className="rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {/* Main Input Area */}
            <div className="p-4">
              {/* Text Input */}
              <div
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3"
                style={{ minHeight: '44px' }}
              >
                {displayNewQuestion ? (
                  <span className="text-gray-900">
                    {displayNewQuestion}
                    {newQuestionProgress < 1 && (
                      <span className="animate-pulse">|</span>
                    )}
                  </span>
                ) : displayQuestion ? (
                  <span className="text-gray-900">
                    {displayQuestion}
                    {questionProgress < 1 && newQuestionProgress === 0 && (
                      <span className="animate-pulse">|</span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-500">Type your message...</span>
                )}
              </div>

              {/* Bottom Controls */}
              <div className="flex items-center justify-between mt-3">
                {/* Left - Function Buttons */}
                <div className="flex items-center space-x-2">
                  <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <PlusIcon className="w-4 h-4 text-gray-700" />
                  </button>
                  <button className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <MagnifyingGlassIcon className="w-4 h-4 text-blue-600" />
                  </button>
                  <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <BoltIcon className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                {/* Right - Model and Send */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-600 bg-white/20 px-2 py-1 rounded">
                    gpt-4o
                  </span>
                  <button className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <PaperAirplaneIcon className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Phase 4-5: Left Sidebar */}
        {showSidebars && (
        <div
          className="fixed left-[30px] top-[100px] bottom-[25px] w-[350px] z-50 rounded-[2rem] border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col"
          style={{
            transform: `translateX(calc(${(sidebarProgress - 1) * 100}% - ${(1 - sidebarProgress) * 30}px)) translateY(-${fadeOutProgress * 150}vh)`,
            opacity: sidebarProgress,
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* Header - Diverge Logo */}
          <div className="px-6 pt-9 pb-6 border-b border-white/10">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900">
                Diverge
              </h1>
            </div>
          </div>

          {/* User Info Section */}
          <div className="px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                <span className="text-white text-sm font-medium">U</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">User</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-gray-600">Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Sessions */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <div className="mb-4 px-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Recent Chats
                </h2>
                <span className="text-xs text-gray-400">3</span>
              </div>
            </div>

            {/* Sample sessions */}
            <div className="space-y-2 px-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-all cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <ChatBubbleLeftRightIcon className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-800 font-medium">Chat Session {i}</span>
                  </div>
                  <span className="text-xs text-gray-500">2025 01 20</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 p-4">
            <button className="w-full mb-3 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-white/20 text-gray-800 text-sm font-medium hover:from-blue-500/30 hover:to-purple-500/30 transition-all duration-200 flex items-center justify-center gap-2">
              <PlusIcon className="w-4 h-4" />
              New Chat
            </button>
            <button className="w-full px-4 py-2 rounded-lg text-gray-700 text-sm hover:text-purple-600 transition-all duration-200 flex items-center gap-2">
              <Cog6ToothIcon className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
        )}

        {/* Phase 4-5: Right Sidebar */}
        {showSidebars && (
        <div
          className="fixed right-[30px] top-[100px] bottom-[25px] w-[400px] z-50 rounded-[2rem] border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col"
          style={{
            transform: `translateX(calc(${(1 - sidebarProgress) * 100}% + ${(1 - sidebarProgress) * 30}px)) translateY(-${fadeOutProgress * 150}vh)`,
            opacity: sidebarProgress,
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
            {/* Sidebar Header - Session Title */}
            <div className="px-6 pt-9 pb-4 border-b border-white/10">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-black">
                  Chat Session
                </h1>
              </div>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {/* User Prompt Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">User</h3>
                    <button
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title="Copy prompt"
                    >
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {questionText}
                    </p>
                  </div>
                </div>

                {/* AI Response Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">AI Response</h3>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100/70 text-green-800 rounded-full">
                      gpt-4o
                    </span>
                    <button
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title="Copy response"
                    >
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    {responseProgress === 0 ? (
                      <div className="py-4 flex items-center gap-2 text-gray-400">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                        <span className="text-xs">Generating response...</span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {displayAnswer}
                        {responseProgress < 1 && (
                          <span className="animate-pulse">|</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                      <Settings className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Details</h3>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20 space-y-4">
                    {/* Status */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-600">Status</div>
                      <div className="inline-flex px-2 py-1 rounded-full text-xs font-medium text-green-600 bg-green-50">
                        Completed
                      </div>
                    </div>
                    {/* Created */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-600">Created</div>
                      <div className="text-sm text-gray-800">Just now</div>
                    </div>
                    {/* Node ID */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-600">Node ID</div>
                      <div className="text-sm text-gray-800 font-mono">abc12345</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>
        )}

        {/* Phase 8: Connection Lines (SVG) */}
        {edgeProgress > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            {childNodes.map((_, index) => {
              // Parent node dimensions and position
              const parentNodeHeight = 164 // Adjusted to match actual visible height (p-8 = 32px * 2 = 64px + content)
              const parentCenterX = viewportSize.width / 2
              const parentCenterY = viewportSize.height / 2

              // Parent node bottom center (source of line) - remove the 0.5px border
              const parentX = parentCenterX
              const parentY = parentCenterY + (parentNodeHeight / 2) - 50 // +1px to start just below the border

              // Child node position (horizontal layout)
              const childX = startX + nodeWidth / 2 + index * (nodeWidth + horizontalSpacing) + viewportSize.width / 2
              const childY = parentCenterY + verticalSpacing - 50 // Move 50px closer to parent

              // Child node top center (target of line)
              const childNodeHeight = 220 // Adjusted to match actual node height with increased padding
              const childTopY = childY - (childNodeHeight / 2) - 1 // -1px to end just above the border

              // Smoothstep path: straight down, horizontal, straight to target
              // This creates the characteristic 90-degree angles
              const midY = (parentY + childTopY) / 2
              const path = `M ${parentX} ${parentY} L ${parentX} ${midY} L ${childX} ${midY} L ${childX} ${childTopY}`

              // Calculate path length for animation
              const verticalSegment1 = Math.abs(midY - parentY)
              const horizontalSegment = Math.abs(childX - parentX)
              const verticalSegment2 = Math.abs(childTopY - midY)
              const totalLength = verticalSegment1 + horizontalSegment + verticalSegment2

              // Animate path drawing (no stagger - all edges appear simultaneously)
              const dashOffset = totalLength * (1 - edgeProgress)

              return (
                <path
                  key={`line-${index}`}
                  d={path}
                  stroke="#3b82f6"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={totalLength}
                  strokeDashoffset={dashOffset}
                />
              )
            })}
          </svg>
        )}

        {/* Phase 8b: Three Child Nodes (appear after edges complete) */}
        {childNodesProgress > 0 && childNodes.map((child, index) => {
          // Calculate position using the same logic as edges for perfect alignment
          const staggerOffset = index * 0.12
          const effectiveProgress = Math.max(0, Math.min(1, (childNodesProgress - staggerOffset) / (1 - staggerOffset)))

          // Match edge calculation exactly
          const childX = startX + nodeWidth / 2 + index * (nodeWidth + horizontalSpacing) + viewportSize.width / 2
          const childY = viewportSize.height / 2 + verticalSpacing - 50 // Move 50px closer to parent

          // Add upward floating animation (20px from bottom)
          const floatOffset = (1 - effectiveProgress) * 20

          return (
            <div
              key={index}
              className="absolute"
              style={{
                opacity: effectiveProgress,
                left: `${childX}px`,
                top: `${childY + floatOffset}px`,
                transform: 'translate(-50%, -50%)', // Center the node on the calculated position
                pointerEvents: childNodesProgress === 1 ? 'auto' : 'none', // Enable hover only when fully visible
              }}
              onMouseEnter={() => {
                if (childNodesProgress === 1) {
                  setHoveredFeature(index)
                }
              }}
              onMouseLeave={() => {
                if (childNodesProgress === 1) {
                  setHoveredFeature(null)
                }
              }}
            >
              <div
                className={`rounded-lg p-0.5 shadow-lg bg-gradient-to-br from-blue-400 to-purple-500 transition-transform duration-300 ${
                  hoveredFeature === index ? 'scale-105' : 'scale-100'
                }`}
                style={{
                  minWidth: `${nodeWidth}px`,
                  maxWidth: `${nodeWidth}px`,
                  cursor: childNodesProgress === 1 ? 'pointer' : 'default',
                }}
              >
                <div className="rounded-md p-8 bg-gradient-to-br from-white to-blue-50">
                  {/* Model Badge */}
                  <div className="mb-6 flex items-center justify-between">
                    <span className="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium">
                      feature
                    </span>
                    <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      #{index + 1}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="py-4 text-left space-y-3">
                    <h2 className="text-xl font-semibold text-gray-800">
                      {child.title}
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {child.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
