"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") ?? ""

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setErrorMessage("Missing verification token.")
      return
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success")
          setTimeout(() => router.push("/dashboard"), 3000)
        } else {
          const body = await res.json().catch(() => ({ error: "Verification failed" }))
          setStatus("error")
          setErrorMessage(body.error ?? "Verification failed")
        }
      })
      .catch(() => {
        setStatus("error")
        setErrorMessage("Network error")
      })
  }, [token, router])

  return (
    <Card className="border-border bg-background text-foreground">
      <CardHeader>
        <CardTitle>Email Verification</CardTitle>
      </CardHeader>
      <CardContent>
        {status === "verifying" && (
          <p className="text-sm text-muted-foreground">Verifying your email…</p>
        )}
        {status === "success" && (
          <div className="space-y-2">
            <p className="text-sm text-green-600 dark:text-green-400">Email verified successfully!</p>
            <p className="text-sm text-muted-foreground">Redirecting to dashboard…</p>
          </div>
        )}
        {status === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            <Link href="/dashboard" className="text-teal-600 dark:text-teal-400 hover:underline text-sm">
              Go to dashboard
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-md">
        <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </main>
  )
}
