/**
 * Standalone Biological Age Computation
 *
 * Aggregates a user's biomarkers and health data, calls AI to compute
 * a composite biological age with per-hallmark breakdown, and persists
 * the result as a BiologicalAgeSnapshot.
 */

import { getAIConfig, isProviderEnabled } from '@/lib/config/ai-config'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HallmarkScores {
  genomicInstability: number
  telomereDysfunction: number
  epigeneticAlteration: number
  lossOfProteostasis: number
  disabledMacroautophagy: number
  mitochondrialDysfunction: number
  cellularSenescence: number
  stemCellExhaustion: number
  alteredIntercellularCommunication: number
}

export interface BioAgeResult {
  biologicalAge: number
  chronologicalAge: number
  delta: number // positive = biologically older
  hallmarkScores: HallmarkScores
  confidence: number
  inputSummary: Record<string, number>
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const BIO_AGE_SYSTEM_PROMPT = `You are a computational gerontologist calculating a user's biological age.
Given the user's chronological age and biomarker data, compute:
1. An estimated biological age (in years, with 1 decimal precision)
2. Normalised scores (0–1) for each of the 9 hallmarks of aging (0 = excellent, 1 = poor)
3. A confidence level (0–1) based on how many reliable biomarkers were provided

Use established biological age algorithms (Klemera-Doubal, PhenoAge, GrimAge) as conceptual reference.
Be conservative and evidence-grounded.

Output ONLY a JSON object with:
- biologicalAge (number)
- confidence (number 0-1)
- hallmarkScores (object with keys: genomicInstability, telomereDysfunction, epigeneticAlteration, lossOfProteostasis, disabledMacroautophagy, mitochondrialDysfunction, cellularSenescence, stemCellExhaustion, alteredIntercellularCommunication)`

// ---------------------------------------------------------------------------
// AI Call
// ---------------------------------------------------------------------------

async function callBioAgeAI(prompt: string): Promise<string> {
  const config = getAIConfig()

  if (isProviderEnabled('openai') && config.providers.openai.apiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.providers.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.providers.openai.model,
        messages: [
          { role: 'system', content: BIO_AGE_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    })
    if (!res.ok) throw new Error(`OpenAI bio-age error: ${res.status}`)
    const data = await res.json()
    return data.choices[0]?.message?.content || '{}'
  }

  if (isProviderEnabled('anthropic') && config.providers.anthropic.apiKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.providers.anthropic.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.providers.anthropic.model,
        max_tokens: 500,
        system: BIO_AGE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic bio-age error: ${res.status}`)
    const data = await res.json()
    return data.content?.[0]?.text || '{}'
  }

  if (isProviderEnabled('grok') && config.providers.grok.apiKey) {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.providers.grok.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.providers.grok.model,
        messages: [
          { role: 'system', content: BIO_AGE_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    })
    if (!res.ok) throw new Error(`Grok bio-age error: ${res.status}`)
    const data = await res.json()
    return data.choices[0]?.message?.content || '{}'
  }

  throw new Error('No AI provider is configured for biological age computation')
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

function clamp01(v: unknown): number {
  const n = typeof v === 'number' ? v : 0.5
  return Math.min(1, Math.max(0, n))
}

function parseResult(raw: string, chronologicalAge: number): BioAgeResult & { hallmarkScores: HallmarkScores } {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')
  }

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const h = (parsed.hallmarkScores || {}) as Record<string, unknown>
    const biologicalAge = typeof parsed.biologicalAge === 'number' ? parsed.biologicalAge : chronologicalAge
    const confidence = typeof parsed.confidence === 'number' ? clamp01(parsed.confidence) : 0.5

    const hallmarkScores: HallmarkScores = {
      genomicInstability: clamp01(h.genomicInstability),
      telomereDysfunction: clamp01(h.telomereDysfunction),
      epigeneticAlteration: clamp01(h.epigeneticAlteration),
      lossOfProteostasis: clamp01(h.lossOfProteostasis),
      disabledMacroautophagy: clamp01(h.disabledMacroautophagy),
      mitochondrialDysfunction: clamp01(h.mitochondrialDysfunction),
      cellularSenescence: clamp01(h.cellularSenescence),
      stemCellExhaustion: clamp01(h.stemCellExhaustion),
      alteredIntercellularCommunication: clamp01(h.alteredIntercellularCommunication),
    }

    return {
      biologicalAge,
      chronologicalAge,
      delta: Math.round((biologicalAge - chronologicalAge) * 10) / 10,
      hallmarkScores,
      confidence,
      inputSummary: {},
    }
  } catch {
    logger.error('Failed to parse bio-age response', { raw: raw.slice(0, 200) })
    return fallbackResult(chronologicalAge)
  }
}

function fallbackResult(chronologicalAge: number): BioAgeResult {
  return {
    biologicalAge: chronologicalAge,
    chronologicalAge,
    delta: 0,
    hallmarkScores: {
      genomicInstability: 0.5,
      telomereDysfunction: 0.5,
      epigeneticAlteration: 0.5,
      lossOfProteostasis: 0.5,
      disabledMacroautophagy: 0.5,
      mitochondrialDysfunction: 0.5,
      cellularSenescence: 0.5,
      stemCellExhaustion: 0.5,
      alteredIntercellularCommunication: 0.5,
    },
    confidence: 0,
    inputSummary: {},
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute biological age for a user by aggregating their stored biomarkers.
 */
export async function computeBiologicalAge(
  userId: string,
  chronologicalAge: number,
  tenantId = 'default'
): Promise<BioAgeResult> {
  // Fetch the user's latest biomarkers
  const biomarkers = await db.biomarker.findMany({
    where: { userId, tenantId },
    orderBy: { measuredAt: 'desc' },
    take: 50,
  })

  // Deduplicate: keep only the latest value per biomarker name
  const latestByName = new Map<string, { value: number; unit: string }>()
  for (const bm of biomarkers) {
    if (!latestByName.has(bm.name)) {
      latestByName.set(bm.name, { value: bm.value, unit: bm.unit })
    }
  }

  const inputSummary: Record<string, number> = {}
  for (const [name, data] of latestByName) {
    inputSummary[name] = data.value
  }

  if (latestByName.size === 0) {
    logger.warn('No biomarkers found for bio-age computation', { userId })
    return { ...fallbackResult(chronologicalAge), inputSummary }
  }

  const biomarkerLines = Array.from(latestByName.entries()).map(
    ([name, d]) => `  ${name}: ${d.value} ${d.unit}`
  )

  const prompt = [
    `Chronological age: ${chronologicalAge}`,
    `Biomarkers (${latestByName.size} total):`,
    ...biomarkerLines,
    '',
    'Compute the biological age and hallmark aging scores for this individual.',
  ].join('\n')

  const rawResult = await callBioAgeAI(prompt)
  const result = parseResult(rawResult, chronologicalAge)
  result.inputSummary = inputSummary

  logger.info('Biological age computed', {
    userId,
    biologicalAge: result.biologicalAge,
    delta: result.delta,
    confidence: result.confidence,
    biomarkerCount: latestByName.size,
  })

  return result
}

/**
 * Compute and persist a biological age snapshot.
 */
export async function computeAndPersistBioAge(
  userId: string,
  chronologicalAge: number,
  tenantId = 'default'
): Promise<BioAgeResult & { snapshotId: string }> {
  const result = await computeBiologicalAge(userId, chronologicalAge, tenantId)

  const snapshot = await db.biologicalAgeSnapshot.create({
    data: {
      tenantId,
      userId,
      chronologicalAge: result.chronologicalAge,
      biologicalAge: result.biologicalAge,
      hallmarkScores: JSON.stringify(result.hallmarkScores),
      inputSummary: JSON.stringify(result.inputSummary),
      confidence: result.confidence,
    },
  })

  return { ...result, snapshotId: snapshot.id }
}
