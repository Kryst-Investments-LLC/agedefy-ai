/**
 * Provenance-led mechanistic rationale synthesis.
 *
 * Produces a MechanisticRationale for a candidate compound where every claim
 * is either:
 *   (a) backed by a cited PMID whose abstract was retrieved and verified by
 *       token-overlap (≥ 0.35), or
 *   (b) explicitly quarantined as unverified model inference.
 *
 * The two categories are in SEPARATE arrays and cannot be mixed. "Verified"
 * means the cited abstract contains the claim's key terms — NOT that the
 * hypothesis is experimentally correct. That caveat is embedded in the
 * mandatory disclaimer on every returned object.
 *
 * HARD CONSTRAINTS (never loosened):
 *  - The LLM may only cite PMIDs from the studies we already retrieved for
 *    this candidate. Any PMID not in that set is quarantined immediately —
 *    we never fetch a model-invented ID (prevents lucky token-overlap against
 *    an unrelated real abstract).
 *  - Every claim text is run through applyHealthGuardrail before use.
 *  - No dose/protocol/patient-recommendation language. Expert/scientist use only.
 *  - Never throws — any failure returns empty verified + inference note.
 */

import { applyHealthGuardrail } from '@/lib/ai/health-guardrail'
import { logger } from '@/lib/logger'
import { fetchPubMedAbstract } from '@/lib/research'
import { verifyCitation } from './citation-verifier'
import type { EvidenceStudy } from '@/lib/agents/hypothesis-agent'
import type { AICallFn } from '@/lib/agents/hypothesis-agent'

export const MECHANISM_DISCLAIMER =
  '"Verified" means the cited PubMed abstract contains the claim\'s key terms ' +
  '(token-overlap ≥ 35%) — it does not mean the mechanistic claim is experimentally ' +
  'confirmed. All claims are LLM-generated and require expert critical appraisal ' +
  'and independent lab validation before any use. Not medical advice.'

export interface VerifiedClaim {
  claimText: string
  pmid: string
  matchRate: number
  citationNote: string
}

export interface UnverifiedInference {
  claimText: string
  reason: string
}

export interface MechanisticRationale {
  verifiedClaims: VerifiedClaim[]
  unverifiedInferences: UnverifiedInference[]
  disclaimer: string
}

