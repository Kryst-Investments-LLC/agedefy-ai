/**
 * Shared AI Clinical Context Builder
 *
 * Assembles a user's recent biomarkers, active protocols, supplement stack,
 * health conditions, and active medications into a structured context block
 * that every AI provider route can inject as system-level context.
 *
 * @module lib/ai/clinical-context
 */

import { db } from '@/lib/db'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ClinicalContextBiomarker {
  name: string
  value: number
  unit: string
  measuredAt: string
  source?: string | null
}

export interface ClinicalContextProtocol {
  id: string
  name: string
  status: string
  contraindicationScore: number | null
}

export interface ClinicalContextMedication {
  id: string
  name: string
  dosage: string | null
  frequency: string | null
  prescribedFor: string | null
  active: boolean
}

export interface UserClinicalContext {
  biomarkers: ClinicalContextBiomarker[]
  protocols: ClinicalContextProtocol[]
  medications: ClinicalContextMedication[]
  supplementStack: string[]
  healthConditions: string[]
  longevityGoal: string | null
  riskTolerance: string | null
}

/* ------------------------------------------------------------------ */
/*  Builder                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch and assemble the clinical context for a user.
 *
 * This is intentionally a read-only query. It never mutates data.
 * The result is safe to serialise into an AI system prompt.
 */
export async function buildUserClinicalContext(
  userId: string,
): Promise<UserClinicalContext> {
  const [biomarkers, protocols, medications, profile] = await Promise.all([
    db.biomarker.findMany({
      where: { userId },
      orderBy: { measuredAt: 'desc' },
      take: 15,
      select: { name: true, value: true, unit: true, measuredAt: true, source: true },
    }),
    db.protocol.findMany({
      where: { userId, status: { not: 'archived' } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, name: true, status: true, contraindicationScore: true },
    }),
    db.medication.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, name: true, dosage: true, frequency: true, prescribedFor: true, active: true },
    }),
    db.userProfile.findUnique({
      where: { userId },
      select: {
        supplementStack: true,
        healthConditions: true,
        longevityGoal: true,
        riskTolerance: true,
      },
    }),
  ])

  const parseJsonArray = (raw: string | null | undefined): string[] => {
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
    } catch {
      return []
    }
  }

  return {
    biomarkers: biomarkers.map((b) => ({
      name: b.name,
      value: b.value,
      unit: b.unit,
      measuredAt: b.measuredAt.toISOString(),
      source: b.source,
    })),
    protocols: protocols.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      contraindicationScore: p.contraindicationScore,
    })),
    medications: medications.map((m) => ({
      id: m.id,
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      prescribedFor: m.prescribedFor,
      active: m.active,
    })),
    supplementStack: parseJsonArray(profile?.supplementStack),
    healthConditions: parseJsonArray(profile?.healthConditions),
    longevityGoal: profile?.longevityGoal ?? null,
    riskTolerance: profile?.riskTolerance ?? null,
  }
}

/* ------------------------------------------------------------------ */
/*  Prompt serialisation                                              */
/* ------------------------------------------------------------------ */

/**
 * Render the clinical context as a concise system-prompt block that can be
 * prepended to any provider AI request.
 */
export function renderClinicalContextPrompt(ctx: UserClinicalContext): string {
  const sections: string[] = []

  if (ctx.biomarkers.length > 0) {
    const lines = ctx.biomarkers.map(
      (b) => `  ${b.name}: ${b.value} ${b.unit} (${b.measuredAt.slice(0, 10)})`,
    )
    sections.push(`Recent biomarkers:\n${lines.join('\n')}`)
  }

  if (ctx.medications.length > 0) {
    const lines = ctx.medications.map(
      (m) => `  ${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` (${m.frequency})` : ''}${m.prescribedFor ? ` — for ${m.prescribedFor}` : ''}`,
    )
    sections.push(`Active medications:\n${lines.join('\n')}`)
  }

  if (ctx.protocols.length > 0) {
    const lines = ctx.protocols.map(
      (p) => `  ${p.name} [${p.status}]${p.contraindicationScore != null ? ` safety=${(1 - p.contraindicationScore).toFixed(2)}` : ''}`,
    )
    sections.push(`Active protocols:\n${lines.join('\n')}`)
  }

  if (ctx.supplementStack.length > 0) {
    sections.push(`Supplement stack: ${ctx.supplementStack.join(', ')}`)
  }

  if (ctx.healthConditions.length > 0) {
    sections.push(`Health conditions: ${ctx.healthConditions.join(', ')}`)
  }

  if (ctx.longevityGoal) {
    sections.push(`Longevity goal: ${ctx.longevityGoal}`)
  }

  if (sections.length === 0) {
    return ''
  }

  return `--- User clinical context (for personalisation only; do not prescribe or diagnose) ---\n${sections.join('\n\n')}\n--- End clinical context ---`
}
