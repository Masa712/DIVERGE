'use client'

import React from 'react'

interface AnimatedBackgroundProps {
  className?: string
  opacity?: number
}

export function AnimatedBackground({ className = '', opacity = 1 }: AnimatedBackgroundProps) {
  // Generate unique IDs to avoid conflicts when multiple instances exist
  const uniqueId = React.useMemo(() => Math.random().toString(36).substring(2, 9), [])
  
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
            <stop offset="0%" style={{ stopColor: '#5DADE2' }}>
              <animate 
                attributeName="stop-color" 
                values="#5DADE2;#7EC8E3;#85C1E2;#5DADE2" 
                dur="10s" 
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" style={{ stopColor: '#5DADE2', stopOpacity: 0 }}>
              <animate 
                attributeName="stop-color" 
                values="#5DADE2;#6DD5ED;#79BEEE;#5DADE2" 
                dur="12s" 
                repeatCount="indefinite"
              />
            </stop>
          </radialGradient>

          {/* 右上 */}
          <radialGradient id={`gradient-tr-${uniqueId}`} cx="100%" cy="0%" r="100%">
            <stop offset="0%" style={{ stopColor: '#DDA0DD' }}>
              <animate 
                attributeName="stop-color" 
                values="#DDA0DD;#D8A8E8;#E8B4E8;#DDA0DD" 
                dur="11s" 
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" style={{ stopColor: '#DDA0DD', stopOpacity: 0 }}>
              <animate 
                attributeName="stop-color" 
                values="#DDA0DD;#C8A2C8;#E0B0E0;#DDA0DD" 
                dur="13s" 
                repeatCount="indefinite"
              />
            </stop>
          </radialGradient>

          {/* 左下 */}
          <radialGradient id={`gradient-bl-${uniqueId}`} cx="0%" cy="100%" r="100%">
            <stop offset="0%" style={{ stopColor: '#FF91A4' }}>
              <animate 
                attributeName="stop-color" 
                values="#FF91A4;#FFA0B4;#FFB6C1;#FF91A4" 
                dur="9s" 
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" style={{ stopColor: '#FF91A4', stopOpacity: 0 }}>
              <animate 
                attributeName="stop-color" 
                values="#FF91A4;#FFB0BE;#FFC5D0;#FF91A4" 
                dur="14s" 
                repeatCount="indefinite"
              />
            </stop>
          </radialGradient>

          {/* 右下 */}
          <radialGradient id={`gradient-br-${uniqueId}`} cx="100%" cy="100%" r="100%">
            <stop offset="0%" style={{ stopColor: '#FFE066' }}>
              <animate 
                attributeName="stop-color" 
                values="#FFE066;#F9E79F;#FFF2A0;#FFE066" 
                dur="8s" 
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" style={{ stopColor: '#FFE066', stopOpacity: 0 }}>
              <animate 
                attributeName="stop-color" 
                values="#FFE066;#FFE88C;#FFF0B3;#FFE066" 
                dur="15s" 
                repeatCount="indefinite"
              />
            </stop>
          </radialGradient>

          {/* 中央のブレンド用グラデーション */}
          <radialGradient id={`gradient-center-${uniqueId}`} cx="50%" cy="50%" r="70%">
            <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 0.4 }}>
              <animate 
                attributeName="stop-opacity" 
                values="0.4;0.6;0.4" 
                dur="6s" 
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" style={{ stopColor: '#ffffff', stopOpacity: 0 }} />
          </radialGradient>

          {/* ソフトなブラーエフェクト */}
          <filter id={`blur-${uniqueId}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="50"/>
          </filter>
        </defs>

        {/* ベース背景（白） */}
        <rect width="100%" height="100%" fill="#ffffff"/>
        
        {/* 四隅のグラデーション */}
        <rect width="100%" height="100%" fill={`url(#gradient-tl-${uniqueId})`}/>
        <rect width="100%" height="100%" fill={`url(#gradient-tr-${uniqueId})`}/>
        <rect width="100%" height="100%" fill={`url(#gradient-bl-${uniqueId})`}/>
        <rect width="100%" height="100%" fill={`url(#gradient-br-${uniqueId})`}/>
        
        {/* 中央のブレンド */}
        <rect width="100%" height="100%" fill={`url(#gradient-center-${uniqueId})`}>
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1,1;1.1,1.1;1,1"
            dur="20s"
            repeatCount="indefinite"
          />
        </rect>

        {/* ソフトなブレンドレイヤー */}
        <rect width="100%" height="100%" fill={`url(#gradient-tl-${uniqueId})`} filter={`url(#blur-${uniqueId})`} opacity="0.3"/>
        <rect width="100%" height="100%" fill={`url(#gradient-tr-${uniqueId})`} filter={`url(#blur-${uniqueId})`} opacity="0.3"/>
        <rect width="100%" height="100%" fill={`url(#gradient-bl-${uniqueId})`} filter={`url(#blur-${uniqueId})`} opacity="0.3"/>
        <rect width="100%" height="100%" fill={`url(#gradient-br-${uniqueId})`} filter={`url(#blur-${uniqueId})`} opacity="0.3"/>
      </svg>
    </div>
  )
}