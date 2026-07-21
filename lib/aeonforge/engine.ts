import { getAIConfig, isProviderEnabled } from '@/lib/config/ai-config'
import { computeSaScore } from '@/lib/services/sa-score'
import type { DataSource, UncertaintySpec } from '@/lib/types/annotated-value'
import {
  calculateEvidenceScore,
  estimateReviewConfidence,
  extractBiomarkerTargets,
  extractContraindications,
  inferDiseaseArea,
  inferStudyType,
} from '@/lib/biomedical-intelligence'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { gradeCandidate, gradeFromConfidence } from '@/lib/aeonforge/evidence-grade'
import { applyHealthGuardrail } from '@/lib/ai/health-guardrail'
import type {
  AeonForgeCandidateMolecule,
  AeonForgePromptRequest,
  AeonForgeResponse,
} from '@/lib/services/aeonforge'
import type { InteractionSeverity } from '@prisma/client'

// ---------------------------------------------------------------------------
// Prompt Analysis
// ---------------------------------------------------------------------------

export interface PromptAnalysis {
  diseaseArea: string | null
  biomarkerTargets: string[]
  inferredStudyType: string
  contraindications: string[]
  targetPathways: string[]
  compoundClasses: string[]
}

const pathwayPatterns: Array<{ pathway: string; patterns: RegExp[] }> = [
  { pathway: 'mTOR', patterns: [/mtor/i, /rapamycin/i, /torc1/i] },
  { pathway: 'AMPK', patterns: [/ampk/i, /amp-activated/i, /metformin/i] },
  { pathway: 'Sirtuins', patterns: [/sirtuin/i, /sirt1/i, /sirt3/i, /sirt6/i, /nad\+/i] },
  { pathway: 'NF-κB', patterns: [/nf-?kb/i, /nuclear factor/i, /inflammatory signaling/i] },
  { pathway: 'p53/p21', patterns: [/p53/i, /p21/i, /p16/i, /senescence/i, /senolytic/i] },
  { pathway: 'Telomere maintenance', patterns: [/telomer/i, /telomerase/i, /tert/i] },
  { pathway: 'Autophagy', patterns: [/autophagy/i, /macroautophagy/i, /lysosom/i] },
  { pathway: 'Mitochondrial biogenesis', patterns: [/mitochondri/i, /pgc-?1/i, /oxphos/i] },
  { pathway: 'IGF-1/Insulin signaling', patterns: [/igf-?1/i, /insulin signaling/i, /growth hormone/i] },
  { pathway: 'Epigenetic reprogramming', patterns: [/epigenetic/i, /dna methylation/i, /histone/i, /yamanaka/i] },
  { pathway: 'Proteostasis', patterns: [/proteostasis/i, /unfolded protein/i, /chaperone/i, /proteasom/i] },
  { pathway: 'Stem cell niche', patterns: [/stem cell/i, /regenerat/i, /progenitor/i] },
]

const compoundClassPatterns: Array<{ cls: string; patterns: RegExp[] }> = [
  { cls: 'Senolytic', patterns: [/senolytic/i, /seno-/i, /clear\w* senescent/i] },
  { cls: 'Senomorphic', patterns: [/senomorphic/i, /sasp/i] },
  { cls: 'NAD+ precursor', patterns: [/nad\+/i, /nmn/i, /nicotinamide riboside/i, /nr\b/i] },
  { cls: 'mTOR inhibitor', patterns: [/rapamycin/i, /rapalog/i, /mtor inhibit/i] },
  { cls: 'AMPK activator', patterns: [/metformin/i, /ampk activat/i, /berberine/i] },
  { cls: 'Polyphenol', patterns: [/polyphenol/i, /resveratrol/i, /quercetin/i, /fisetin/i] },
  { cls: 'Peptide therapeutic', patterns: [/peptide/i, /thymalin/i, /epithalon/i, /bpc-?157/i] },
  { cls: 'Neoantigen vaccine', patterns: [/neoantigen/i, /vaccine/i, /immunotherap/i] },
]

