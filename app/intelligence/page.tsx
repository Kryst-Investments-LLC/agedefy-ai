// CI-008: reads required data from the database — force dynamic rendering so
// the DB is queried at request time, never at build (a DB failure can then
// never be swallowed into a statically-generated page).
export const dynamic = "force-dynamic"
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { BiomedicalIntelligenceWorkspace } from "@/components/biomedical-intelligence-workspace"
import { AppShell } from "@/components/app-shell"
import { authOptions } from "@/lib/auth"
import { calibrateCohortFromOutcomes } from "@/lib/biomedical-intelligence"
import { db } from "@/lib/db"

function countByLabel(values: Array<string | null | undefined>, limit = 4) {
  const counts = new Map<string, number>()

  for (const value of values) {
    const label = value?.trim() || "Unclassified"
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

function parseJsonArray(value: string | null | undefined) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

export default async function IntelligencePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/sign-in")
  }

  const [evidence, hypotheses, cohorts, outcomes, trialMatches, reviewers] = await Promise.all([
    db.evidenceRecord.findMany({
      where: { OR: [{ createdByUserId: session.user.id }, { reviewed: true }] },
      orderBy: [{ reviewed: "desc" }, { evidenceScore: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        diseaseArea: true,
        sourceLabel: true,
        studyType: true,
        evidenceDirection: true,
        evidenceScore: true,
        reviewStatus: true,
        provenanceType: true,
        provenanceDetail: true,
        automationSource: true,
        verificationNotes: true,
        reviewConfidence: true,
        sourceCapturedAt: true,
        reviewedAt: true,
        reviewed: true,
        reviewedByUser: { select: { id: true, email: true, name: true } },
        assignedReviewer: { select: { id: true, email: true, name: true, role: true } },
        reviewEvents: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            eventType: true,
            previousStatus: true,
            nextStatus: true,
            previousAssignedReviewerId: true,
            nextAssignedReviewerId: true,
            notes: true,
            createdAt: true,
          },
        },
        researchEntry: { select: { id: true, source: true, externalId: true } },
      },
    }),
    db.hypothesis.findMany({
      where: { ownerUserId: session.user.id },
      orderBy: [{ status: "asc" }, { confidenceScore: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: {
        evidenceLinks: {
          include: {
            evidenceRecord: { select: { id: true, title: true, evidenceScore: true, reviewStatus: true } },
          },
        },
        priorityChanges: {
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            evidenceRecord: { select: { id: true, title: true } },
            evidenceReviewEvent: { select: { id: true, eventType: true, previousStatus: true, nextStatus: true, notes: true, createdAt: true } },
          },
        },
      },
    }),
    db.patientCohort.findMany({
      where: { ownerUserId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { _count: { select: { trialMatches: true } } },
    }),
    db.interventionOutcome.findMany({
      where: { userId: session.user.id },
      orderBy: { observedAt: "desc" },
      take: 20,
      include: { protocol: { select: { id: true, name: true, status: true } } },
    }),
    db.trialMatch.findMany({
      where: { userId: session.user.id },
      orderBy: [{ matchScore: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: {
        cohort: { select: { id: true, name: true, focusArea: true } },
        reviewer: { select: { id: true, email: true, name: true, role: true } },
        reviewEvents: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            eventType: true,
            previousStatus: true,
            nextStatus: true,
            notes: true,
            createdAt: true,
          },
        },
      },
    }),
    db.user.findMany({
      where: { role: { in: ["ADMIN", "CLINICIAN", "RESEARCHER"] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { email: "asc" }],
      take: 50,
    }),
  ])

  const analytics = {
    autoLinkedEvidenceCount: evidence.filter((record) => Boolean(record.researchEntry)).length,
    reviewedEvidenceCount: evidence.filter((record) => record.reviewed).length,
    queuedEvidenceCount: evidence.filter((record) => record.reviewStatus === "AUTO_QUEUED").length,
    topDiseaseAreas: countByLabel(evidence.map((record) => record.diseaseArea)),
    topCohortFocusAreas: countByLabel(cohorts.map((record) => record.focusArea)),
    hypothesisQueue: countByLabel(hypotheses.map((record) => record.status)),
    averageCohortConfidence: cohorts.length
      ? Number((cohorts.reduce((sum, record) => sum + record.confidenceScore, 0) / cohorts.length).toFixed(2))
      : 0,
    averageTrialMatchScore: trialMatches.length
      ? Number((trialMatches.reduce((sum, record) => sum + record.matchScore, 0) / trialMatches.length).toFixed(2))
      : 0,
    averageOutcomeConfidence: outcomes.length
      ? Number((outcomes.reduce((sum, record) => sum + record.confidenceScore, 0) / outcomes.length).toFixed(2))
      : 0,
  }

  const hydratedCohorts = cohorts.map((record) => ({
    ...record,
    biomarkerFocus: parseJsonArray(record.biomarkerFocus),
    stratificationAxes: parseJsonArray(record.stratificationAxes),
  })).map((record) => ({
    ...record,
    calibration: calibrateCohortFromOutcomes({
      biomarkerFocus: record.biomarkerFocus,
      focusArea: record.focusArea,
      baseConfidenceScore: record.confidenceScore,
      baseReadinessScore: record.readinessScore,
      outcomes: outcomes.map((outcome) => ({
        biomarkerName: outcome.biomarkerName,
        delta: outcome.delta,
        confidenceScore: outcome.confidenceScore,
        notes: outcome.notes,
      })),
    }),
  }))

  const hydratedTrialMatches = trialMatches.map((record) => ({
    ...record,
    assignedReviewer: record.reviewer,
    reviewEvents: record.reviewEvents.map((event) => ({
      ...event,
      previousAssignedReviewerId: null,
      nextAssignedReviewerId: null,
    })),
  }))

  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="mx-auto max-w-7xl px-4 py-10 text-foreground">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">Biomedical intelligence</p>
          <h1 className="mt-3 text-4xl font-bold">Discovery Workspace</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Manage evidence, hypotheses, cohorts, outcomes, and trial matching in one place. This is the foundation for enterprise-grade
            biomedical discovery, causal learning, and AI-wave-resilient proprietary intelligence.
          </p>
        </div>

        <BiomedicalIntelligenceWorkspace
          evidence={evidence}
          hypotheses={hypotheses}
          cohorts={hydratedCohorts}
          outcomes={outcomes}
          trialMatches={hydratedTrialMatches}
          analytics={analytics}
          reviewers={reviewers}
          currentUserRole={session.user.role}
        />
      </main>
    </div>
    </AppShell>
  )
}