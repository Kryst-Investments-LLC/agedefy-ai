/**
 * Health Guardrail Middleware
 *
 * Scans AI-generated text (or user queries) for specific dosing, prescription,
 * or disease-treatment claims and replaces them with a clinician-consult
 * redirect. Always attaches a persistent "not medical advice" disclaimer.
 *
 * Surfaces covered: health coach (anthropic/openai/grok), AeonForge, bio-age.
 *
 * To add or adjust blocked patterns, edit health-guardrail-rules.ts only.
 * This file contains only wiring logic that medical reviewers should not need
 * to touch.
 */

import { logger } from '@/lib/logger'

import {
  CLINICIAN_REDIRECT_RESPONSE,
  GUARDRAIL_CATEGORIES,
  NOT_MEDICAL_ADVICE_DISCLAIMER,
  type GuardrailCategory,
} from './health-guardrail-rules'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GuardrailResult {
  /** Whether any blocked pattern was matched. */
  blocked: boolean
  /** Name of the category that fired (undefined when not blocked). */
  triggeredCategory?: string
  /**
   * Text to surface to the user:
   *   - When blocked: CLINICIAN_REDIRECT_RESPONSE
   *   - When not blocked: the original text unchanged
   */
  content: string
  /**
   * Persistent "not medical advice" frame.
   * ALWAYS present regardless of blocked/not-blocked.
   * Every caller must surface this to the user.
   */
  disclaimer: string
}

// Re-export so callers that only need the disclaimer constant can import from
// here without depending on the rules file directly.
export { NOT_MEDICAL_ADVICE_DISCLAIMER } from './health-guardrail-rules'

// ---------------------------------------------------------------------------
// Internal scan
// ---------------------------------------------------------------------------

function scanText(text: string): {
  blocked: boolean
  category?: GuardrailCategory
  matchedPattern?: string
} {
  for (const category of GUARDRAIL_CATEGORIES) {
    for (const pattern of category.patterns) {
      // Reset lastIndex in case caller reuses a stateful regex (g/y flags).
      // Our rules use no g/y flags, but be defensive.
      pattern.lastIndex = 0
      if (pattern.test(text)) {
        return { blocked: true, category, matchedPattern: pattern.source }
      }
    }
  }
  return { blocked: false }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply the health guardrail to a piece of text.
 *
 * Call this:
 *   - On AI *responses* before returning them to the user (output guardrail).
 *   - On user *queries* before forwarding them to the AI (input guardrail —
 *     avoids wasting AI credits on requests that would be blocked on the way
 *     back anyway).
 *
 * @param text    The text to scan.
 * @param opts    Optional context passed to the audit logger.
 * @returns       GuardrailResult — always includes `.disclaimer`.
 */
export function applyHealthGuardrail(
  text: string,
  opts?: { surface?: string },
): GuardrailResult {
  const scan = scanText(text)

  if (scan.blocked && scan.category) {
    logger.warn('Health guardrail blocked content', {
      surface: opts?.surface ?? 'unknown',
      category: scan.category.name,
      pattern: scan.matchedPattern,
    })

    return {
      blocked: true,
      triggeredCategory: scan.category.name,
      content: CLINICIAN_REDIRECT_RESPONSE,
      disclaimer: NOT_MEDICAL_ADVICE_DISCLAIMER,
    }
  }

  return {
    blocked: false,
    content: text,
    disclaimer: NOT_MEDICAL_ADVICE_DISCLAIMER,
  }
}
