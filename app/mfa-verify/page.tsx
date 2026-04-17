"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export default function MfaVerifyPage() {
  const router = useRouter()
  const { update } = useSession()
  const [otpValue, setOtpValue] = useState("")
  const [backupCode, setBackupCode] = useState("")
  const [useBackup, setUseBackup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const token = useBackup ? backupCode.trim() : otpValue
    if (!token) {
      setError("Please enter a code")
      setIsSubmitting(false)
      return
    }

    const res = await fetch("/api/account/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Verification failed")
      setIsSubmitting(false)
      return
    }

    // Trigger a session update to clear mfaPending
    await update()
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <Card className="w-full max-w-md border-gray-800 bg-gray-900 text-white">
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {useBackup ? (
              <div className="space-y-2">
                <Label htmlFor="backup-code">Backup Code</Label>
                <Input
                  id="backup-code"
                  type="text"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  placeholder="Enter backup code"
                  autoComplete="off"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <Label>Authentication Code</Label>
                <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
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
            )}

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <Button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Verifying..." : "Verify"}
            </Button>

            <button
              type="button"
              className="w-full text-center text-sm text-teal-400 hover:underline"
              onClick={() => setUseBackup(!useBackup)}
            >
              {useBackup ? "Use authenticator app instead" : "Use a backup code instead"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
