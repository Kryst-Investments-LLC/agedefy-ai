"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    if (password.length < 12) {
      setError("Password must be at least 12 characters")
      return
    }

    setIsSubmitting(true)

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    })

    const body = await response.json().catch(() => ({ error: "Something went wrong" }))

    if (!response.ok) {
      setError(body.error ?? "Something went wrong")
      setIsSubmitting(false)
      return
    }

    setSuccess(true)
    setIsSubmitting(false)

    // Redirect to sign-in after 2 seconds
    setTimeout(() => router.push("/sign-in"), 2000)
  }

  if (!token) {
    return (
      <Card className="border-gray-800 bg-gray-900 text-white">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-300">
            Invalid reset link. Please request a new{" "}
            <Link href="/forgot-password" className="text-teal-400 hover:underline">
              password reset
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-gray-800 bg-gray-900 text-white">
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>Enter a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="space-y-4">
            <p className="text-sm text-green-400">Password reset successfully. Redirecting to sign in…</p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={12}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={12}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Resetting…" : "Reset password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-16">
      <div className="mx-auto max-w-md">
        <Suspense fallback={<div className="text-gray-400">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  )
}
