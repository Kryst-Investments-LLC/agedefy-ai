"use client"

import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { GdprConsentCategory } from "@/lib/validators/workspace"
import { GDPR_CONSENT_CATEGORIES } from "@/lib/validators/workspace"

interface GdprConsentEntry {
  category: GdprConsentCategory
  granted: boolean
  grantedAt?: string | null
}

const CONSENT_LABELS: Record<GdprConsentCategory, { title: string; description: string }> = {
  "data-processing": {
    title: "Data Processing",
    description:
      "I consent to the processing of my personal health data in accordance with GDPR Article 6. This includes storage, analysis, and secure management of health biomarkers, lab results, and protocol data.",
  },
  "ai-health-info": {
    title: "AI-Generated Health Information",
    description:
      "I understand that AI-generated insights, predictions, and recommendations are for informational purposes only and do not constitute medical advice. I consent to receiving AI-generated health information through this platform.",
  },
  "research-usage": {
    title: "Research Data Usage",
    description:
      "I consent to the anonymized use of my de-identified health data for scientific research purposes, including longevity and biomedical studies. My data will be aggregated and anonymized before any research use.",
  },
}

interface ConsentCollectionProps {
  onComplete?: () => void
  mode?: "onboarding" | "settings"
}

export function ConsentCollection({ onComplete, mode = "onboarding" }: ConsentCollectionProps) {
  const [consents, setConsents] = useState<Record<GdprConsentCategory, boolean>>({
    "data-processing": false,
    "ai-health-info": false,
    "research-usage": false,
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/account/consent")
      .then((res) => res.json())
      .then((data) => {
        if (data.gdprConsents && Array.isArray(data.gdprConsents)) {
          const updated = { ...consents }
          for (const entry of data.gdprConsents as GdprConsentEntry[]) {
            if (entry.category in updated) {
              updated[entry.category as GdprConsentCategory] = entry.granted
            }
          }
          setConsents(updated)
        }
      })
      .catch(() => {
        /* ignore fetch errors on load */
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggle = useCallback((category: GdprConsentCategory, checked: boolean) => {
    setConsents((prev) => ({ ...prev, [category]: checked }))
  }, [])

  const allRequired = consents["data-processing"] && consents["ai-health-info"]

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    const gdprConsents: GdprConsentEntry[] = GDPR_CONSENT_CATEGORIES.map((cat) => ({
      category: cat,
      granted: consents[cat],
      grantedAt: consents[cat] ? new Date().toISOString() : null,
    }))

    try {
      const res = await fetch("/api/account/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "active",
          legalBasis: "explicit-consent",
          scopes: [{ resource: "biomarkers", permission: "read" }],
          gdprConsents,
          consentVersion: 1,
          policyVersion: "1.0",
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "Failed to save consent preferences")
        return
      }

      onComplete?.()
    } catch {
      setError("Network error — please try again")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading consent preferences…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {mode === "onboarding" ? "Welcome to Biozephyra" : "Consent Preferences"}
        </CardTitle>
        <CardDescription>
          {mode === "onboarding"
            ? "Before you begin, please review and grant the required consents below."
            : "Manage your data processing and AI consent preferences."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {GDPR_CONSENT_CATEGORIES.map((category) => {
          const label = CONSENT_LABELS[category]
          const isRequired = category !== "research-usage"
          return (
            <div key={category} className="flex items-start space-x-3">
              <Checkbox
                id={`consent-${category}`}
                checked={consents[category]}
                onCheckedChange={(checked) => handleToggle(category, checked === true)}
              />
              <div className="space-y-1 leading-none">
                <label
                  htmlFor={`consent-${category}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {label.title}
                  {isRequired && <span className="text-destructive ml-1">*</span>}
                </label>
                <p className="text-xs text-muted-foreground">{label.description}</p>
              </div>
            </div>
          )
        })}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            <span className="text-destructive">*</span> Required to use Biozephyra
          </p>
          <Button onClick={handleSubmit} disabled={!allRequired || submitting}>
            {submitting ? "Saving…" : mode === "onboarding" ? "Accept & Continue" : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