export function analyzePrompt(prompt: string): PromptAnalysis {
  const diseaseArea = inferDiseaseArea(prompt)
  const biomarkerTargets = extractBiomarkerTargets(prompt)
  const inferredStudyType = inferStudyType(prompt)
  const contraindications = extractContraindications(prompt)

  const targetPathways: string[] = []
  for (const entry of pathwayPatterns) {
    if (entry.patterns.some((p) => p.test(prompt))) {
      targetPathways.push(entry.pathway)
    }
  }

  const compoundClasses: string[] = []
  for (const entry of compoundClassPatterns) {
    if (entry.patterns.some((p) => p.test(prompt))) {
      compoundClasses.push(entry.cls)
    }
  }

  return {
    diseaseArea,
    biomarkerTargets,
    inferredStudyType,
    contraindications,
    targetPathways: targetPathways.length > 0 ? targetPathways : ['General longevity'],
    compoundClasses: compoundClasses.length > 0 ? compoundClasses : ['Small molecule'],
  }
}

// ---------------------------------------------------------------------------
// Knowledge-Graph Compound Lookup
// ---------------------------------------------------------------------------

async function queryKnowledgeGraph(analysis: PromptAnalysis) {
  const pathwayNames = analysis.targetPathways
  try {
    const compounds = await db.compound.findMany({
      where: {
        pathways: {
          some: {
            pathway: {
              name: { in: pathwayNames },
            },
          },
        },
      },
      include: {
        interactions: {
          include: { compoundB: { select: { name: true } } },
        },
        pathways: {
          include: { pathway: { select: { name: true, category: true } } },
        },
      },
      take: 20,
    })
    return compounds
  } catch {
    logger.warn('Knowledge-graph query fell back to empty (table may not have seed data)')
    return []
  }
}

type KGCompound = Awaited<ReturnType<typeof queryKnowledgeGraph>>[number]

// ---------------------------------------------------------------------------
// AI Provider Call — structured candidate generation
// ---------------------------------------------------------------------------

const DISCOVERY_SYSTEM_PROMPT = `You are a pharmaceutical discovery assistant integrated into the Biozephyra longevity platform.
Given a scientific prompt and optional context, generate realistic molecular candidate suggestions in JSON format.
Each candidate must have: id, iupacName, commonName, smiles (simplified molecular-input line-entry system), mechanism, targetPathways (array), potentialSynergies (array), estimatedHealthspanGain (days, conservative), and safetyProfile with toxicity (0-1), contraindications (array), knownAdverseEvents (array).
Return a JSON array of 3-5 candidates. Output ONLY the JSON array, no markdown fences or explanation.
IMPORTANT: All results are hypothetical and for informational purposes only. Always be conservative with healthspan estimates.`

async function callAIProvider(prompt: string): Promise<{ raw: string; modelId: string }> {
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
          { role: 'system', content: DISCOVERY_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2500,
        temperature: 0.6,
      }),
    })
    if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)
    const data = await response.json()
    return { raw: data.choices[0]?.message?.content || '[]', modelId: config.providers.openai.model }
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
        max_tokens: 2500,
        system: DISCOVERY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!response.ok) throw new Error(`Anthropic error: ${response.status}`)
    const data = await response.json()
    return { raw: data.content?.[0]?.text || '[]', modelId: config.providers.anthropic.model }
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
          { role: 'system', content: DISCOVERY_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2500,
        temperature: 0.6,
      }),
    })
    if (!response.ok) throw new Error(`Grok error: ${response.status}`)
    const data = await response.json()
    return { raw: data.choices[0]?.message?.content || '[]', modelId: config.providers.grok.model }
  }

  throw new Error('No AI provider is configured for AeonForge discovery')
}

// ---------------------------------------------------------------------------
// Safety Scoring
// ---------------------------------------------------------------------------

const severityToScore: Record<InteractionSeverity, number> = {
  BENEFICIAL: 0.05,
  NEUTRAL: 0.15,
  CAUTION: 0.5,
  DANGEROUS: 0.9,
  UNKNOWN: 0.35,
}

