import { getAIConfig, isProviderEnabled } from '@/lib/config/ai-config'
import { logger } from '@/lib/logger'
import type {
  AeonForgeCandidateMolecule,
  SimulationData,
} from '@/lib/services/aeonforge'

// ---------------------------------------------------------------------------
// Simulation System Prompts
// ---------------------------------------------------------------------------

const SIMULATION_TYPE_PROMPTS: Record<string, string> = {
  virtual_cell: `You are a computational biologist simulating molecular interactions at the cellular level.
Given a candidate molecule with its mechanism and target pathways, predict the primary cellular outcome, secondary effects, estimated effect magnitude (0-1), and confidence ratio.
Output ONLY a JSON object with: primaryOutcome (string), secondaryOutcomes (string[]), estimatedEffect (number 0-1), confidenceRatio (string like "high" or "moderate").`,

  organ: `You are a systems pharmacologist modeling organ-level drug effects.
Given a candidate molecule, predict how it would affect the target organ system. Include primary outcome, secondary outcomes, estimated effect magnitude (0-1), and confidence ratio.
Output ONLY a JSON object with: primaryOutcome, secondaryOutcomes, estimatedEffect, confidenceRatio.`,

  whole_body: `You are a clinical pharmacologist modeling whole-body pharmacokinetic and pharmacodynamic outcomes.
Given a candidate molecule, predict systemic effects including absorption, distribution, and overall health impact.
Output ONLY a JSON object with: primaryOutcome, secondaryOutcomes, estimatedEffect, confidenceRatio.`,

  immunogenicity: `You are an immunologist assessing the immunogenic potential of a therapeutic candidate.
Predict the immune response profile including autoimmune risk, complement activation, and cytokine response.
Output ONLY a JSON object with: primaryOutcome, secondaryOutcomes, estimatedEffect, confidenceRatio.`,

  senolytic_prediction: `You are a geroscientist evaluating the senolytic potential of a candidate compound.
Predict the senescent cell clearance efficacy, selectivity for senescent vs healthy cells, and hallmark aging impacts.
Output ONLY a JSON object with: primaryOutcome, secondaryOutcomes, estimatedEffect, confidenceRatio.`,
}

// ---------------------------------------------------------------------------
// AI Call for Simulation
// ---------------------------------------------------------------------------

async function callSimulationAI(prompt: string, systemPrompt: string): Promise<string> {
  const config = getAIConfig()

  if (isProviderEnabled('openai') && config.providers.openai.apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${config.providers.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.providers.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
      }),
    })
    if (!response.ok) throw new Error(`OpenAI simulation error: ${response.status}`)
    const data = await response.json()
    return data.choices[0]?.message?.content || '{}'
  }

  if (isProviderEnabled('anthropic') && config.providers.anthropic.apiKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'x-api-key': config.providers.anthropic.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.providers.anthropic.model,
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!response.ok) throw new Error(`Anthropic simulation error: ${response.status}`)
    const data = await response.json()
    return data.content?.[0]?.text || '{}'
  }

  if (isProviderEnabled('grok') && config.providers.grok.apiKey) {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${config.providers.grok.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.providers.grok.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
      }),
    })
    if (!response.ok) throw new Error(`Grok simulation error: ${response.status}`)
    const data = await response.json()
    return data.choices[0]?.message?.content || '{}'
  }

  throw new Error('No AI provider is configured for AeonForge simulation')
}

// ---------------------------------------------------------------------------
// Parse Simulation Result
// ---------------------------------------------------------------------------

function parseSimulationResult(raw: string): {
  primaryOutcome: string
  secondaryOutcomes?: string[]
  estimatedEffect?: number
  confidenceRatio?: string
} {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')
  }
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    return {
      primaryOutcome: (parsed.primaryOutcome as string) || 'Simulation completed',
      secondaryOutcomes: Array.isArray(parsed.secondaryOutcomes)
        ? (parsed.secondaryOutcomes as string[])
        : undefined,
      estimatedEffect: typeof parsed.estimatedEffect === 'number'
        ? parsed.estimatedEffect
        : undefined,
      confidenceRatio: typeof parsed.confidenceRatio === 'string'
        ? parsed.confidenceRatio
        : undefined,
    }
  } catch {
    return { primaryOutcome: raw.slice(0, 200) || 'Simulation parse error' }
  }
}

// ---------------------------------------------------------------------------
// Public API — Run Simulations
// ---------------------------------------------------------------------------

export async function runSimulations(
  candidates: AeonForgeCandidateMolecule[],
  simulationTypes: string[],
  userContext?: Record<string, unknown>
): Promise<SimulationData[]> {
  const results: SimulationData[] = []
  const primaryCandidate = candidates[0]
  if (!primaryCandidate) return results

  const types = simulationTypes.length > 0
    ? simulationTypes
    : ['virtual_cell', 'senolytic_prediction']

  for (const simType of types) {
    const systemPrompt = SIMULATION_TYPE_PROMPTS[simType]
    if (!systemPrompt) {
      logger.warn('Unknown simulation type, skipping', { simType })
      continue
    }

    const prompt = [
      `Candidate: ${primaryCandidate.iupacName} (${primaryCandidate.commonName || 'N/A'})`,
      `SMILES: ${primaryCandidate.smiles}`,
      `Mechanism: ${primaryCandidate.mechanism}`,
      `Target pathways: ${primaryCandidate.targetPathways.join(', ')}`,
      `Toxicity score: ${primaryCandidate.safetyProfile.toxicity}`,
      `Contraindications: ${primaryCandidate.safetyProfile.contraindications.join(', ') || 'none listed'}`,
      userContext ? `User context: ${JSON.stringify(userContext)}` : '',
      `\nSimulation type: ${simType}`,
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const rawResult = await callSimulationAI(prompt, systemPrompt)
      const parsed = parseSimulationResult(rawResult)

      results.push({
        type: simType as SimulationData['type'],
        confidence: typeof parsed.estimatedEffect === 'number'
          ? Math.min(1, Math.max(0, parsed.estimatedEffect * 0.9 + 0.1))
          : 0.6,
        result: parsed,
      })
    } catch (error) {
      logger.error('Simulation failed for type', { simType, error })
      results.push({
        type: simType as SimulationData['type'],
        confidence: 0,
        result: {
          primaryOutcome: `Simulation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        },
      })
    }
  }

  return results
}
