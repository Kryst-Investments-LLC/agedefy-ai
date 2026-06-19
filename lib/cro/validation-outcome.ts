/**
 * CRO validation outcome summary (pure)
 *
 * Summarises the reconciled CandidateLabResult flags for a work order at the
 * moment it closes the loop (transition → RECONCILED). Derived strictly from
 * real lab data — never fabricated.
 *
 * HONESTY: `showedLabActivity` means at least one assay flagged "active". It is
 * NOT a claim that the candidate is a validated drug, treatment, or therapy —
 * it is one lab signal in an ongoing research process.
 *
 * @module lib/cro/validation-outcome
 */

export interface LabResultFlag {
  flag: string | null
}

export interface ValidationOutcomeSummary {
  total: number
  active: number
  inactive: number
  borderline: number
  toxic: number
  /** At least one "active" assay flag — a lab activity signal, not a validated drug. */
  showedLabActivity: boolean
  /** active / total, or null when there are no results. */
  hitRate: number | null
  note: string
}

const HONESTY_NOTE =
  "Lab activity signal from CRO validation — one result in an ongoing research process, not a validated drug, treatment, or therapy."

export function summarizeValidationOutcome(results: LabResultFlag[]): ValidationOutcomeSummary {
  const count = (f: string) => results.filter((r) => r.flag === f).length
  const total = results.length
  const active = count("active")

  return {
    total,
    active,
    inactive: count("inactive"),
    borderline: count("borderline"),
    toxic: count("toxic"),
    showedLabActivity: active > 0,
    hitRate: total > 0 ? active / total : null,
    note: HONESTY_NOTE,
  }
}
