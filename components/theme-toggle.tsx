'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'

/**
 * Light/dark theme switcher for the app top bar. Uses next-themes (already
 * wired in app/providers.tsx). The `mounted` guard avoids a hydration mismatch,
 * since the correct icon depends on the client-resolved theme.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle theme'}
      title={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {/* Render both icons and toggle visibility so SSR and first client paint
          match; the mounted class swap happens after hydration. */}
      <Sun className={mounted && !isDark ? 'hidden' : 'h-4 w-4'} />
      <Moon className={mounted && !isDark ? 'h-4 w-4' : 'hidden'} />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
