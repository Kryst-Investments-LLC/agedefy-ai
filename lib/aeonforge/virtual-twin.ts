import { getAIConfig, isProviderEnabled } from '@/lib/config/ai-config'
import { logger } from '@/lib/logger'
import type {
  AeonForgeCandidateMolecule,
  VirtualTwinProfile,
} from '@/lib/services/aeonforge'

// ---------------------------------------------------------------------------
// Virtual Twin System Prompt
// ---------------------------------------------------------------------------

const VIRTUAL_TWIN_SYSTEM_PROMPT = `You are a computational gerontologist generating a virtual aging twin profile.
Given a user's age, biomarker data, and a candidate intervention molecule, predict normalized scores (0-1) for each of the 9 hallmarks of aging.
A score of 0 means maximal improvement predicted; 1 means no change or worsening.
Also estimate biological age after hypothetical intervention.

Output ONLY a JSON object with:
- biologicalAge (number)
- hallmarkResponsePredictions (object with these exact keys, each a number 0-1):
  genomicInstability, telomereDysfunction, epigeneticAlteration, lossOfProteostasis,
  disabledMacroautophagy, mitochondrialDysfunction, cellularSenescence,
  stemCellExhaustion, alteredIntercelularCommunication

Be conservative and scientifically grounded. These are hypothetical predictions.`

// ---------------------------------------------------------------------------
// AI Call
// ---------------------------------------------------------------------------

async function callTwinAI(prompt: string): Promise<string> {
  const config = getAIConfig()

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
          { role: 'system', content: VIRTUAL_TWIN_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    })
    if (!response.ok) throw new Error(`OpenAI twin error: ${response.status}`)
    const data = await response.json()
    return data.choices[0]?.message?.content || '{}'
  }

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
        max_tokens: 600,
        system: VIRTUAL_TWIN_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!response.ok) throw new Error(`Anthropic twin error: ${response.status}`)
    const data = await response.json()
    return data.content?.[0]?.text || '{}'
  }

  if (isProviderEnabled('grok') && config.providers.grok.apiKey) {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.providers.grok.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.providers.grok.model,
        messages: [
          { role: 'system', content: VIRTUAL_TWIN_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    })
    if (!response.ok) throw new Error(`Grok twin error: ${response.status}`)
    const data = await response.json()
    return data.choices[0]?.message?.content || '{}'
  }

  throw new Error('No AI provider is configured for virtual twin generation')
}

// ---------------------------------------------------------------------------
// Parse Twin Profile
// ---------------------------------------------------------------------------

function clamp01(v: unknown): number {
  const n = typeof v === 'number' ? v : 0.5
  return Math.min(1, Math.max(0, n))
}

function parseTwinProfile(raw: string): VirtualTwinProfile {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')
  }

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const h = (parsed.hallmarkResponsePredictions || {}) as Record<string, unknown>
    return {
      biologicalAge: typeof parsed.biologicalAge === 'number' ? parsed.biologicalAge : 50,
      hallmarkResponsePredictions: {
        genomicInstability: clamp01(h.genomicInstability),
        telomereDysfunction: clamp01(h.telomereDysfunction),
        epigeneticAlteration: clamp01(h.epigeneticAlteration),
        lossOfProteostasis: clamp01(h.lossOfProteostasis),
        disabledMacroautophagy: clamp01(h.disabledMacroautophagy),
        mitochondrialDysfunction: clamp01(h.mitochondrialDysfunction),
        cellularSenescence: clamp01(h.cellularSenescence),
        stemCellExhaustion: clamp01(h.stemCellExhaustion),
        alteredIntercelularCommunication: clamp01(h.alteredIntercelularCommunication),
      },
    }
  } catch {
    logger.error('Failed to parse virtual twin response', { raw: raw.slice(0, 200) })
    return {
      biologicalAge: 50,
      hallmarkResponsePredictions: {
        genomicInstability: 0.5,
        telomereDysfunction: 0.5,
        epigeneticAlteration: 0.5,
        lossOfProteostasis: 0.5,
        disabledMacroautophagy: 0.5,
        mitochondrialDysfunction: 0.5,
        cellularSenescence: 0.5,
        stemCellExhaustion: 0.5,
        alteredIntercelularCommunication: 0.5,
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Public API — Generate Virtual Twin
// ---------------------------------------------------------------------------

export async function generateVirtualTwinLocal(
  candidates: AeonForgeCandidateMolecule[],
  userContext: {
    age: number
    biomarkers: Record<string, number>
    geneticsSummary?: string
  }
): Promise<VirtualTwinProfile> {
  const primaryCandidate = candidates[0]
  if (!primaryCandidate) {
    throw new Error('At least one candidate is required for virtual twin generation')
  }

  const prompt = [
    `User age: ${userContext.age}`,
    `Biomarkers: ${JSON.stringify(userContext.biomarkers)}`,
    userContext.geneticsSummary ? `Genetics summary: ${userContext.geneticsSummary}` : '',
    '',
    `Candidate intervention: ${primaryCandidate.iupacName} (${primaryCandidate.commonName || 'N/A'})`,
    `Mechanism: ${primaryCandidate.mechanism}`,
    `Target pathways: ${primaryCandidate.targetPathways.join(', ')}`,
    `Toxicity: ${primaryCandidate.safetyProfile.toxicity}`,
    `Healthspan gain estimate: ${primaryCandidate.estimatedHealthspanGain ?? 'unknown'} days`,
    '',
    'Predict the hallmark aging response profile for this user under this intervention.',
  ]
    .filter(Boolean)
    .join('\n')

  const rawResult = await callTwinAI(prompt)
  const profile = parseTwinProfile(rawResult)

  logger.info('Virtual twin generated', {
    biologicalAge: profile.biologicalAge,
    candidateId: primaryCandidate.id,
  })

  return profile
}
