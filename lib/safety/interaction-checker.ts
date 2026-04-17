/**
 * Interaction Safety Service
 *
 * Checks a user's active medications and supplement stack against the
 * compound interaction graph. When a DANGEROUS or CAUTION interaction is
 * found, automatically creates a high-priority clinician task so the
 * care team is notified without requiring user action.
 *
 * @module lib/safety/interaction-checker
 */

import type { InteractionSeverity } from '@prisma/client'

import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface InteractionFlag {
  compoundA: string
  compoundB: string
  severity: InteractionSeverity
  description: string | null
}

export interface InteractionCheckResult {
  userId: string
  flags: InteractionFlag[]
  clinicianTaskIds: string[]
  checkedAt: string
}

/* ------------------------------------------------------------------ */
/*  Core checker                                                      */
/* ------------------------------------------------------------------ */

const HIGH_RISK_SEVERITIES = new Set<InteractionSeverity>(['DANGEROUS', 'CAUTION'])

/**
 * Look up all active medications and supplements for a user, resolve them
 * against the compound graph, and flag dangerous or cautionary interactions.
 *
 * For every DANGEROUS interaction a clinician task with priority 5 is created.
 * For CAUTION interactions a priority-3 task is created.
 */
export async function checkUserInteractions(
  userId: string,
  tenantId: string,
): Promise<InteractionCheckResult> {
  const [medications, profile] = await Promise.all([
    db.medication.findMany({
      where: { userId, active: true },
      select: { name: true },
    }),
    db.userProfile.findUnique({
      where: { userId },
      select: { supplementStack: true },
    }),
  ])

  const supplementStack = parseJsonArray(profile?.supplementStack)

  // Combine medication names and supplement names into a single set
  const allNames = new Set<string>()
  for (const m of medications) allNames.add(normalise(m.name))
  for (const s of supplementStack) allNames.add(normalise(s))

  if (allNames.size < 2) {
    return { userId, flags: [], clinicianTaskIds: [], checkedAt: new Date().toISOString() }
  }

  // Resolve compound IDs from the knowledge graph
  const nameArray = [...allNames]
  const compounds = await db.compound.findMany({
    where: {
      OR: nameArray.map((n) => ({ name: { contains: n } })),
    },
    select: { id: true, name: true },
  })

  if (compounds.length < 2) {
    return { userId, flags: [], clinicianTaskIds: [], checkedAt: new Date().toISOString() }
  }

  const compoundIds = compounds.map((c) => c.id)
  const compoundNameById = new Map(compounds.map((c) => [c.id, c.name]))

  // Fetch all pairwise interactions among resolved compounds
  const interactions = await db.compoundInteraction.findMany({
    where: {
      compoundAId: { in: compoundIds },
      compoundBId: { in: compoundIds },
    },
    select: {
      compoundAId: true,
      compoundBId: true,
      severity: true,
      description: true,
    },
  })

  const flags: InteractionFlag[] = []
  for (const ix of interactions) {
    if (HIGH_RISK_SEVERITIES.has(ix.severity)) {
      flags.push({
        compoundA: compoundNameById.get(ix.compoundAId) ?? ix.compoundAId,
        compoundB: compoundNameById.get(ix.compoundBId) ?? ix.compoundBId,
        severity: ix.severity,
        description: ix.description,
      })
    }
  }

  // Create clinician tasks for flagged interactions
  const clinicianTaskIds: string[] = []
  for (const flag of flags) {
    const priority = flag.severity === 'DANGEROUS' ? 5 : 3
    const title = `⚠️ ${flag.severity} interaction: ${flag.compoundA} × ${flag.compoundB}`
    const description = [
      `Automated safety flag: a ${flag.severity.toLowerCase()} interaction was detected between ${flag.compoundA} and ${flag.compoundB} in this user's active medication/supplement list.`,
      flag.description ? `\nKnowledge-graph note: ${flag.description}` : '',
      '\nPlease review and advise the user.',
    ].join('')

    const task = await db.clinicianTask.create({
      data: {
        userId,
        tenantId,
        title,
        description,
        priority,
        status: 'PENDING',
      },
    })

    clinicianTaskIds.push(task.id)

    await logAudit({
      actorUserId: userId,
      tenantId,
      action: 'safety.interaction_flagged',
      entityType: 'ClinicianTask',
      entityId: task.id,
      details: {
        compoundA: flag.compoundA,
        compoundB: flag.compoundB,
        severity: flag.severity,
      },
    })

    logger.warn('High-risk interaction detected', {
      userId,
      compoundA: flag.compoundA,
      compoundB: flag.compoundB,
      severity: flag.severity,
      clinicianTaskId: task.id,
    })
  }

  return {
    userId,
    flags,
    clinicianTaskIds,
    checkedAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}
