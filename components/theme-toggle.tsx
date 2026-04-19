"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

/**
 * Theme toggle button — cycles through light → dark → system.
 * Uses next-themes (already wired in app/providers.tsx).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const current = mounted ? theme : "dark"

  function cycle() {
    if (current === "light") setTheme("dark")
    else if (current === "dark") setTheme("system")
    else setTheme("light")
  }

  const label =
    current === "light"
      ? "Switch to dark theme"
      : current === "dark"
      ? "Switch to system theme"
      : "Switch to light theme"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground hover:bg-accent"
    >
      {current === "light" && <Sun className="h-4 w-4" />}
      {current === "dark" && <Moon className="h-4 w-4" />}
      {current === "system" && <Monitor className="h-4 w-4" />}
      <span className="sr-only">{label}</span>
    </Button>
  )
}
