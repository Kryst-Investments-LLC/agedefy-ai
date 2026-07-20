"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { safeInternalPath } from "@/lib/security/safe-redirect"

type SignInFormProps = {
  callbackUrl: string
}

export function SignInForm({ callbackUrl }: SignInFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    })

    if (!result || result.error) {
      setError("Invalid email or password")
      setIsSubmitting(false)
      return
    }

    // Validate the redirect target to a same-origin path (open-redirect guard).
    router.push(safeInternalPath(result.url ?? callbackUrl, window.location.origin))
    router.refresh()
  }

  return (
    <Card className="border-border bg-background text-foreground">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Access your real Biozephyra workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <Link href="/forgot-password" className="text-teal-600 dark:text-teal-400 hover:underline">Forgot password?</Link>
          <span>Need an account? <Link href="/sign-up" className="text-teal-600 dark:text-teal-400">Create one</Link></span>
        </div>
      </CardContent>
    </Card>
  )
}