function scoreSafety(
  candidate: AeonForgeCandidateMolecule,
  kgCompounds: KGCompound[]
): AeonForgeCandidateMolecule {
  const matched = kgCompounds.find(
    (c) =>
      c.name.toLowerCase() === (candidate.commonName || '').toLowerCase() ||
      c.name.toLowerCase() === candidate.iupacName.toLowerCase()
  )

  if (matched && matched.interactions.length > 0) {
    const severityScores = matched.interactions.map((i) => severityToScore[i.severity])
    const avgToxicity = severityScores.reduce((a, b) => a + b, 0) / severityScores.length
    const clampedToxicity = Math.min(1, Math.max(0, avgToxicity))
    const kgSource: DataSource = { kind: 'chembl' }
    const kgUncertainty: UncertaintySpec = { kind: 'qualitative', level: 'low' }
    return {
      ...candidate,
      safetyProfile: {
        ...candidate.safetyProfile,
        toxicity: clampedToxicity,
      },
      safetyProfileAnnotated: {
        toxicity: {
          value: clampedToxicity,
          source: kgSource,
          uncertainty: kgUncertainty,
          measured: false,
        },
      },
    }
  }

  return candidate
}

// ---------------------------------------------------------------------------
// Evidence Scoring
// ---------------------------------------------------------------------------

function scoreEvidence(analysis: PromptAnalysis): number {
  const studyType = analysis.inferredStudyType as Parameters<typeof calculateEvidenceScore>[0]['studyType']
  const evidenceScore = calculateEvidenceScore({
    studyType,
    evidenceDirection: 'SUPPORTIVE',
    uncertaintyScore: 0.4,
  })
  const reviewConfidence = estimateReviewConfidence({
    evidenceScore,
    uncertaintyScore: 0.4,
    hasAbstract: true,
  })
  return (evidenceScore + reviewConfidence) / 2
}

// ---------------------------------------------------------------------------
// Parse AI response
// ---------------------------------------------------------------------------

function parseAICandidates(raw: string, modelId: string): AeonForgeCandidateMolecule[] {
  let cleaned = raw.trim()
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '')
  }

  const llmSource: DataSource = { kind: 'llm', modelId }
  const llmUncertainty: UncertaintySpec = { kind: 'qualitative', level: 'very-low' }

  try {
    const parsed = JSON.parse(cleaned)
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    return arr.map((item: Record<string, unknown>, idx: number) => {
      const sp = item.safetyProfile as Record<string, unknown> | undefined
      const healthspanGain = typeof item.estimatedHealthspanGain === 'number'
        ? item.estimatedHealthspanGain
        : undefined
      const toxicity = typeof sp?.toxicity === 'number' ? sp.toxicity as number : 0.3
      return {
        id: (item.id as string) || `af-candidate-${idx + 1}`,
        iupacName: (item.iupacName as string) || 'Unknown',
        commonName: (item.commonName as string) || undefined,
        smiles: (item.smiles as string) || '',
        mechanism: (item.mechanism as string) || '',
        targetPathways: Array.isArray(item.targetPathways) ? item.targetPathways as string[] : [],
        potentialSynergies: Array.isArray(item.potentialSynergies) ? item.potentialSynergies as string[] : [],
        estimatedHealthspanGain: healthspanGain,
        estimatedHealthspanGainAnnotated: healthspanGain !== undefined ? {
          value: healthspanGain,
          unit: 'days',
          source: llmSource,
          uncertainty: llmUncertainty,
          measured: false,
        } : undefined,
        safetyProfile: {
          toxicity,
          contraindications: Array.isArray(sp?.contraindications) ? sp.contraindications as string[] : [],
          knownAdverseEvents: Array.isArray(sp?.knownAdverseEvents) ? sp.knownAdverseEvents as string[] : [],
        },
        safetyProfileAnnotated: {
          toxicity: {
            value: toxicity,
            source: llmSource,
            uncertainty: llmUncertainty,
            measured: false,
          },
        },
      }
    })
  } catch (e) {
    logger.error('Failed to parse AI candidate response', { error: e, raw: raw.slice(0, 200) })
    return []
  }
}

// ---------------------------------------------------------------------------
// Public API — Local Discovery Engine
// ---------------------------------------------------------------------------

