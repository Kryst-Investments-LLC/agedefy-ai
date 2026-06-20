"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import { AppShell } from "@/components/app-shell"
import { MfaSetup } from "@/components/mfa-setup"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"

export default function SecurityPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null)
  const [showDisable, setShowDisable] = useState(false)
  const [disableToken, setDisableToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetch("/api/account/mfa/status")
      .then((res) => res.json())
      .then((data) => setMfaEnabled(data.enabled === true))
      .catch(() => setMfaEnabled(false))
  }, [])

  const handleDisable = async () => {
    setIsLoading(true)
    setError(null)
    const res = await fetch("/api/account/mfa", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: disableToken }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to disable MFA")
      setIsLoading(false)
      return
    }
    setMfaEnabled(false)
    setShowDisable(false)
    setIsLoading(false)
  }

  if (!session?.user) return null

  return (
    <AppShell>
      <div className="min-h-full bg-gray-900">
      <main className="mx-auto max-w-2xl px-4 py-10 text-white">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">Account</p>
          <h1 className="text-3xl font-bold">Security Settings</h1>
        </div>

        {mfaEnabled === null ? (
          <p className="text-gray-400">Loading...</p>
        ) : mfaEnabled ? (
          <Card className="border-gray-800 bg-gray-900 text-white">
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>MFA is currently enabled on your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {showDisable ? (
                <div className="space-y-4">
                  <Label>Enter TOTP code or backup code to disable MFA</Label>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={disableToken} onChange={setDisableToken}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error ? <p className="text-sm text-red-400">{error}</p> : null}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDisable}
                      variant="destructive"
                      disabled={isLoading || disableToken.length < 6}
                    >
                      {isLoading ? "Disabling..." : "Confirm Disable"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowDisable(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="destructive" onClick={() => setShowDisable(true)}>
                  Disable MFA
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <MfaSetup onComplete={() => {
            setMfaEnabled(true)
            router.refresh()
          }} />
        )}
      </main>
    </div>
    </AppShell>
  )
}
