/**
 * Hypothesis generation + 5-lens critical ranking.
 *
 * EXPERT / SCIENTIST USE ONLY.  This module is not reachable from any consumer
 * surface, marketplace, protocol-recommendation engine, or biomarker
 * personalization pipeline.
 *
 * Given a biological target or pathway, it:
 *   1. Retrieves candidate compounds with a mechanistic rationale
 *   2. Gathers per-candidate evidence from PubMed + ClinicalTrials.gov
 *   3. Runs a 5-lens critical analysis (Practitioner / Academic / Skeptic /
 *      Economist / Historian) on each candidate via LLM
 *   4. Scores and ranks by evidence quality × (1 – skeptic-severity penalty)
 *   5. Returns a ranked list of HYPOTHESES — not treatments, not cures
 *
 * Hard constraints:
 *  - No dosing, protocols, or patient recommendations are ever produced.
 *  - Every output carries immutable "hypothesis, lab-validation required" framing.
 *  - LLM output is run through the health guardrail before returning.
 *  - No user health data is used for ranking (target query only).
 */

import { applyHealthGuardrail } from '@/lib/ai/health-guardrail'
import { NOT_MEDICAL_ADVICE_DISCLAIMER } from '@/lib/ai/health-guardrail-rules'
import { getAIConfig, isProviderEnabled } from '@/lib/config/ai-config'
import { logger } from '@/lib/logger'
import { fanOut } from '@/lib/research/fan-out'
import { decomposeQuery } from '@/lib/research/query-decomposer'
import { searchVocabulary } from '@/lib/research/vocabulary-search'
import { COMPOUNDS } from '@/lib/research/vocabulary-data'

// ─── Immutable output labels ──────────────────────────────────────────────────
// These constants are never overridden by LLM output.

export const CANDIDATE_LABEL =
  'AI-GENERATED RESEARCH HYPOTHESIS — requires experimental lab validation. Not validated. Not medical advice.' as const

export const VALIDATION_NOTE =
  'Scientist validates via lab work. Software only proposes and prioritizes.' as const

export const LLM_CAVEAT =
  'LLM-proposed candidates may be wrong, unsynthesizable, or previously failed. Expert triage required before any lab work.' as const

export const RESULT_LABEL = 'AI-GENERATED RESEARCH HYPOTHESES' as const

export const SCIENCE_NOTE =
  'The scientist validates via lab work. The software only proposes and prioritizes.' as const

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceStudy {
  pmid: string | null
  nctId: string | null
  title: string
  year: number | null
  studyType: string | null
}

export interface FiveLensCritique {
  practitioner: string
  academic: string
  skeptic: string
  economist: string
  historian: string
  skepticSeverity: number
}

export interface HypothesisCandidate {
  rank: number
  compoundId: string
  compoundName: string
  target: string
  evidenceStudies: EvidenceStudy[]
  evidenceScore: number
  finalScore: number
  critique: FiveLensCritique
  label: typeof CANDIDATE_LABEL
  disclaimer: string
  validationNote: typeof VALIDATION_NOTE
  llmCaveat: typeof LLM_CAVEAT
}

export interface HypothesisResult {
  target: string
  candidates: HypothesisCandidate[]
  label: typeof RESULT_LABEL
  disclaimer: string
  scienceNote: typeof SCIENCE_NOTE
  llmCaveat: typeof LLM_CAVEAT
  computedAt: string
}

export interface HypothesisOptions {
  maxCandidates?: number
}

export type AICallFn = (systemPrompt: string, userPrompt: string) => Promise<string>