export async function discoverCandidatesLocal(
  request: AeonForgePromptRequest
): Promise<AeonForgeResponse> {
  const startTime = Date.now()

  // Step 1: Analyse the prompt
  const analysis = analyzePrompt(request.prompt)

  // Step 2: Query knowledge graph for matching compounds
  const kgCompounds = await queryKnowledgeGraph(analysis)

  // Step 3: Build an enriched prompt with analysis context + KG data
  const kgContext = kgCompounds.length > 0
    ? `\nExisting knowledge-graph compounds related to target pathways:\n${kgCompounds
        .slice(0, 8)
        .map((c) => `- ${c.name}: ${c.pathways.map((p) => p.pathway.name).join(', ')}`)
        .join('\n')}`
    : ''

  const userCtx = request.userContext
    ? `\nUser context: age=${request.userContext.age ?? 'unknown'}, biomarkers=${JSON.stringify(request.userContext.biomarkers || {})}, goals=${(request.userContext.goals || []).join(', ')}`
    : ''

  const enrichedPrompt = [
    `Discovery request: ${request.prompt}`,
    `Target pathways: ${analysis.targetPathways.join(', ')}`,
    `Compound classes: ${analysis.compoundClasses.join(', ')}`,
    `Disease area: ${analysis.diseaseArea || 'General longevity'}`,
    `Biomarker targets: ${analysis.biomarkerTargets.join(', ') || 'none specified'}`,
    kgContext,
    userCtx,
    `\nDiscovery tier: ${request.discoveryTier || 'explorer'}`,
    `Generate ${request.discoveryTier === 'enterprise' ? 5 : 3} candidates.`,
  ].join('\n')

  // Step 4: Call AI provider for structured candidate generation
  const { raw: rawResponse, modelId } = await callAIProvider(enrichedPrompt)

  // Output guardrail: scan raw response before parsing candidates.
  // Fires if the AI embedded prescriptive dosing/prescription/cure language.
  const guardrail = applyHealthGuardrail(rawResponse, { surface: 'aeonforge' })
  if (guardrail.blocked) {
    return {
      status: 'partial',
      requestId: `af-local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      candidates: [],
      confidence: 0,
      evidenceGrade: gradeFromConfidence(0),
      candidateEvidenceGrades: [],
      modelVersion: 'biozephyra-local-v1',
      disclaimers: [guardrail.disclaimer],
      warnings: [
        `Discovery response withheld by health guardrail (${guardrail.triggeredCategory}).`,
        guardrail.content,
      ],
      executionTimeMs: Date.now() - startTime,
    }
  }

  let candidates = parseAICandidates(rawResponse, modelId)

  // Step 5: Enrich with safety scoring from knowledge graph; stamp PENDING reality-check
  // (the background worker resolves these via chemistry.reality-check jobs); compute SA score
  const checkedAt = new Date().toISOString()
  candidates = candidates.map((c) => ({
    ...scoreSafety(c, kgCompounds),
    realityCheck: {
      status: 'PENDING' as const,
      queriedSmiles: c.smiles,
      checkedAt,
    },
    saScore: computeSaScore(c.smiles),
  }))

  // Step 6: Compute overall confidence from evidence scoring
  const confidence = scoreEvidence(analysis)

  const executionTimeMs = Date.now() - startTime

  logger.info('AeonForge local discovery complete', {
    userId: request.userId,
    candidateCount: candidates.length,
    confidence,
    executionTimeMs,
    pathways: analysis.targetPathways,
  })

  return {
    status: candidates.length > 0 ? 'success' : 'partial',
    requestId: `af-local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    candidates,
    confidence,
    evidenceGrade: gradeFromConfidence(confidence),
    candidateEvidenceGrades: candidates.map((c) =>
      gradeCandidate({ simulationScore: null, safetyScore: c.safetyProfile.toxicity != null ? 1 - c.safetyProfile.toxicity : null, confidence }),
    ),
    modelVersion: 'biozephyra-local-v1',
    disclaimers: [
      guardrail.disclaimer,
      'All candidates are AI-generated hypotheses for informational purposes only.',
      'Candidates require full preclinical and clinical validation.',
      'Safety scores are estimates based on available knowledge-graph data.',
    ],
    warnings: candidates.length === 0
      ? ['No candidates could be generated for this prompt. Try refining your query.']
      : undefined,
    executionTimeMs,
  }
}
