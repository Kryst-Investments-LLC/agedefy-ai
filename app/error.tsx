"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { reportClientError } from "@/lib/observability/report-client-error"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report to the server so the error is actually captured (the message below
    // promises the team is notified — this makes that true).
    reportClientError(error, "app")
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