interface CandidateInfo {
  id: string
  name: string
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────

const CRITIQUE_FALLBACK: FiveLensCritique = {
  practitioner: 'Unable to generate critique — LLM call failed.',
  academic: 'Unable to generate critique.',
  skeptic: 'Unable to assess — treat as high uncertainty.',
  economist: 'Unable to generate critique.',
  historian: 'Unable to generate critique.',
  skepticSeverity: 0.5,
}

// ─── AI call ──────────────────────────────────────────────────────────────────

const HYPOTHESIS_SYSTEM_PROMPT = [
  'You are a biomedical research analyst generating structured critical analysis for SCIENTIST USE ONLY.',
  'Your output is used by PhD researchers and drug-discovery scientists to prioritize laboratory experiments.',
  'Do NOT produce any dosing instructions, mg amounts, treatment plans, protocols for patients,',
  'prescriptions, or consumer recommendations. This analysis is strictly mechanistic and strategic,',
  'written for scientists prioritizing experiments.',
  'Output ONLY valid JSON — no prose outside the JSON object.',
].join(' ')

export const defaultCallAI: AICallFn = async (systemPrompt, userPrompt) => {
  const config = getAIConfig()

  if (isProviderEnabled('anthropic') && config.providers.anthropic.apiKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.providers.anthropic.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.providers.anthropic.model,
        max_tokens: 900,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    if (!response.ok) throw new Error(`Anthropic hypothesis AI error: ${response.status}`)
    const data = await response.json() as { content?: Array<{ text?: string }> }
    return data.content?.[0]?.text ?? '{}'
  }

  if (isProviderEnabled('openai') && config.providers.openai.apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.providers.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.providers.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 900,
        temperature: 0.3,
      }),
    })
    if (!response.ok) throw new Error(`OpenAI hypothesis AI error: ${response.status}`)
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? '{}'
  }

  throw new Error('No AI provider configured for hypothesis generation')
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function extractYear(dateStr: string): number | null {
  const match = dateStr.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0], 10) : null
}

async function gatherCandidates(target: string, maxCandidates: number): Promise<CandidateInfo[]> {
  const [vocabResults, fanOutResult] = await Promise.allSettled([
    Promise.resolve(searchVocabulary(target, maxCandidates * 2)),
    fanOut(target, { maxPubMed: 15, maxClinicalTrials: 0, maxVocabulary: 0 }),
  ])

  const seen = new Set<string>()
  const candidates: CandidateInfo[] = []

  // Vocabulary: take compounds that scored > 0 for the target query
  if (vocabResults.status === 'fulfilled') {
    for (const entry of vocabResults.value) {
      if (entry.type === 'compound' && !seen.has(entry.id)) {
        seen.add(entry.id)
        candidates.push({ id: entry.id, name: entry.name })
        if (candidates.length >= maxCandidates) return candidates
      }
    }
  }

  // PubMed titles: cross-reference against vocabulary to find additional compound mentions
  if (fanOutResult.status === 'fulfilled' && candidates.length < maxCandidates) {
    const titleCorpus = fanOutResult.value.pubmed.slice(0, 10).map(p => p.title).join(' ')
    const decomposed = decomposeQuery(titleCorpus)
    for (const compoundId of decomposed.compoundIds) {
      if (seen.has(compoundId)) continue
      const vocab = COMPOUNDS.find(c => c.id === compoundId)
      if (vocab) {
        seen.add(compoundId)
        candidates.push({ id: vocab.id, name: vocab.name })
        if (candidates.length >= maxCandidates) break
      }
    }
  }

  return candidates
}

async function gatherEvidence(candidate: CandidateInfo, target: string): Promise<EvidenceStudy[]> {
  const { pubmed, clinicalTrials } = await fanOut(
    `${candidate.name} ${target}`,
    { maxPubMed: 8, maxClinicalTrials: 3, maxVocabulary: 0 },
  )

  const studies: EvidenceStudy[] = [
    ...pubmed.map(p => ({
      pmid: p.pmid,
      nctId: null,
      title: p.title,
      year: extractYear(p.publishedDate),
      studyType: decomposeQuery(p.title).studyTypeHints[0] ?? null,
    })),
    ...clinicalTrials.map(t => ({
      pmid: null,
      nctId: t.nctId,
      title: t.title,
      year: t.startDate ? new Date(t.startDate).getFullYear() : null,
      studyType: 'clinical-trial',
    })),
  ]

  return studies.slice(0, 10)
}

