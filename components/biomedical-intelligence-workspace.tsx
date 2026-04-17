"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type EvidenceRecord = {
  id: string
  title: string
  diseaseArea: string | null
  sourceLabel: string
  studyType: string
  evidenceDirection: string
  evidenceScore: number
  reviewStatus: string
  provenanceType: string
  provenanceDetail: string | null
  automationSource: string | null
  verificationNotes: string | null
  reviewConfidence: number
  sourceCapturedAt: string | Date | null
  reviewedAt: string | Date | null
  reviewed: boolean
  reviewedByUser: { id: string; email: string | null; name: string | null } | null
  assignedReviewer: { id: string; email: string | null; name: string | null; role: string } | null
  reviewEvents: Array<{
    id: string
    eventType: string
    previousStatus: string | null
    nextStatus: string | null
    previousAssignedReviewerId: string | null
    nextAssignedReviewerId: string | null
    notes: string | null
    createdAt: string | Date
  }>
  researchEntry: { id: string; source: string; externalId: string | null } | null
}

type HypothesisRecord = {
  id: string
  title: string
  targetCondition: string | null
  status: string
  priorityScore: number
  averageEvidenceScore: number
  evidenceCoverageScore: number
  contraindicationScore: number
  confidenceScore: number
  uncertaintyScore: number
  evidenceLinks: { evidenceRecord: { id: string; title: string; evidenceScore: number; reviewStatus: string } }[]
  priorityChanges: Array<{
    id: string
    previousPriorityScore: number
    newPriorityScore: number
    previousConfidenceScore: number
    newConfidenceScore: number
    previousStatus: string
    newStatus: string
    delta: number
    rationale: string | null
    createdAt: string | Date
    evidenceRecord: { id: string; title: string }
    evidenceReviewEvent: { id: string; eventType: string; previousStatus: string | null; nextStatus: string | null; notes: string | null; createdAt: string | Date }
  }>
}

type CohortRecord = {
  id: string
  name: string
  focusArea: string
  cohortSize: number
  exclusionCriteria: string | null
  biomarkerFocus: string[]
  stratificationAxes: string[]
  stratificationSummary: string | null
  estimatedEligibleShare: number
  confidenceScore: number
  readinessScore: number
  riskBand: string
  calibration: {
    matchedOutcomeCount: number
    averageObservedConfidence: number
    averageDeltaMagnitude: number
    calibrationConfidenceAdjustment: number
    calibrationReadinessAdjustment: number
    calibratedConfidenceScore: number
    calibratedReadinessScore: number
    backtestSummary: string
  }
  _count?: { trialMatches: number }
}

type OutcomeRecord = {
  id: string
  biomarkerName: string
  baselineValue: number
  latestValue: number
  delta: number
  confidenceScore: number
  protocol: { id: string; name: string; status: string } | null
}

type TrialMatchRecord = {
  id: string
  trialExternalId: string
  title: string
  condition: string | null
  matchScore: number
  status: string
  cohort: { id: string; name: string; focusArea: string } | null
  assignedReviewer: { id: string; email: string | null; name: string | null; role: string } | null
  reviewNotes: string | null
  reviewEvents: Array<{
    id: string
    eventType: string
    previousStatus: string | null
    nextStatus: string | null
    previousAssignedReviewerId: string | null
    nextAssignedReviewerId: string | null
    notes: string | null
    createdAt: string | Date
  }>
}

type Props = {
  evidence: EvidenceRecord[]
  hypotheses: HypothesisRecord[]
  cohorts: CohortRecord[]
  outcomes: OutcomeRecord[]
  trialMatches: TrialMatchRecord[]
  analytics: {
    autoLinkedEvidenceCount: number
    reviewedEvidenceCount: number
    queuedEvidenceCount: number
    topDiseaseAreas: Array<{ label: string; count: number }>
    topCohortFocusAreas: Array<{ label: string; count: number }>
    hypothesisQueue: Array<{ label: string; count: number }>
    averageCohortConfidence: number
    averageTrialMatchScore: number
    averageOutcomeConfidence: number
  }
  reviewers: Array<{ id: string; name: string | null; email: string | null; role: string }>
  currentUserRole: string
}

function prettyLabel(value: string) {
  return value.toLowerCase().replace(/_/g, " ")
}

