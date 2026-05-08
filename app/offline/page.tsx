"use client"

import { WifiOff } from "lucide-react"

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
      <WifiOff className="h-16 w-16 text-muted-foreground mb-6" />
      <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
      <p className="text-muted-foreground max-w-md">
        It looks like you&apos;ve lost your internet connection. Some features
        require a network connection to work. Please check your connection and
        try again.
      </p>
      <button
        onClick={() => typeof window !== "undefined" && window.location.reload()}
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        Try Again
      </button>
    </div>
  )
}
