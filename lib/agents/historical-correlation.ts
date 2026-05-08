import { db } from '@/lib/db'

import type { HistoricalCorrelation } from './types'

export async function queryHistoricalCorrelations(
  userId: string,
  compoundNames: string[],
): Promise<HistoricalCorrelation[]> {
  if (compoundNames.length === 0) return []

  const protocols = await db.protocol.findMany({
    where: {
      userId,
      status: { in: ['active', 'completed', 'archived'] },
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      biomarkerMeasurements: {
        orderBy: { measuredAt: 'asc' },
        select: { name: true, value: true, unit: true, measuredAt: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const normalizedTargets = new Set(compoundNames.map((n) => n.toLowerCase()))
  const correlations: HistoricalCorrelation[] = []

  for (const protocol of protocols) {
    const protocolNameLower = protocol.name.toLowerCase()
    const matchesCompound = compoundNames.some(
      (c) => protocolNameLower.includes(c.toLowerCase()) || normalizedTargets.has(protocolNameLower),
    )

    if (!matchesCompound) continue

    const matchedCompound = compoundNames.find(
      (c) => protocolNameLower.includes(c.toLowerCase()),
    ) ?? protocol.name

    const biomarkerGroups = new Map<string, { name: string; value: number; unit: string; measuredAt: Date }[]>()
    for (const m of protocol.biomarkerMeasurements) {
      const existing = biomarkerGroups.get(m.name) ?? []
      existing.push(m)
      biomarkerGroups.set(m.name, existing)
    }

    for (const [biomarkerName, measurements] of biomarkerGroups) {
      if (measurements.length < 2) continue

      const sorted = [...measurements].sort(
        (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime(),
      )

      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const trialDays = Math.round(
        (last.measuredAt.getTime() - first.measuredAt.getTime()) / (1000 * 60 * 60 * 24),
      )

      if (trialDays < 3) continue

      const changePercent = first.value !== 0
        ? ((last.value - first.value) / Math.abs(first.value)) * 100
        : 0

      let direction: HistoricalCorrelation['direction'] = 'unchanged'
      if (Math.abs(changePercent) > 2) {
        direction = changePercent > 0 ? 'improved' : 'worsened'
      }

      correlations.push({
        compound: matchedCompound,
        biomarker: biomarkerName,
        trialPeriodDays: trialDays,
        startValue: first.value,
        endValue: last.value,
        changePercent: Math.round(changePercent * 100) / 100,
        direction,
        protocolId: protocol.id,
        protocolName: protocol.name,
      })
    }
  }

  return correlations
}
