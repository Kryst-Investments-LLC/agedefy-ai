"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Step1Data {
  dateOfBirth: string
  biologicalSex: string
}
interface Step2Data {
  healthGoals: string[]
  primaryMotivation: string
  riskTolerance: string
}
interface Step3Data {
  healthConditions: string[]
  supplementStack: string[]
}
interface Step4Data {
  dietaryPattern: string
  activityLevel: string
  sleepQuality: number
  stressLevel: number
}

const HEALTH_GOAL_OPTIONS = [
  { value: "cognitive", label: "Cognitive Performance" },
  { value: "cardiovascular", label: "Cardiovascular Health" },
  { value: "metabolic", label: "Metabolic Health" },
  { value: "athletic", label: "Athletic Performance" },
  { value: "aesthetic", label: "Aesthetic / Anti-Aging" },
  { value: "sleep", label: "Sleep Quality" },
  { value: "hormonal", label: "Hormonal Balance" },
  { value: "immune", label: "Immune Function" },
]

const DIET_OPTIONS = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "keto", label: "Keto" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "paleo", label: "Paleo" },
  { value: "other", label: "Other" },
]

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light (1-2 days/week)" },
  { value: "moderate", label: "Moderate (3-4 days/week)" },
  { value: "active", label: "Active (5-6 days/week)" },
  { value: "very_active", label: "Very Active (daily)" },
]

