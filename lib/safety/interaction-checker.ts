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
  /**
   * Active medication / supplement names that could NOT be resolved to a
   * compound in the controlled vocabulary. These are safety blind spots — an
   * unresolved name means any interaction it participates in is invisible to
   * the checker — so they are surfaced (and audited) rather than dropped.
   */
  unresolvedNames: string[]
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
    return { userId, flags: [], clinicianTaskIds: [], unresolvedNames: [], checkedAt: new Date().toISOString() }
  }

  // Resolve names → compound IDs DETERMINISTICALLY.
  //
  // This must NOT use a `contains` substring match: a partial match both
  // over-matches (e.g. "d3" hitting unrelated names) and silently mis-resolves
  // a medication to the wrong compound, which would hide a real interaction.
  // We resolve only on an EXACT canonical name or an EXACT alias, normalised on
  // both sides. The compound table is a controlled vocabulary (bounded), so we
  // load it once and match in-memory — this also keeps resolution case-portable
  // across SQLite (dev) and Postgres (prod), which differ on `equals` casing.
  const nameArray = [...allNames]
  const catalog = await db.compound.findMany({
    select: { id: true, name: true, aliases: true },
  })

  const idByNormalisedName = new Map<string, string>()
  for (const c of catalog) {
    idByNormalisedName.set(normalise(c.name), c.id)
    for (const alias of parseJsonArray(c.aliases)) {
      // First writer wins on alias collisions; canonical names already inserted
      // above always take precedence because they are inserted first below.
      const key = normalise(alias)
      if (!idByNormalisedName.has(key)) idByNormalisedName.set(key, c.id)
    }
  }

  const resolvedIds = new Set<string>()
  const unresolvedNames: string[] = []
  for (const name of nameArray) {
    const id = idByNormalisedName.get(name)
    if (id) resolvedIds.add(id)
    else unresolvedNames.push(name)
  }

  // Fail-safe visibility: an unresolved name is a blind spot, not a clean bill.
  if (unresolvedNames.length > 0) {
    logger.warn('Interaction check could not resolve some compounds', {
      userId,
      unresolvedNames,
    })
    await logAudit({
      actorUserId: userId,
      tenantId,
      action: 'safety.interaction_unresolved_compounds',
      entityType: 'User',
      entityId: userId,
      details: { unresolvedNames },
    })
  }

  if (resolvedIds.size < 2) {
    return { userId, flags: [], clinicianTaskIds: [], unresolvedNames, checkedAt: new Date().toISOString() }
  }

  const compoundIds = [...resolvedIds]
  const compoundNameById = new Map(catalog.map((c) => [c.id, c.name]))

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
    unresolvedNames,
    checkedAt: new Date().toISOString(),
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseJsonArray(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string')
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
    } catch {
      return []
    }
  }
  return []
}
