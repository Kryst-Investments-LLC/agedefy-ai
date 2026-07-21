"use client"

import { useState } from "react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"

type MfaSetupProps = {
  onComplete: () => void
}

export function MfaSetup({ onComplete }: MfaSetupProps) {
  const [step, setStep] = useState<"idle" | "scan" | "verify" | "done">("idle")
  const [qrCodeDataUri, setQrCodeDataUri] = useState("")
  const [secret, setSecret] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [otpValue, setOtpValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleBeginSetup = async () => {
    setIsLoading(true)
    setError(null)
    const res = await fetch("/api/account/mfa", { method: "POST" })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to generate MFA secret")
      setIsLoading(false)
      return
    }
    const data = await res.json()
    setQrCodeDataUri(data.qrCodeDataUri)
    setSecret(data.secret)
    setBackupCodes(data.backupCodes)
    setStep("scan")
    setIsLoading(false)
  }

  const handleVerify = async () => {
    setIsLoading(true)
    setError(null)
    const res = await fetch("/api/account/mfa", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: otpValue }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Verification failed")
      setIsLoading(false)
      return
    }
    setStep("done")
    setIsLoading(false)
  }

  if (step === "idle") {
    return (
      <Card className="border-border bg-background text-foreground">
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <Button
            onClick={handleBeginSetup}
            className="bg-teal-600 hover:bg-teal-700"
            disabled={isLoading}
          >
            {isLoading ? "Generating..." : "Enable Two-Factor Authentication"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (step === "scan") {
    return (
      <Card className="border-border bg-background text-foreground">
        <CardHeader>
          <CardTitle>Scan QR Code</CardTitle>
          <CardDescription>
            Scan this code with your authenticator app (Google Authenticator, Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {qrCodeDataUri ? (
            <div className="flex justify-center">
              <Image src={qrCodeDataUri} alt="MFA QR Code" width={200} height={200} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Manual Entry Key</Label>
            <code className="block rounded bg-card p-2 text-sm text-teal-600 dark:text-teal-400 break-all">
              {secret}
            </code>
          </div>
          <div className="space-y-2">
            <Label>Backup Codes</Label>
            <p className="text-xs text-muted-foreground">
              Save these codes securely. Each can be used once if you lose access to your authenticator.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code) => (
                <code key={code} className="rounded bg-card p-1 text-center text-sm text-muted-foreground">
                  {code}
                </code>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Label>Enter Verification Code</Label>
            <div className="flex justify-center">
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
          </div>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          <Button
            onClick={handleVerify}
            className="w-full bg-teal-600 hover:bg-teal-700"
            disabled={isLoading || otpValue.length !== 6}
          >
            {isLoading ? "Verifying..." : "Verify and Enable"}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // done
  return (
    <Card className="border-border bg-background text-foreground">
      <CardHeader>
        <CardTitle>MFA Enabled</CardTitle>
        <CardDescription>
          Two-factor authentication is now active on your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onComplete} className="bg-teal-600 hover:bg-teal-700">
          Done
        </Button>
      </CardContent>
    </Card>
  )
}
