'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface DiscoveryLabButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  showText?: boolean
}

/**
 * Navigation button to Discovery Lab
 * Can be added to Dashboard, Protocol pages, and other key locations
 */
export function DiscoveryLabButton({
  variant = 'default',
  size = 'default',
  showText = true,
}: DiscoveryLabButtonProps) {
  return (
    <Link href="/discovery">
      <Button variant={variant} size={size} className="gap-2">
        <Sparkles className="h-4 w-4" />
        {showText && 'Deep Discover'}
      </Button>
    </Link>
  )
}
