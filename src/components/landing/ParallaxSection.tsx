'use client'

import { useScrollProgress } from '@/hooks/useScrollProgress'
import { ReactNode } from 'react'

interface ParallaxSectionProps {
  children: ReactNode
  speed?: number
  className?: string
}

export function ParallaxSection({ children, speed = 0.5, className = '' }: ParallaxSectionProps) {
  const { scrollY } = useScrollProgress()

  const transform = `translateY(${scrollY * speed}px)`

  return (
    <div
      className={className}
      style={{
        transform,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  )
}