function computeEvidenceScore(studies: EvidenceStudy[]): number {
  if (studies.length === 0) return 0.05

  const STUDY_QUALITY: Record<string, number> = {
    'RCT': 1.0,
    'meta-analysis': 1.0,
    'systematic-review': 0.9,
    'clinical-trial': 0.8,
    'observational': 0.6,
    'preclinical': 0.3,
    'animal-study': 0.3,
  }

  const replicationScore = Math.min(studies.length / 8, 1.0)

  const qualityScore = studies.reduce((best, s) => {
    if (!s.studyType) return best
    return Math.max(best, STUDY_QUALITY[s.studyType] ?? 0.3)
  }, 0.3)

  const currentYear = new Date().getFullYear()
  const years = studies.map(s => s.year).filter((y): y is number => y !== null && y > 1990)
  const maxYear = years.length > 0 ? Math.max(...years) : 2010
  const recencyScore = Math.max(0, Math.min(1, (maxYear - 2000) / (currentYear - 2000)))

  return 0.4 * replicationScore + 0.4 * qualityScore + 0.2 * recencyScore
}

function buildCritiquePrompt(candidate: CandidateInfo, target: string, studies: EvidenceStudy[]): string {
  const studySummary = studies.length > 0
    ? studies.slice(0, 5).map(s =>
        `- "${s.title}" (${s.year ?? 'year unknown'}${s.studyType ? `, ${s.studyType}` : ''})`
      ).join('\n')
    : '(no studies retrieved — evaluate on prior mechanistic knowledge)'

  return `Analyze the following candidate compound as a potential lab hypothesis for the given target.

CANDIDATE COMPOUND: ${candidate.name} (ID: ${candidate.id})
BIOLOGICAL TARGET / PATHWAY: ${target}

RETRIEVED EVIDENCE STUDIES (to inform your assessment):
${studySummary}

Return ONLY a JSON object with exactly these keys:

{
  "practitioner": "...",
  "academic": "...",
  "skeptic": "...",
  "economist": "...",
  "historian": "...",
  "skepticSeverity": 0.X
}

Definitions:
- practitioner: clinical plausibility and translational track record in humans (2-3 sentences)
- academic: mechanistic evidence quality, key studies, reproducibility (2-3 sentences)
- skeptic: THE SINGLE STRONGEST reason this candidate FAILS — negative RCTs, off-target toxicity, failed human trials, or mechanistic dead-ends (2-3 sentences)
- economist: development cost, IP landscape, manufacturing barriers, regulatory path (1-2 sentences)
- historian: 1-2 similar compounds that targeted the same pathway and failed, and why (1-2 sentences)
- skepticSeverity: float 0.0-1.0 where 1.0 = almost certainly wrong, 0.0 = skeptic argument very weak

STRICT CONSTRAINTS — output MUST NOT contain:
- Any patient dosing, mg amounts, or administration routes
- Any protocol or treatment plan
- Any consumer recommendation
This analysis is for laboratory scientists prioritizing experiments only.`
}

