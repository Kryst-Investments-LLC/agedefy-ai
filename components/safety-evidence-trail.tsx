'use client'

/**
 * Safety & Evidence trail — makes the platform's differentiator visible.
 *
 * Every recommendation here is (1) interaction-checked against the compound
 * graph + DDI tables, (2) citation-backed by a recorded AgentClaim, and
 * (3) clinician-gated when risk is high. Competitors can't say that; this
 * component says it — and, when an analysis exists, proves it with the real
 * citations and human-in-the-loop status.
 */

import Link from 'next/link'
import { ShieldCheck, BookMarked, Stethoscope, ArrowRight, CircleCheck, Clock } from 'lucide-react'

const EVIDENCE_LABELS: Record<string, string> = {
  MECHANISTIC_SIMULATION: 'Mechanistic simulation',
  KG_EDGE: 'Knowledge-graph edge',
  COHORT_STATISTIC: 'Cohort statistic',
  N_OF_1_RESULT: 'N-of-1 trial',
  REGULATORY_LABEL: 'Regulatory label',
}

export interface TrailCitation {
  claimText: string
  evidenceKind: string
  confidence: number
}

export interface LatestAnalysis {
  goal: string
  status: string // COMPLETED | AWAITING_REVIEW | ...
  createdAt: string
  safetyFlagCount: number
  requiresReview: boolean
  citations: TrailCitation[]
}

function Guarantee({ icon: Icon, title, desc }: { icon: typeof ShieldCheck; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-background/50 p-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

export function SafetyEvidenceTrail({ latest }: { latest: LatestAnalysis | null }) {
  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        <h2 className="text-lg font-semibold">Why you can trust this</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every recommendation is interaction-checked, citation-backed, and clinician-gated —
        not generated free-form.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Guarantee icon={ShieldCheck} title="Interaction-checked" desc="Screened against the compound graph & drug-interaction tables before you see it." />
        <Guarantee icon={BookMarked} title="Citation-backed" desc="Each claim carries a recorded evidence reference — never uncited." />
        <Guarantee icon={Stethoscope} title="Clinician-gated" desc="High-risk recommendations are held for licensed clinician sign-off." />
      </div>

      <div className="mt-5 border-t pt-5">
        {latest ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Your latest analysis</p>
              {latest.requiresReview ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <Clock className="h-3.5 w-3.5" /> Awaiting clinician review
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                  <CircleCheck className="h-3.5 w-3.5" /> Cleared
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              “{latest.goal}” · {latest.safetyFlagCount} safety check{latest.safetyFlagCount === 1 ? '' : 's'} ·{' '}
              {latest.citations.length} citation{latest.citations.length === 1 ? '' : 's'}
            </p>

            {latest.citations.length > 0 && (
              <ul className="mt-3 space-y-2">
                {latest.citations.slice(0, 4).map((c, i) => (
                  <li key={i} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm">{c.claimText}</p>
                      <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {EVIDENCE_LABELS[c.evidenceKind] ?? c.evidenceKind}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-teal-600 dark:bg-teal-400"
                          style={{ width: `${Math.round(c.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {Math.round(c.confidence * 100)}% conf
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">
              Run an AI analysis to generate your personal, citation-backed evidence trail.
            </p>
            <Link href="/personalization" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Open the AI Health Coach <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