function badgeClasses(value: string) {
  if (value === "VERIFIED" || value === "PRIORITIZED") return "border-emerald-700 bg-emerald-950 text-emerald-300"
  if (value === "REJECTED") return "border-red-800 bg-red-950 text-red-300"
  if (value === "ESCALATED" || value === "COMPLEX") return "border-amber-700 bg-amber-950 text-amber-300"
  return "border-gray-700 bg-gray-900 text-gray-300"
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? "Request failed")
  }
  return body
}

export function BiomedicalIntelligenceWorkspace({ evidence, hypotheses, cohorts, outcomes, trialMatches, analytics, reviewers, currentUserRole }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { reviewStatus: string; verificationNotes: string; assignedReviewerId: string }>>({})
  const [trialReviewDrafts, setTrialReviewDrafts] = useState<Record<string, { status: string; reviewNotes: string; assignedReviewerId: string }>>({})
  const canReviewTrialMatches = currentUserRole === "ADMIN" || currentUserRole === "CLINICIAN" || currentUserRole === "RESEARCHER"

  const updateTrialReviewDraft = (trialMatchId: string, patch: Partial<{ status: string; reviewNotes: string; assignedReviewerId: string }>) => {
    setTrialReviewDrafts((current) => ({
      ...current,
      [trialMatchId]: {
        status: current[trialMatchId]?.status ?? "IN_REVIEW",
        reviewNotes: current[trialMatchId]?.reviewNotes ?? "",
        assignedReviewerId: current[trialMatchId]?.assignedReviewerId ?? "",
        ...patch,
      },
    }))
  }

  const submitTrialMatchReview = async (trialMatchId: string) => {
    const draft = trialReviewDrafts[trialMatchId] ?? { status: "IN_REVIEW", reviewNotes: "", assignedReviewerId: "" }
    setSaving(`trial-review-${trialMatchId}`)
    setError(null)
    try {
      await requestJson("/api/intelligence/trial-matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: trialMatchId,
          status: draft.status,
          assignedReviewerId: draft.assignedReviewerId || undefined,
          reviewNotes: draft.reviewNotes || undefined,
        }),
      })
      refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to review trial match")
    } finally {
      setSaving(null)
    }
  }

  const [evidenceForm, setEvidenceForm] = useState({
    title: "",
    diseaseArea: "",
    sourceLabel: "PubMed / manual review",
    studyType: "RCT",
    evidenceDirection: "SUPPORTIVE",
    abstract: "",
  })
  const [hypothesisForm, setHypothesisForm] = useState({
    title: "",
    targetCondition: "",
    question: "",
    rationale: "",
    suggestedInterventions: "",
    evidenceRecordIds: [] as string[],
  })
  const [cohortForm, setCohortForm] = useState({
    name: "",
    focusArea: "",
    inclusionCriteria: "",
    exclusionCriteria: "",
    biomarkerFocus: "",
  })
  const [outcomeForm, setOutcomeForm] = useState({
    biomarkerName: "",
    baselineValue: "",
    latestValue: "",
    notes: "",
  })
  const [trialForm, setTrialForm] = useState({
    trialExternalId: "",
    title: "",
    condition: "",
    matchScore: "0.65",
    rationale: "",
    cohortId: "",
  })

  const refresh = () => router.refresh()
  const canReviewEvidence = currentUserRole === "ADMIN" || currentUserRole === "CLINICIAN" || currentUserRole === "RESEARCHER"

  const toggleEvidenceSelection = (evidenceId: string) => {
    setHypothesisForm((current) => ({
      ...current,
      evidenceRecordIds: current.evidenceRecordIds.includes(evidenceId)
        ? current.evidenceRecordIds.filter((value) => value !== evidenceId)
        : [...current.evidenceRecordIds, evidenceId],
    }))
  }

  const updateReviewDraft = (evidenceId: string, patch: Partial<{ reviewStatus: string; verificationNotes: string; assignedReviewerId: string }>) => {
    setReviewDrafts((current) => ({
      ...current,
      [evidenceId]: {
        reviewStatus: current[evidenceId]?.reviewStatus ?? "IN_REVIEW",
        verificationNotes: current[evidenceId]?.verificationNotes ?? "",
        assignedReviewerId: current[evidenceId]?.assignedReviewerId ?? "",
        ...patch,
      },
    }))
  }

  const submitEvidence = async () => {
    setSaving("evidence")
    setError(null)
    try {
      await requestJson("/api/intelligence/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(evidenceForm),
      })
      setEvidenceForm({
        title: "",
        diseaseArea: "",
        sourceLabel: "PubMed / manual review",
        studyType: "RCT",
        evidenceDirection: "SUPPORTIVE",
        abstract: "",
      })
      refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save evidence")
    } finally {
      setSaving(null)
    }
  }

  const submitHypothesis = async () => {
    setSaving("hypothesis")
    setError(null)
    try {
      await requestJson("/api/intelligence/hypotheses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...hypothesisForm,
          evidenceRecordIds: hypothesisForm.evidenceRecordIds,
          suggestedInterventions: hypothesisForm.suggestedInterventions
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      })
      setHypothesisForm({ title: "", targetCondition: "", question: "", rationale: "", suggestedInterventions: "", evidenceRecordIds: [] })
      refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save hypothesis")
    } finally {
      setSaving(null)
    }
  }

  const submitCohort = async () => {
    setSaving("cohort")
    setError(null)
    try {
      await requestJson("/api/intelligence/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...cohortForm,
          biomarkerFocus: cohortForm.biomarkerFocus
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      })
      setCohortForm({ name: "", focusArea: "", inclusionCriteria: "", exclusionCriteria: "", biomarkerFocus: "" })
      refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save cohort")
    } finally {
      setSaving(null)
    }
  }

  const submitOutcome = async () => {
    setSaving("outcome")
    setError(null)
    try {
      await requestJson("/api/intelligence/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outcomeForm),
      })
      setOutcomeForm({ biomarkerName: "", baselineValue: "", latestValue: "", notes: "" })
      refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save outcome")
    } finally {
      setSaving(null)
    }
  }

  const submitTrialMatch = async () => {
    setSaving("trial")
    setError(null)
    try {
      await requestJson("/api/intelligence/trial-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trialForm),
      })
      setTrialForm({ trialExternalId: "", title: "", condition: "", matchScore: "0.65", rationale: "", cohortId: "" })
      refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save trial match")
    } finally {
      setSaving(null)
    }
  }

  const submitEvidenceReview = async (evidenceId: string) => {
    const draft = reviewDrafts[evidenceId] ?? { reviewStatus: "IN_REVIEW", verificationNotes: "", assignedReviewerId: "" }
    setSaving(`review-${evidenceId}`)
    setError(null)
    try {
      await requestJson("/api/intelligence/evidence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: evidenceId,
          reviewStatus: draft.reviewStatus,
          assignedReviewerId: draft.assignedReviewerId || undefined,
          verificationNotes: draft.verificationNotes || undefined,
        }),
      })
      refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to review evidence")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-8">
      {error ? <p className="rounded-xl border border-red-800 bg-red-950 p-3 text-sm text-red-300">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-5">
        {[
          { label: "Evidence records", value: evidence.length },
          { label: "Hypotheses", value: hypotheses.length },
          { label: "Cohorts", value: cohorts.length },
          { label: "Outcomes", value: outcomes.length },
          { label: "Trial matches", value: trialMatches.length },
        ].map((item) => (
          <Card key={item.label} className="bg-gray-950 border-gray-800 text-white">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-400">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-gray-800 bg-gray-950 text-white">
          <CardHeader>
            <CardTitle>Discovery analytics</CardTitle>
            <CardDescription className="text-gray-400">Operational visibility into evidence automation, cohort focus, and pipeline quality.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Auto-linked evidence", value: analytics.autoLinkedEvidenceCount },
              { label: "Reviewed evidence", value: analytics.reviewedEvidenceCount },
              { label: "Queued evidence", value: analytics.queuedEvidenceCount },
              { label: "Avg trial match", value: analytics.averageTrialMatchScore },
              { label: "Avg cohort confidence", value: analytics.averageCohortConfidence },
              { label: "Avg outcome confidence", value: analytics.averageOutcomeConfidence },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gray-800 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-950 text-white">
          <CardHeader>
            <CardTitle>Pipeline queues</CardTitle>
            <CardDescription className="text-gray-400">Where the research program is concentrated right now.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Top disease areas</p>
              <div className="mt-3 space-y-2">
                {(analytics.topDiseaseAreas.length ? analytics.topDiseaseAreas : [{ label: "Unclassified", count: 0 }]).map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2 text-sm">
                    <span>{item.label}</span>
                    <span className="text-gray-400">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Hypothesis queue</p>
              <div className="mt-3 space-y-2">
                {(analytics.hypothesisQueue.length ? analytics.hypothesisQueue : [{ label: "No hypotheses", count: 0 }]).map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2 text-sm">
                    <span>{item.label}</span>
                    <span className="text-gray-400">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-gray-950 border-gray-800 text-white">
          <CardHeader>
            <CardTitle>Evidence intake</CardTitle>
            <CardDescription className="text-gray-400">Capture ranked biomedical evidence with disease context and study design metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Evidence title" value={evidenceForm.title} onChange={(event) => setEvidenceForm((current) => ({ ...current, title: event.target.value }))} />
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Disease area" value={evidenceForm.diseaseArea} onChange={(event) => setEvidenceForm((current) => ({ ...current, diseaseArea: event.target.value }))} />
              <Input placeholder="Source label" value={evidenceForm.sourceLabel} onChange={(event) => setEvidenceForm((current) => ({ ...current, sourceLabel: event.target.value }))} />
              <select className="h-10 rounded-md border border-gray-800 bg-gray-900 px-3 text-sm text-white" value={evidenceForm.studyType} onChange={(event) => setEvidenceForm((current) => ({ ...current, studyType: event.target.value }))}>
                {['RCT', 'META_ANALYSIS', 'SYSTEMATIC_REVIEW', 'OBSERVATIONAL', 'MECHANISTIC', 'ANIMAL', 'IN_VITRO', 'CASE_SERIES', 'EXPERT_OPINION'].map((studyType) => <option key={studyType} value={studyType}>{studyType}</option>)}
              </select>
              <select className="h-10 rounded-md border border-gray-800 bg-gray-900 px-3 text-sm text-white" value={evidenceForm.evidenceDirection} onChange={(event) => setEvidenceForm((current) => ({ ...current, evidenceDirection: event.target.value }))}>
                {['SUPPORTIVE', 'MIXED', 'NEUTRAL', 'CONTRADICTORY'].map((direction) => <option key={direction} value={direction}>{direction}</option>)}
              </select>
            </div>
            <Textarea placeholder="Abstract or evidence summary" value={evidenceForm.abstract} onChange={(event) => setEvidenceForm((current) => ({ ...current, abstract: event.target.value }))} rows={4} />
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={submitEvidence} disabled={saving === "evidence"}>{saving === "evidence" ? "Saving…" : "Save evidence"}</Button>
            <div className="space-y-2 pt-3">
              {evidence.slice(0, 5).map((record) => (
                <div key={record.id} className="rounded-xl border border-gray-800 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-medium">{record.title}</p>
                    <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeClasses(record.reviewStatus)}`}>{prettyLabel(record.reviewStatus)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{record.studyType} · {record.evidenceDirection.toLowerCase()} · score {record.evidenceScore}</p>
                  <p className="mt-1 text-xs text-gray-500">{record.sourceLabel}{record.researchEntry?.externalId ? ` · ${record.researchEntry.externalId}` : ""} · provenance {prettyLabel(record.provenanceType)}</p>
                  <p className="mt-1 text-xs text-gray-500">review confidence {record.reviewConfidence}{record.reviewedByUser?.email ? ` · reviewer ${record.reviewedByUser.email}` : ""}{record.assignedReviewer?.email ? ` · assigned ${record.assignedReviewer.email}` : ""}</p>
                  {record.provenanceDetail ? <p className="mt-2 text-xs text-gray-400">{record.provenanceDetail}</p> : null}
                  {canReviewEvidence ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-[180px_220px_1fr_auto]">
                      <select className="h-10 rounded-md border border-gray-800 bg-gray-900 px-3 text-sm text-white" value={reviewDrafts[record.id]?.reviewStatus ?? record.reviewStatus} onChange={(event) => updateReviewDraft(record.id, { reviewStatus: event.target.value })}>
                        {['AUTO_QUEUED', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'ESCALATED'].map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <select className="h-10 rounded-md border border-gray-800 bg-gray-900 px-3 text-sm text-white" value={reviewDrafts[record.id]?.assignedReviewerId ?? record.assignedReviewer?.id ?? ""} onChange={(event) => updateReviewDraft(record.id, { assignedReviewerId: event.target.value })}>
                        <option value="">Unassigned reviewer</option>
                        {reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.email ?? reviewer.name ?? reviewer.id} · {reviewer.role}</option>)}
                      </select>
                      <Input placeholder="Reviewer notes" value={reviewDrafts[record.id]?.verificationNotes ?? record.verificationNotes ?? ""} onChange={(event) => updateReviewDraft(record.id, { verificationNotes: event.target.value })} />
                      <Button variant="outline" className="border-gray-700 text-gray-200 hover:bg-gray-800" onClick={() => submitEvidenceReview(record.id)} disabled={saving === `review-${record.id}`}>{saving === `review-${record.id}` ? "Saving…" : "Update"}</Button>
                    </div>
                  ) : null}
                  {record.reviewEvents.length ? (
                    <div className="mt-3 rounded-xl border border-gray-800 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Review history</p>
                      <div className="mt-3 space-y-2">
                        {record.reviewEvents.map((event) => (
                          <div key={event.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                            <span className="rounded-full border border-gray-700 px-2 py-1 text-[11px] uppercase">{prettyLabel(event.eventType)}</span>
                            <span>{event.previousStatus ? prettyLabel(event.previousStatus) : 'none'} → {event.nextStatus ? prettyLabel(event.nextStatus) : 'none'}</span>
                            <span>{new Date(event.createdAt).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-950 border-gray-800 text-white">
          <CardHeader>
            <CardTitle>Hypothesis engine</CardTitle>
            <CardDescription className="text-gray-400">Capture disease and longevity hypotheses with intervention candidates and uncertainty-aware prioritization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Hypothesis title" value={hypothesisForm.title} onChange={(event) => setHypothesisForm((current) => ({ ...current, title: event.target.value }))} />
            <Input placeholder="Target condition" value={hypothesisForm.targetCondition} onChange={(event) => setHypothesisForm((current) => ({ ...current, targetCondition: event.target.value }))} />
            <Textarea placeholder="Research question" value={hypothesisForm.question} onChange={(event) => setHypothesisForm((current) => ({ ...current, question: event.target.value }))} rows={3} />
            <Textarea placeholder="Mechanistic rationale" value={hypothesisForm.rationale} onChange={(event) => setHypothesisForm((current) => ({ ...current, rationale: event.target.value }))} rows={4} />
            <Input placeholder="Suggested interventions, comma separated" value={hypothesisForm.suggestedInterventions} onChange={(event) => setHypothesisForm((current) => ({ ...current, suggestedInterventions: event.target.value }))} />
            <div className="rounded-xl border border-gray-800 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Evidence selection</p>
              <div className="mt-3 grid gap-2">
                {evidence.slice(0, 8).map((record) => {
                  const selected = hypothesisForm.evidenceRecordIds.includes(record.id)
                  return (
                    <button key={record.id} type="button" className={`rounded-lg border px-3 py-3 text-left ${selected ? 'border-teal-600 bg-teal-950/40' : 'border-gray-800 bg-gray-900'}`} onClick={() => toggleEvidenceSelection(record.id)}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{record.title}</span>
                        <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeClasses(record.reviewStatus)}`}>{prettyLabel(record.reviewStatus)}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">score {record.evidenceScore} · {record.studyType}</p>
                    </button>
                  )
                })}
              </div>
            </div>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={submitHypothesis} disabled={saving === "hypothesis"}>{saving === "hypothesis" ? "Saving…" : "Save hypothesis"}</Button>
            <div className="space-y-2 pt-3">
              {hypotheses.slice(0, 5).map((record) => (
                <div key={record.id} className="rounded-xl border border-gray-800 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-medium">{record.title}</p>
                    <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeClasses(record.status)}`}>{prettyLabel(record.status)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{record.status.toLowerCase()} · confidence {record.confidenceScore} · uncertainty {record.uncertaintyScore}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    {/* Priority, Evidence avg, Coverage as before */}
                    <div className="rounded-lg border border-gray-800 px-3 py-2 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Priority</p>
                      <p className="mt-1 font-medium">{record.priorityScore}</p>
                    </div>
                    <div className="rounded-lg border border-gray-800 px-3 py-2 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Evidence avg</p>
                      <p className="mt-1 font-medium">{record.averageEvidenceScore}</p>
                    </div>
                    <div className="rounded-lg border border-gray-800 px-3 py-2 text-sm">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Coverage</p>
                      <p className="mt-1 font-medium">{record.evidenceCoverageScore}</p>
                    </div>
                    {/* Contraindication with color band, tooltip, and warning */}
                    <div className={`rounded-lg border px-3 py-2 text-sm ${
                      record.contraindicationScore >= 0.7
                        ? 'border-red-800 bg-red-950 text-red-300'
                        : record.contraindicationScore >= 0.4
                        ? 'border-amber-700 bg-amber-950 text-amber-300'
                        : 'border-emerald-700 bg-emerald-950 text-emerald-300'
                    }`}>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 flex items-center gap-1">
                        Contraindication
                        <span title="A higher score indicates greater risk of adverse interactions or safety concerns. Scores ≥ 0.7 are high risk, 0.4–0.7 moderate, < 0.4 low.">
                          ⓘ
                        </span>
                      </p>
                      <p className="mt-1 font-medium flex items-center gap-2">
                        {record.contraindicationScore}
                        {record.contraindicationScore >= 0.7 && <span className="ml-2 text-xs font-bold">⚠️ High risk</span>}
                        {record.contraindicationScore >= 0.4 && record.contraindicationScore < 0.7 && <span className="ml-2 text-xs font-bold">Moderate</span>}
                        {record.contraindicationScore < 0.4 && <span className="ml-2 text-xs font-bold">Low</span>}
                      </p>
                      {/* Example breakdown (placeholder, replace with real breakdown if available) */}
                      <div className="mt-1 text-xs text-gray-400">
                        <span>Score breakdown: </span>
                        <span title="Placeholder: Replace with real breakdown if available">biomarker, compound, protocol factors</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {record.evidenceLinks.map((link) => (
                      <span key={link.evidenceRecord.id} className={`rounded-full border px-2 py-1 text-xs ${badgeClasses(link.evidenceRecord.reviewStatus)}`}>
                        {link.evidenceRecord.title}
                      </span>
                    ))}
                  </div>
                  {record.priorityChanges.length ? (
                    <div className="mt-4 rounded-xl border border-gray-800 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Priority change graph</p>
                      <div className="mt-3 space-y-3">
                        {record.priorityChanges.map((change) => (
                          <div key={change.id} className="rounded-lg border border-gray-800 p-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                              <span className="rounded-full border border-gray-700 px-2 py-1">{change.evidenceRecord.title}</span>
                              <span>→</span>
                              <span className="rounded-full border border-gray-700 px-2 py-1">{prettyLabel(change.evidenceReviewEvent.eventType)}</span>
                              <span>→</span>
                              <span className="rounded-full border border-gray-700 px-2 py-1">priority {change.previousPriorityScore} to {change.newPriorityScore}</span>
                            </div>
                            <p className="mt-2 text-xs text-gray-400">{change.previousStatus.toLowerCase()} → {change.newStatus.toLowerCase()} · delta {change.delta} · {new Date(change.createdAt).toLocaleString()}</p>
                            {change.rationale ? <p className="mt-2 text-sm text-gray-300">{change.rationale}</p> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-950 border-gray-800 text-white">
          <CardHeader>
            <CardTitle>Cohort design</CardTitle>
            <CardDescription className="text-gray-400">Define target cohorts for stratification, retrospective analysis, and trial readiness.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Cohort name" value={cohortForm.name} onChange={(event) => setCohortForm((current) => ({ ...current, name: event.target.value }))} />
            <Input placeholder="Focus area" value={cohortForm.focusArea} onChange={(event) => setCohortForm((current) => ({ ...current, focusArea: event.target.value }))} />
            <Textarea placeholder="Inclusion criteria" value={cohortForm.inclusionCriteria} onChange={(event) => setCohortForm((current) => ({ ...current, inclusionCriteria: event.target.value }))} rows={4} />
            <Textarea placeholder="Exclusion criteria" value={cohortForm.exclusionCriteria} onChange={(event) => setCohortForm((current) => ({ ...current, exclusionCriteria: event.target.value }))} rows={3} />
            <Input placeholder="Biomarker focus, comma separated" value={cohortForm.biomarkerFocus} onChange={(event) => setCohortForm((current) => ({ ...current, biomarkerFocus: event.target.value }))} />
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={submitCohort} disabled={saving === "cohort"}>{saving === "cohort" ? "Saving…" : "Save cohort"}</Button>
            <div className="space-y-2 pt-3">
              {cohorts.slice(0, 5).map((record) => (
                <div key={record.id} className="rounded-xl border border-gray-800 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-medium">{record.name}</p>
                    <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeClasses(record.riskBand)}`}>{prettyLabel(record.riskBand)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{record.focusArea} · {record.cohortSize} members · {record._count?.trialMatches ?? 0} trial matches</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {[
                      { label: 'Confidence', value: record.confidenceScore },
                      { label: 'Eligibility', value: record.estimatedEligibleShare },
                      { label: 'Readiness', value: record.readinessScore },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-gray-800 px-3 py-2 text-sm">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{item.label}</p>
                        <p className="mt-1 font-medium">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {record.stratificationSummary ? <p className="mt-3 text-sm text-gray-300">{record.stratificationSummary}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {record.stratificationAxes.map((axis) => <span key={axis} className="rounded-full border border-gray-700 px-2 py-1 text-xs text-gray-300">{axis}</span>)}
                  </div>
                  <div className="mt-4 rounded-xl border border-gray-800 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Outcome backtest</p>
                    <div className="mt-3 grid gap-2 md:grid-cols-4">
                      {[
                        { label: 'Matched outcomes', value: record.calibration.matchedOutcomeCount },
                        { label: 'Observed confidence', value: record.calibration.averageObservedConfidence },
                        { label: 'Calibrated confidence', value: record.calibration.calibratedConfidenceScore },
                        { label: 'Calibrated readiness', value: record.calibration.calibratedReadinessScore },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-gray-800 px-3 py-2 text-sm">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{item.label}</p>
                          <p className="mt-1 font-medium">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-gray-300">{record.calibration.backtestSummary}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-gray-800 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Top cohort focus areas</p>
              <div className="mt-3 space-y-2">
                {(analytics.topCohortFocusAreas.length ? analytics.topCohortFocusAreas : [{ label: "No cohorts", count: 0 }]).map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="text-gray-400">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-950 border-gray-800 text-white">
          <CardHeader>
            <CardTitle>Outcome learning loop</CardTitle>
            <CardDescription className="text-gray-400">Track biomarker deltas over time so the platform compounds intervention-outcome intelligence. Visualize time series, compare protocols, and see confidence intervals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Biomarker name" value={outcomeForm.biomarkerName} onChange={(event) => setOutcomeForm((current) => ({ ...current, biomarkerName: event.target.value }))} />
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Baseline value" type="number" value={outcomeForm.baselineValue} onChange={(event) => setOutcomeForm((current) => ({ ...current, baselineValue: event.target.value }))} />
              <Input placeholder="Latest value" type="number" value={outcomeForm.latestValue} onChange={(event) => setOutcomeForm((current) => ({ ...current, latestValue: event.target.value }))} />
            </div>
            <Textarea placeholder="Outcome notes" value={outcomeForm.notes} onChange={(event) => setOutcomeForm((current) => ({ ...current, notes: event.target.value }))} rows={3} />
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={submitOutcome} disabled={saving === "outcome"}>{saving === "outcome" ? "Saving…" : "Save outcome"}</Button>
            {/* Time series chart for outcomes */}
            {outcomes.length > 1 && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={outcomes.map(o => ({
                    name: o.biomarkerName,
                    baseline: o.baselineValue,
                    latest: o.latestValue,
                    delta: o.delta,
                    confidence: o.confidenceScore,
                    protocol: o.protocol?.name || "Unassigned"
                  }))} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: "8px" }} labelStyle={{ color: "#888" }} />
                    <Line type="monotone" dataKey="baseline" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Baseline" />
                    <Line type="monotone" dataKey="latest" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} name="Latest" />
                    <Line type="monotone" dataKey="delta" stroke="#f59e42" strokeWidth={2} dot={{ r: 3 }} name="Delta" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Protocol comparison and confidence intervals */}
            {outcomes.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">Protocol Comparison</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {Array.from(new Set(outcomes.map(o => o.protocol?.name || "Unassigned"))).map(protocolName => (
                    <div key={protocolName} className="rounded border border-gray-700 p-2">
                      <div className="font-medium text-xs mb-1">{protocolName}</div>
                      {outcomes.filter(o => (o.protocol?.name || "Unassigned") === protocolName).map(o => (
                        <div key={o.id} className="flex items-center justify-between text-xs">
                          <span>{o.biomarkerName}</span>
                          <span>Δ {o.delta}</span>
                          <span>Conf: <span title="Confidence interval estimate">{o.confidenceScore}</span></span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2 pt-3">
              {outcomes.slice(0, 5).map((record) => (
                <div key={record.id} className="rounded-xl border border-gray-800 p-3">
                  <p className="font-medium">{record.biomarkerName}</p>
                  <p className="mt-1 text-xs text-gray-400">baseline {record.baselineValue} → latest {record.latestValue} · delta {record.delta}</p>
                  <p className="mt-1 text-xs text-gray-500">protocol: {record.protocol?.name || "Unassigned"} · confidence: <span title="Confidence interval estimate">{record.confidenceScore}</span></p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-950 border-gray-800 text-white xl:col-span-2">
          <CardHeader>
            <CardTitle>Trial matching workspace</CardTitle>
            <CardDescription className="text-gray-400">Persist trial candidates with rationale and cohort context for enrollment review and follow-through.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Input placeholder="Trial ID" value={trialForm.trialExternalId} onChange={(event) => setTrialForm((current) => ({ ...current, trialExternalId: event.target.value }))} />
              <Input placeholder="Trial title" value={trialForm.title} onChange={(event) => setTrialForm((current) => ({ ...current, title: event.target.value }))} />
              <Input placeholder="Condition" value={trialForm.condition} onChange={(event) => setTrialForm((current) => ({ ...current, condition: event.target.value }))} />
              <Input placeholder="Match score" type="number" step="0.01" value={trialForm.matchScore} onChange={(event) => setTrialForm((current) => ({ ...current, matchScore: event.target.value }))} />
            </div>
            <select className="h-10 rounded-md border border-gray-800 bg-gray-900 px-3 text-sm text-white" value={trialForm.cohortId} onChange={(event) => setTrialForm((current) => ({ ...current, cohortId: event.target.value }))}>
              <option value="">No linked cohort</option>
              {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}
            </select>
            <Textarea placeholder="Why this trial is a fit" value={trialForm.rationale} onChange={(event) => setTrialForm((current) => ({ ...current, rationale: event.target.value }))} rows={4} />
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={submitTrialMatch} disabled={saving === "trial"}>{saving === "trial" ? "Saving…" : "Save trial match"}</Button>
            <div className="grid gap-3 pt-3 md:grid-cols-2">
              {trialMatches.slice(0, 6).map((record) => (
                <div key={record.id} className="rounded-xl border border-gray-800 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-medium">{record.title}</p>
                    <span className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeClasses(record.status)}`}>{prettyLabel(record.status)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">{record.trialExternalId} · score {record.matchScore} · {record.status.toLowerCase()}</p>
                  <p className="mt-1 text-xs text-gray-500">{record.cohort?.name ? `Cohort: ${record.cohort.name}` : "No cohort linked"}</p>
                  {canReviewTrialMatches ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-[180px_220px_1fr_auto]">
                      <select className="h-10 rounded-md border border-gray-800 bg-gray-900 px-3 text-sm text-white" value={trialReviewDrafts[record.id]?.status ?? record.status} onChange={(event) => updateTrialReviewDraft(record.id, { status: event.target.value })}>
                        {["AUTO_QUEUED", "IN_REVIEW", "VERIFIED", "REJECTED", "ESCALATED"].map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <select className="h-10 rounded-md border border-gray-800 bg-gray-900 px-3 text-sm text-white" value={trialReviewDrafts[record.id]?.assignedReviewerId ?? record.assignedReviewer?.id ?? ""} onChange={(event) => updateTrialReviewDraft(record.id, { assignedReviewerId: event.target.value })}>
                        <option value="">Unassigned reviewer</option>
                        {reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.email ?? reviewer.name ?? reviewer.id} · {reviewer.role}</option>)}
                      </select>
                      <Input placeholder="Reviewer notes" value={trialReviewDrafts[record.id]?.reviewNotes ?? record.reviewNotes ?? ""} onChange={(event) => updateTrialReviewDraft(record.id, { reviewNotes: event.target.value })} />
                      <Button variant="outline" className="border-gray-700 text-gray-200 hover:bg-gray-800" onClick={() => submitTrialMatchReview(record.id)} disabled={saving === `trial-review-${record.id}`}>{saving === `trial-review-${record.id}` ? "Saving…" : "Update"}</Button>
                    </div>
                  ) : null}
                  {record.reviewEvents && record.reviewEvents.length ? (
                    <div className="mt-3 rounded-xl border border-gray-800 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Review history</p>
                      <div className="mt-3 space-y-2">
                        {record.reviewEvents.map((event) => (
                          <div key={event.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                            <span className="rounded-full border border-gray-700 px-2 py-1 text-[11px] uppercase">{prettyLabel(event.eventType)}</span>
                            <span>{event.previousStatus ? prettyLabel(event.previousStatus) : 'none'} → {event.nextStatus ? prettyLabel(event.nextStatus) : 'none'}</span>
                            <span>{new Date(event.createdAt).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}