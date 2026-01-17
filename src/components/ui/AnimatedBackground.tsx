'use client'

import React from 'react'

interface AnimatedBackgroundProps {
  className?: string
  opacity?: number
  position?: 'fixed' | 'absolute'
}

export function AnimatedBackground({
  className = '',
  opacity = 1,
  position = 'fixed'
}: AnimatedBackgroundProps) {
  // Generate unique IDs to avoid conflicts when multiple instances exist
  // Use useState to ensure same ID on server and client (hydration fix)
  const [uniqueId] = React.useState(() => Math.random().toString(36).substring(2, 9))
  
  return (
    <div
      className={`${position} inset-0 -z-10 pointer-events-none ${className}`}
      style={{ opacity }}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 1000 600" 
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          {/* 強いぼかしフィルター */}
          <filter id={`blur-filter-${uniqueId}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="60" />
          </filter>

          {/* 軽いぼかしフィルター（よりはっきりした円用） */}
          <filter id={`light-blur-filter-${uniqueId}`}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
          </filter>

          {/* グレインフィルター */}
          <filter id={`grain-filter-${uniqueId}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="desaturatedNoise" />
            <feComponentTransfer in="desaturatedNoise" result="theNoise">
              <feFuncA type="discrete" tableValues="1 0" />
            </feComponentTransfer>
            <feColorMatrix in="theNoise" type="matrix" values="1 0 0 0 0
                                                                0 1 0 0 0
                                                                0 0 1 0 0
                                                                0 0 0 0.35 0" result="limitedNoise"/>
            {/* ソースアルファ（円の形状）でマスク */}
            <feComposite in="limitedNoise" in2="SourceAlpha" operator="in" result="maskedGrain" />
            <feBlend in="SourceGraphic" in2="maskedGrain" mode="multiply" />
          </filter>

          {/* グラスモーフィズムフィルター - 手前（ぼかし少ない） */}
          <filter id={`glassmorphism-front-${uniqueId}`}>
            {/* グレイン効果 */}
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="desaturatedNoise" />
            <feComponentTransfer in="desaturatedNoise" result="theNoise">
              <feFuncA type="discrete" tableValues="1 0" />
            </feComponentTransfer>
            <feColorMatrix in="theNoise" type="matrix" values="1 0 0 0 0
                                                                0 1 0 0 0
                                                                0 0 1 0 0
                                                                0 0 0 0.35 0" result="limitedNoise"/>
            <feComposite in="limitedNoise" in2="SourceAlpha" operator="in" result="maskedGrain" />
            <feBlend in="SourceGraphic" in2="maskedGrain" mode="multiply" result="withGrain" />

            {/* 彩度とコントラストを強化（手前なのでビビッド） */}
            <feColorMatrix in="withGrain" type="saturate" values="1.3" result="saturated" />
            <feComponentTransfer in="saturated" result="contrasted">
              <feFuncR type="linear" slope="1.15" intercept="-0.075" />
              <feFuncG type="linear" slope="1.15" intercept="-0.075" />
              <feFuncB type="linear" slope="1.15" intercept="-0.075" />
            </feComponentTransfer>

            {/* 軽いぼかし効果 */}
            <feGaussianBlur in="contrasted" stdDeviation="0.5" result="blurred" />

            {/* 強い影（手前なので濃い影） */}
            <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#000000" floodOpacity="0.2" result="withShadow" />
          </filter>

          {/* グラスモーフィズムフィルター - 中間 */}
          <filter id={`glassmorphism-middle-${uniqueId}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="desaturatedNoise" />
            <feComponentTransfer in="desaturatedNoise" result="theNoise">
              <feFuncA type="discrete" tableValues="1 0" />
            </feComponentTransfer>
            <feColorMatrix in="theNoise" type="matrix" values="1 0 0 0 0
                                                                0 1 0 0 0
                                                                0 0 1 0 0
                                                                0 0 0 0.35 0" result="limitedNoise"/>
            <feComposite in="limitedNoise" in2="SourceAlpha" operator="in" result="maskedGrain" />
            <feBlend in="SourceGraphic" in2="maskedGrain" mode="multiply" result="withGrain" />

            {/* 彩度を少し下げる（中間距離の大気遠近法） */}
            <feColorMatrix in="withGrain" type="saturate" values="0.9" result="desaturated" />
            <feComponentTransfer in="desaturated" result="lightened">
              <feFuncR type="linear" slope="0.95" intercept="0.05" />
              <feFuncG type="linear" slope="0.95" intercept="0.05" />
              <feFuncB type="linear" slope="0.95" intercept="0.05" />
            </feComponentTransfer>

            {/* 中程度のぼかし */}
            <feGaussianBlur in="lightened" stdDeviation="2" result="blurred" />

            {/* 中程度の影 */}
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000000" floodOpacity="0.15" result="withShadow" />
          </filter>

          {/* グラスモーフィズムフィルター - 奥（ぼかし多い） */}
          <filter id={`glassmorphism-back-${uniqueId}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="desaturatedNoise" />
            <feComponentTransfer in="desaturatedNoise" result="theNoise">
              <feFuncA type="discrete" tableValues="1 0" />
            </feComponentTransfer>
            <feColorMatrix in="theNoise" type="matrix" values="1 0 0 0 0
                                                                0 1 0 0 0
                                                                0 0 1 0 0
                                                                0 0 0 0.35 0" result="limitedNoise"/>
            <feComposite in="limitedNoise" in2="SourceAlpha" operator="in" result="maskedGrain" />
            <feBlend in="SourceGraphic" in2="maskedGrain" mode="multiply" result="withGrain" />

            {/* 彩度を大きく下げ、明るくする（大気遠近法 - 霞んだ感じ） */}
            <feColorMatrix in="withGrain" type="saturate" values="0.6" result="desaturated" />
            <feComponentTransfer in="desaturated" result="lightened">
              <feFuncR type="linear" slope="0.85" intercept="0.15" />
              <feFuncG type="linear" slope="0.85" intercept="0.15" />
              <feFuncB type="linear" slope="0.85" intercept="0.15" />
            </feComponentTransfer>

            {/* 強いぼかし効果 */}
            <feGaussianBlur in="lightened" stdDeviation="4" result="blurred" />

            {/* 軽い影（奥なので薄い影） */}
            <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#000000" floodOpacity="0.1" result="withShadow" />
          </filter>

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

        {/* 大きなぼかした円オブジェクト */}
        {/* 円1: 左上寄り - パステルブルー */}
        <circle
          cx="200"
          cy="150"
          r="200"
          fill="#A8D8EA"
          opacity="0.4"
          filter={`url(#blur-filter-${uniqueId})`}
        />

        {/* 円2: 右上 - パステルピンク */}
        <circle
          cx="800"
          cy="100"
          r="250"
          fill="#FFB6C1"
          opacity="0.35"
          filter={`url(#blur-filter-${uniqueId})`}
        />

        {/* 円3: 中央やや下 - パステルイエロー */}
        <circle
          cx="500"
          cy="400"
          r="180"
          fill="#FFEDCC"
          opacity="0.4"
          filter={`url(#blur-filter-${uniqueId})`}
        />

        {/* 円4: 左下 - パステルパープル */}
        <circle
          cx="150"
          cy="500"
          r="220"
          fill="#DDA0DD"
          opacity="0.3"
          filter={`url(#blur-filter-${uniqueId})`}
        />

        {/* 円5: 右中央 - パステルミント */}
        <circle
          cx="850"
          cy="350"
          r="190"
          fill="#B0E0E6"
          opacity="0.35"
          filter={`url(#blur-filter-${uniqueId})`}
        />
      </svg>
    </div>
  )
}
