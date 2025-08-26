'use client'

import React from 'react'

interface GradientBackgroundProps {
  id?: string
  gap?: number
  size?: number
  opacity?: number
}

export function GradientBackground({ 
  id = 'gradient-bg', 
  gap = 20, 
  size = 1,
  opacity = 0.3 
}: GradientBackgroundProps) {
  return (
    <svg
      className="react-flow__background"
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        zIndex: -1,
      }}
    >
      <defs>
        {/* メインのグラデーション定義 */}
        <radialGradient id="mainGradient" cx="30%" cy="20%" r="65%">
          <stop offset="0%" stopColor="#B8E0FF" stopOpacity="0.6" />
          <stop offset="25%" stopColor="#E0C7FF" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#FFF5B8" stopOpacity="0.45" />
          <stop offset="75%" stopColor="#FFD0D6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.2" />
        </radialGradient>
        
        {/* セカンダリグラデーション */}
        <radialGradient id="secondaryGradient" cx="70%" cy="80%" r="55%">
          <stop offset="0%" stopColor="#FFD0D6" stopOpacity="0.45" />
          <stop offset="30%" stopColor="#E0C7FF" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#B8E0FF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.15" />
        </radialGradient>

        {/* ドットパターン */}
        <pattern 
          id="dotPattern" 
          x="0" 
          y="0" 
          width={gap} 
          height={gap} 
          patternUnits="userSpaceOnUse"
        >
          <circle 
            cx={gap / 2} 
            cy={gap / 2} 
            r={size} 
            fill="rgba(255, 255, 255, 0.2)"
          />
        </pattern>
      </defs>
      
      {/* ベース背景（白） */}
      <rect width="100%" height="100%" fill="#FFFFFF" />
      
      {/* ベースグラデーション */}
      <rect width="100%" height="100%" fill="url(#mainGradient)" />
      
      {/* セカンダリグラデーション（ブレンド効果） */}
      <rect 
        width="100%" 
        height="100%" 
        fill="url(#secondaryGradient)" 
        style={{ mixBlendMode: 'soft-light' }}
      />
      
      {/* ドットオーバーレイ */}
      <rect 
        width="100%" 
        height="100%" 
        fill="url(#dotPattern)" 
        opacity={opacity * 0.7}
      />
    </svg>
  )
}