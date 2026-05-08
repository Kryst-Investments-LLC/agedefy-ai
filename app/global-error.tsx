"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center text-foreground">
        <AlertTriangle className="h-12 w-12 text-red-600" />
        <h2 className="text-2xl font-semibold">Critical Error</h2>
        <p className="max-w-md text-muted-foreground">
          Something went seriously wrong. Please try refreshing the page.
          {error.digest && (
            <span className="mt-1 block text-xs text-muted-foreground/70">
              Reference: {error.digest}
            </span>
          )}
        </p>
        <Button onClick={reset}>Refresh</Button>
      </body>
    </html>
  )
}