const EMPTY_RATIONALE: MechanisticRationale = {
  verifiedClaims: [],
  unverifiedInferences: [],
  disclaimer: MECHANISM_DISCLAIMER,
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildSynthesisPrompt(
  candidateName: string,
  target: string,
  studies: EvidenceStudy[],
): string {
  const studyList = studies
    .filter(s => s.pmid)
    .slice(0, 8)
    .map(s => `  PMID:${s.pmid} — "${s.title}" (${s.year ?? 'year unknown'})`)
    .join('\n')

  const allowedPmids = studies
    .filter(s => s.pmid)
    .map(s => s.pmid)
    .join(', ')

  return `You are producing mechanistic claims for SCIENTIST USE ONLY. These claims
will be verified against PubMed abstracts by a token-overlap algorithm and
quarantined if they cannot be verified.

CANDIDATE COMPOUND: ${candidateName}
BIOLOGICAL TARGET / PATHWAY: ${target}

RETRIEVED STUDIES (you may ONLY cite PMIDs from this exact list):
${studyList || '  (no PubMed studies retrieved)'}

ALLOWED PMIDs: ${allowedPmids || 'none'}

Produce 3-6 discrete mechanistic claims. Each claim must:
  1. Be a single sentence stating one mechanistic fact (e.g. "X inhibits Y by Z")
  2. Cite exactly ONE PMID from the ALLOWED PMIDs list above
  3. NOT include any dosing, mg amounts, treatment protocols, or patient recommendations
  4. NOT assert clinical efficacy in humans unless the cited study is a human trial

Return ONLY a JSON array — no prose outside the JSON:
[
  { "claimText": "...", "pmid": "..." },
  { "claimText": "...", "pmid": "..." }
]

If no retrieved studies support a mechanistic claim, omit it entirely.
If ALLOWED PMIDs is empty, return an empty array: []`
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Synthesize a mechanistic rationale for `candidateName` against `target`,
 * grounded only in the `studies` already retrieved for this candidate.
 *
 * @param candidateName    Display name of the compound.
 * @param target           Biological target or pathway string.
 * @param studies          Evidence studies previously retrieved by gatherEvidence.
 * @param callAI           Injectable AI call function (same as used by generateHypotheses).
 * @param fetchAbstractFn  Injectable abstract fetcher; defaults to fetchPubMedAbstract.
 */
export async function synthesizeMechanism(
  candidateName: string,
  target: string,
  studies: EvidenceStudy[],
  callAI: AICallFn,
  fetchAbstractFn: (pmid: string) => Promise<string | null> = fetchPubMedAbstract,
): Promise<MechanisticRationale> {
  const retrievedPmids = new Set<string>(
    studies.filter(s => s.pmid).map(s => s.pmid as string),
  )

  // If there are no PMIDs to cite against, skip the LLM call entirely —
  // we would only produce unverifiable inferences.
  if (retrievedPmids.size === 0) {
    return {
      verifiedClaims: [],
      unverifiedInferences: [{
        claimText: `No retrieved PubMed studies available to ground mechanistic claims for ${candidateName} against ${target}.`,
        reason: 'No retrieved PMIDs — LLM call skipped to avoid unverifiable synthesis.',
      }],
      disclaimer: MECHANISM_DISCLAIMER,
    }
  }

  // ─── Step 1: Ask the LLM for cited claims ────────────────────────────────
  let rawText: string
  try {
    rawText = await callAI(
      [
        'You are a biomedical research analyst producing mechanistic claims for SCIENTIST USE ONLY.',
        'You MUST cite only PMIDs from the provided list. Output ONLY valid JSON — no prose.',
        'Do NOT include any dosing, treatment plans, patient recommendations, or clinical advice.',
      ].join(' '),
      buildSynthesisPrompt(candidateName, target, studies),
    )
  } catch (err) {
    logger.warn('mechanism-synthesis: LLM call failed', { candidateName, error: String(err) })
    return EMPTY_RATIONALE
  }

  // ─── Step 2: Parse JSON ───────────────────────────────────────────────────
  let rawClaims: Array<{ claimText?: unknown; pmid?: unknown }>
  try {
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
    const json = (fenceMatch ? fenceMatch[1] : rawText).trim()
    rawClaims = JSON.parse(json) as typeof rawClaims
    if (!Array.isArray(rawClaims)) throw new Error('not an array')
  } catch {
    logger.warn('mechanism-synthesis: JSON parse failed', { candidateName })
    return EMPTY_RATIONALE
  }

  // ─── Step 3: Partition and verify in parallel ─────────────────────────────
  const verifiedClaims: VerifiedClaim[] = []
  const unverifiedInferences: UnverifiedInference[] = []

  const verifyTasks = rawClaims
    .filter(rc => typeof rc.claimText === 'string' && typeof rc.pmid === 'string')
    .map(async (rc) => {
      const claimText = (rc.claimText as string).trim()
      const pmid = (rc.pmid as string).trim()

      // Guardrail first — refuse prescriptive/medical content.
      const guarded = applyHealthGuardrail(claimText, { surface: 'mechanism-synthesis' })
      const safeText = guarded.blocked
        ? `[Prescriptive content filtered — mechanistic claim removed]`
        : claimText

      if (guarded.blocked) {
        return {
          type: 'inference' as const,
          claimText: safeText,
          reason: 'Prescriptive content filtered by health guardrail.',
        }
      }

      // Any PMID the LLM invented (not in retrieved set) → quarantined immediately.
      if (!retrievedPmids.has(pmid)) {
        return {
          type: 'inference' as const,
          claimText: safeText,
          reason: `Cited PMID ${pmid} was not in the retrieved study set — quarantined as model inference.`,
        }
      }

      // Retrieved PMID: verify by token-overlap against the actual abstract.
      let verification
      try {
        verification = await verifyCitation(safeText, pmid, fetchAbstractFn)
      } catch {
        return {
          type: 'inference' as const,
          claimText: safeText,
          reason: `Abstract fetch failed for PMID ${pmid}.`,
        }
      }

      if (verification.status === 'verified') {
        return {
          type: 'verified' as const,
          claimText: safeText,
          pmid,
          matchRate: verification.matchRate,
          citationNote: verification.reason,
        }
      }

      return {
        type: 'inference' as const,
        claimText: safeText,
        reason: `PMID ${pmid}: ${verification.reason}`,
      }
    })

  const settled = await Promise.allSettled(verifyTasks)

  for (const result of settled) {
    if (result.status === 'rejected') {
      unverifiedInferences.push({
        claimText: '[Claim processing failed]',
        reason: String(result.reason),
      })
      continue
    }
    const item = result.value
    if (item.type === 'verified') {
      verifiedClaims.push({
        claimText: item.claimText,
        pmid: item.pmid,
        matchRate: item.matchRate,
        citationNote: item.citationNote,
      })
    } else {
      unverifiedInferences.push({
        claimText: item.claimText,
        reason: item.reason,
      })
    }
  }

  return { verifiedClaims, unverifiedInferences, disclaimer: MECHANISM_DISCLAIMER }
}
