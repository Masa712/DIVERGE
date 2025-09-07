'use client'

import React from 'react'

interface AnimatedBackgroundProps {
  className?: string
  opacity?: number
}

export function AnimatedBackground({ className = '', opacity = 1 }: AnimatedBackgroundProps) {
  // Generate unique IDs to avoid conflicts when multiple instances exist
  // Use useState to ensure same ID on server and client (hydration fix)
  const [uniqueId] = React.useState(() => Math.random().toString(36).substring(2, 9))
  
  return (
    <div className={`fixed inset-0 -z-10 ${className}`} style={{ opacity }}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 1000 600" 
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          {/* 四隅のラジアルグラデーション */}
          {/* 左上 */}
          <radialGradient id={`gradient-tl-${uniqueId}`} cx="0%" cy="0%" r="100%">
            <stop offset="0%" style={{ stopColor: '#5DADE2' }} />
            <stop offset="100%" style={{ stopColor: '#5DADE2', stopOpacity: 0 }} />
          </radialGradient>

          {/* 右上 */}
          <radialGradient id={`gradient-tr-${uniqueId}`} cx="100%" cy="0%" r="100%">
            <stop offset="0%" style={{ stopColor: '#DDA0DD' }} />
            <stop offset="100%" style={{ stopColor: '#DDA0DD', stopOpacity: 0 }} />
          </radialGradient>

          {/* 左下 */}
          <radialGradient id={`gradient-bl-${uniqueId}`} cx="0%" cy="100%" r="100%">
            <stop offset="0%" style={{ stopColor: '#FF91A4' }} />
            <stop offset="100%" style={{ stopColor: '#FF91A4', stopOpacity: 0 }} />
          </radialGradient>

          {/* 右下 */}
          <radialGradient id={`gradient-br-${uniqueId}`} cx="100%" cy="100%" r="100%">
            <stop offset="0%" style={{ stopColor: '#FFE066' }} />
            <stop offset="100%" style={{ stopColor: '#FFE066', stopOpacity: 0 }} />
          </radialGradient>

          {/* 中央のブレンド用グラデーション */}
          <radialGradient id={`gradient-center-${uniqueId}`} cx="50%" cy="50%" r="70%">
            <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 0.4 }} />
            <stop offset="100%" style={{ stopColor: '#ffffff', stopOpacity: 0 }} />
          </radialGradient>
        </defs>

        {/* ベース背景（白） */}
        <rect width="100%" height="100%" fill="#ffffff"/>
        
        {/* 四隅のグラデーション */}
        <rect width="100%" height="100%" fill={`url(#gradient-tl-${uniqueId})`}/>
        <rect width="100%" height="100%" fill={`url(#gradient-tr-${uniqueId})`}/>
        <rect width="100%" height="100%" fill={`url(#gradient-bl-${uniqueId})`}/>
        <rect width="100%" height="100%" fill={`url(#gradient-br-${uniqueId})`}/>
        
        {/* 中央のブレンド */}
        <rect width="100%" height="100%" fill={`url(#gradient-center-${uniqueId})`} />
      </svg>
    </div>
  )
}