const TOTAL_STEPS = 5

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
              i < current
                ? "bg-primary text-primary-foreground"
                : i === current
                  ? "border-2 border-primary text-primary"
                  : "border border-muted-foreground/30 text-muted-foreground"
            }`}
          >
            {i < current ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={`h-0.5 w-8 transition-colors ${
                i < current ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function RatingPicker({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  low: string
  high: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground w-16">{low}</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-md text-sm font-medium transition-colors ${
              n === value
                ? "bg-primary text-primary-foreground"
                : "border border-muted-foreground/30 hover:bg-muted"
            }`}
          >
            {n}
          </button>
        ))}
        <span className="text-xs text-muted-foreground w-16 text-right">{high}</span>
      </div>
    </div>
  )
}

function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string
  placeholder: string
  values: string[]
  onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState("")

  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInput("")
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-muted px-3 py-1.5 text-sm hover:bg-muted/80"
        >
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-muted-foreground hover:text-destructive"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [biologicalSex, setBiologicalSex] = useState("")

  // Step 2
  const [healthGoals, setHealthGoals] = useState<string[]>([])
  const [primaryMotivation, setPrimaryMotivation] = useState("")
  const [riskTolerance, setRiskTolerance] = useState("medium")

  // Step 3
  const [healthConditions, setHealthConditions] = useState<string[]>([])
  const [supplementStack, setSupplementStack] = useState<string[]>([])

  // Step 4
  const [dietaryPattern, setDietaryPattern] = useState("")
  const [activityLevel, setActivityLevel] = useState("")
  const [sleepQuality, setSleepQuality] = useState(3)
  const [stressLevel, setStressLevel] = useState(3)

  // Consent (captured on the final input step — the lawful basis for processing
  // the health data collected during onboarding).
  const [consentDataProcessing, setConsentDataProcessing] = useState(false)
  const [consentAiHealth, setConsentAiHealth] = useState(false)

  const [onboardingComplete, setOnboardingComplete] = useState(false)

  const canNext = (): boolean => {
    switch (step) {
      case 0:
        return !!dateOfBirth && !!biologicalSex
      case 1:
        return healthGoals.length > 0 && primaryMotivation.length >= 3 && !!riskTolerance
      case 2:
        return true // conditions + supplements are optional
      case 3:
        return !!dietaryPattern && !!activityLevel && consentDataProcessing
      case 4:
        return onboardingComplete // personalization screen — always navigable
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    const payload = {
      step1: { dateOfBirth, biologicalSex } as Step1Data,
      step2: { healthGoals, primaryMotivation, riskTolerance } as Step2Data,
      step3: { healthConditions, supplementStack } as Step3Data,
      step4: {
        dietaryPattern,
        activityLevel,
        sleepQuality,
        stressLevel,
      } as Step4Data,
      consent: {
        dataProcessing: consentDataProcessing,
        aiHealthInfo: consentAiHealth,
        policyVersion: "1.0",
      },
    }

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed: ${res.status}`)
      }
      setOnboardingComplete(true)
      setStep(4) // Go to personalization confirmation
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  const goToDashboard = () => {
    router.push("/dashboard")
    router.refresh()
  }

  // Build the personalized summary based on user selections
  const goalLabels = HEALTH_GOAL_OPTIONS.filter((o) =>
    healthGoals.includes(o.value)
  ).map((o) => o.label)

  const suggestedFirstAction = healthGoals.includes("cognitive")
    ? "Analyze my cognitive biomarkers and suggest a nootropic protocol"
    : healthGoals.includes("cardiovascular")
      ? "Review my cardiovascular markers and suggest interventions"
      : healthGoals.includes("metabolic")
        ? "Analyze my metabolic markers and flag any concerning trends"
        : "Analyze my biomarkers and suggest a personalized protocol"

  return (
    <div className="mx-auto max-w-xl">
      <StepIndicator current={step} total={TOTAL_STEPS} />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step 1 — Basics */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Welcome to Biozephyra</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Let&apos;s start with a few basics to personalise your experience.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date of Birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Biological Sex</label>
            <div className="flex gap-2">
              {["male", "female", "other", "prefer_not_to_say"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBiologicalSex(v)}
                  className={`rounded-md px-4 py-2 text-sm capitalize transition-colors ${
                    biologicalSex === v
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-muted"
                  }`}
                >
                  {v.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Goals */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Your Longevity Goals</h2>
            <p className="text-sm text-muted-foreground mt-1">
              What do you want to optimise? Select up to 5.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {HEALTH_GOAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setHealthGoals((prev) =>
                    prev.includes(opt.value)
                      ? prev.filter((g) => g !== opt.value)
                      : prev.length < 5
                        ? [...prev, opt.value]
                        : prev
                  )
                }}
                className={`rounded-md px-3 py-2.5 text-sm text-left transition-colors ${
                  healthGoals.includes(opt.value)
                    ? "bg-primary text-primary-foreground"
                    : "border hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Primary Motivation</label>
            <textarea
              value={primaryMotivation}
              onChange={(e) => setPrimaryMotivation(e.target.value)}
              placeholder="e.g. I want to stay sharp and active for my grandchildren"
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Risk Tolerance</label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRiskTolerance(v)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm capitalize transition-colors ${
                    riskTolerance === v
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-muted"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Health Snapshot */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Current Health Snapshot</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Optional — helps us tailor safer recommendations.
            </p>
          </div>
          <TagInput
            label="Existing Health Conditions"
            placeholder="e.g. Type 2 Diabetes, Hypertension"
            values={healthConditions}
            onChange={setHealthConditions}
          />
          <TagInput
            label="Current Supplement Stack"
            placeholder="e.g. Vitamin D 5000 IU, Omega-3"
            values={supplementStack}
            onChange={setSupplementStack}
          />
        </div>
      )}

      {/* Step 4 — Lifestyle */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Lifestyle Assessment</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Helps us understand your baseline for personalised protocols.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Dietary Pattern</label>
            <div className="grid grid-cols-2 gap-2">
              {DIET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDietaryPattern(opt.value)}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    dietaryPattern === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Activity Level</label>
            <div className="space-y-1.5">
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setActivityLevel(opt.value)}
                  className={`w-full rounded-md px-3 py-2 text-sm text-left transition-colors ${
                    activityLevel === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "border hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <RatingPicker
            label="Sleep Quality"
            value={sleepQuality}
            onChange={setSleepQuality}
            low="Poor"
            high="Excellent"
          />
          <RatingPicker
            label="Stress Level"
            value={stressLevel}
            onChange={setStressLevel}
            low="Low"
            high="Very High"
          />

          {/* Consent — required to process the health data collected above. */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
            <h3 className="text-sm font-semibold">Your consent</h3>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={consentDataProcessing}
                onChange={(e) => setConsentDataProcessing(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-muted-foreground/40"
              />
              <span className="text-sm text-muted-foreground">
                I consent to Biozephyra processing my health data (biomarkers, conditions,
                supplements, lifestyle) to provide personalised longevity insights, as described
                in the{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Terms
                </a>
                . <span className="text-destructive">(required)</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={consentAiHealth}
                onChange={(e) => setConsentAiHealth(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-muted-foreground/40"
              />
              <span className="text-sm text-muted-foreground">
                I additionally consent to my health information being used with AI features
                (analysis, coaching). <span className="text-muted-foreground/70">(optional)</span>
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Step 5 — Personalization Confirmation */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Your Experience is Personalized</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Here&apos;s how your inputs will shape Biozephyra for you.
              </p>
            </div>
          </div>

          {/* Goals activated */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Active Health Goals</h3>
            <div className="flex flex-wrap gap-1.5">
              {goalLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  ✓ {label}
                </span>
              ))}
            </div>
          </div>

          {/* Relevant compounds */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Compound Explorer Ready</h3>
            <p className="text-sm text-muted-foreground">
              The knowledge graph has been filtered to prioritize compounds relevant to
              your {goalLabels.length} selected goal{goalLabels.length !== 1 ? 's' : ''}.
              {supplementStack.length > 0 && (
                <> Your existing stack ({supplementStack.join(', ')}) will be checked for interactions.</>
              )}
            </p>
          </div>

          {/* Risk level */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Safety Profile</h3>
            <p className="text-sm text-muted-foreground">
              Risk tolerance set to <span className="font-medium capitalize">{riskTolerance}</span>.
              {riskTolerance === 'low' && ' We\'ll prioritize well-studied compounds with minimal side effects.'}
              {riskTolerance === 'medium' && ' We\'ll balance emerging research with established safety data.'}
              {riskTolerance === 'high' && ' We\'ll include cutting-edge compounds but flag safety considerations prominently.'}
            </p>
          </div>

          {/* Suggested first action */}
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Suggested First Action</h3>
            <p className="text-sm text-muted-foreground">
              Try the Bio-Agent with this personalized prompt:
            </p>
            <p className="rounded-md border bg-background px-3 py-2 text-sm font-medium italic">
              &ldquo;{suggestedFirstAction}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {step < 4 ? (
          <>
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="inline-flex items-center gap-1 rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            {step < TOTAL_STEPS - 2 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canNext() || submitting}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    Complete <Check className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <div className="flex w-full justify-end">
            <button
              type="button"
              onClick={goToDashboard}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4" />
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