async function generateCritique(
  candidate: CandidateInfo,
  target: string,
  studies: EvidenceStudy[],
  callAI: AICallFn,
): Promise<FiveLensCritique> {
  let rawText: string
  try {
    rawText = await callAI(HYPOTHESIS_SYSTEM_PROMPT, buildCritiquePrompt(candidate, target, studies))
  } catch (err) {
    logger.warn('Hypothesis critique AI call failed', { candidate: candidate.id, error: String(err) })
    return CRITIQUE_FALLBACK
  }

  let parsed: Record<string, unknown>
  try {
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
    parsed = JSON.parse((fenceMatch ? fenceMatch[1] : rawText).trim()) as Record<string, unknown>
  } catch {
    logger.warn('Hypothesis critique JSON parse failed', { candidate: candidate.id })
    return CRITIQUE_FALLBACK
  }

  const TEXT_FIELDS = ['practitioner', 'academic', 'skeptic', 'economist', 'historian'] as const
  const critique: Record<string, string> = {}

  for (const field of TEXT_FIELDS) {
    const raw = typeof parsed[field] === 'string' ? (parsed[field] as string) : 'Not assessed.'
    const guarded = applyHealthGuardrail(raw, { surface: 'hypothesis-critique' })
    critique[field] = guarded.blocked
      ? `[Prescriptive content filtered — field: ${field}]`
      : raw
  }

  const skepticSeverity = typeof parsed.skepticSeverity === 'number'
    ? Math.max(0, Math.min(1, parsed.skepticSeverity))
    : 0.5

  return {
    practitioner: critique.practitioner,
    academic: critique.academic,
    skeptic: critique.skeptic,
    economist: critique.economist,
    historian: critique.historian,
    skepticSeverity,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate ranked compound hypotheses for a biological target.
 *
 * @param target     Biological target, pathway, or hallmark (e.g. "mTOR signaling",
 *                   "cellular senescence", "NAD+ metabolism").
 * @param options    maxCandidates (1-25, default 10).
 * @param callAI     Injectable AI call function; defaults to the configured provider.
 *                   Override in tests to avoid live API calls.
 */
export async function generateHypotheses(
  target: string,
  options: HypothesisOptions = {},
  callAI: AICallFn = defaultCallAI,
): Promise<HypothesisResult> {
  const maxCandidates = Math.max(1, Math.min(options.maxCandidates ?? 10, 25))

  const candidateInfos = await gatherCandidates(target, maxCandidates)

  if (candidateInfos.length === 0) {
    return {
      target,
      candidates: [],
      label: RESULT_LABEL,
      disclaimer: NOT_MEDICAL_ADVICE_DISCLAIMER,
      scienceNote: SCIENCE_NOTE,
      llmCaveat: LLM_CAVEAT,
      computedAt: new Date().toISOString(),
    }
  }

  // Evidence gathering and critique generation run in parallel across candidates.
  const evidenceResults = await Promise.allSettled(
    candidateInfos.map(c => gatherEvidence(c, target)),
  )

  const critiqueResults = await Promise.allSettled(
    candidateInfos.map((c, i) => {
      const studies = evidenceResults[i].status === 'fulfilled' ? evidenceResults[i].value : []
      return generateCritique(c, target, studies, callAI)
    }),
  )

  const candidates: HypothesisCandidate[] = candidateInfos.map((c, i) => {
    const studies = evidenceResults[i].status === 'fulfilled' ? evidenceResults[i].value : []
    const critique = critiqueResults[i].status === 'fulfilled' ? critiqueResults[i].value : CRITIQUE_FALLBACK
    const evidenceScore = computeEvidenceScore(studies)
    const finalScore = evidenceScore * (1 - 0.3 * critique.skepticSeverity)

    return {
      rank: 0,
      compoundId: c.id,
      compoundName: c.name,
      target,
      evidenceStudies: studies,
      evidenceScore,
      finalScore,
      critique,
      label: CANDIDATE_LABEL,
      disclaimer: NOT_MEDICAL_ADVICE_DISCLAIMER,
      validationNote: VALIDATION_NOTE,
      llmCaveat: LLM_CAVEAT,
    }
  })

  candidates.sort((a, b) => b.finalScore - a.finalScore)
  candidates.forEach((c, i) => { c.rank = i + 1 })

  return {
    target,
    candidates,
    label: RESULT_LABEL,
    disclaimer: NOT_MEDICAL_ADVICE_DISCLAIMER,
    scienceNote: SCIENCE_NOTE,
    llmCaveat: LLM_CAVEAT,
    computedAt: new Date().toISOString(),
  }
}
