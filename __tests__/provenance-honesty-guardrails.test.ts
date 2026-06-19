/**
 * Honesty guardrails (CI lock).
 *
 * These tests pin the mandated honesty language across the provenance rail and
 * the flywheel/RWE surfaces. They exist so that any future edit which weakens or
 * removes a disclaimer fails CI rather than silently shipping. This is the
 * enforcement layer for the hard constraint: computational / AI-generated
 * artifacts must always be labelled "requires experimental lab validation —
 * not validated — not medical advice".
 */

import { describe, it, expect } from "vitest"

import {
  VALIDATION_DISCLAIMERS,
  DEFAULT_VALIDATION_STATUS,
  type ValidationStatus,
} from "@/lib/provenance/sign-result"
import { RWE_QUERY_FRAMING } from "@/lib/knowledge-graph/rwe-query"

const NON_VALIDATED: ValidationStatus[] = ["computational_estimate", "ai_generated_hypothesis"]

describe("provenance disclaimers", () => {
  it("labels every non-validated status as requiring lab validation, not validated, not medical advice", () => {
    for (const status of NON_VALIDATED) {
      const text = VALIDATION_DISCLAIMERS[status]
      expect(text).toMatch(/requires experimental lab validation/i)
      expect(text).toMatch(/not validated/i)
      expect(text).toMatch(/not medical advice/i)
    }
  })

  it("defaults to a non-validated status", () => {
    expect(NON_VALIDATED).toContain(DEFAULT_VALIDATION_STATUS)
  })

  it("never leaves any status without a disclaimer", () => {
    for (const status of Object.keys(VALIDATION_DISCLAIMERS) as ValidationStatus[]) {
      expect(VALIDATION_DISCLAIMERS[status].trim().length).toBeGreaterThan(0)
    }
  })

  it("does not label AI-generated hypotheses as validated", () => {
    expect(VALIDATION_DISCLAIMERS.ai_generated_hypothesis).toMatch(/AI-generated research hypothesis/i)
    expect(VALIDATION_DISCLAIMERS.ai_generated_hypothesis).not.toMatch(/\bvalidated by\b/i)
  })
})

describe("RWE query framing", () => {
  it("states research-not-medical-advice and association-not-mechanism", () => {
    expect(RWE_QUERY_FRAMING.notice).toMatch(/not medical advice/i)
    expect(RWE_QUERY_FRAMING.notice).toMatch(/not validated mechanisms/i)
  })

  it("caps RWE evidence at C_LOW and never claims validation", () => {
    expect(RWE_QUERY_FRAMING.evidence).toMatch(/capped at C_LOW/)
    expect(RWE_QUERY_FRAMING.evidence).toMatch(/never a validated claim/i)
  })
})
