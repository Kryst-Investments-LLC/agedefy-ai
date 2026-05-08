"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to structured logger when available; console.error for now
    console.error("[app-error]", error.message, error.digest)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <p className="max-w-md text-muted-foreground">
        An unexpected error occurred. Our team has been notified.
        {error.digest && (
          <span className="mt-1 block text-xs text-muted-foreground/70">
            Reference: {error.digest}
          </span>
        )}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
