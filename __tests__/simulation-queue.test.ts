import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// simulation-queue — unit tests
// ---------------------------------------------------------------------------

import { prioritizeSimulations } from '@/lib/loop/simulation-queue'
import type { RecentSimulation, PathwayPriority } from '@/lib/loop/simulation-queue'

const PRIORITY_PATHWAYS: PathwayPriority[] = [
  { pathway: 'NF-kB / Inflammation', importance: 0.9 },
  { pathway: 'Insulin Resistance / mTOR', importance: 0.7 },
]

function makeSim(
  overrides: Partial<RecentSimulation> = {},
  daysAgo = 5,
): RecentSimulation {
  const simulatedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  return {
    id: 'sim-1',
    interventionId: 'rapamycin',
    endpointName: 'hs_crp',
    simulatedAt,
    uncertaintyScore: 0.5,
    ...overrides,
  }
}

describe('prioritizeSimulations', () => {
  it('returns empty array when no simulations provided', () => {
    expect(prioritizeSimulations(PRIORITY_PATHWAYS, [])).toEqual([])
  })

  it('applies a freshness decay of 1.0 for sims younger than 30 days', () => {
    const sims = [makeSim({}, 10)]
    const result = prioritizeSimulations(PRIORITY_PATHWAYS, sims)
    expect(result[0].freshnessDecay).toBe(1.0)
  })

  it('applies a 1.5× freshness decay bonus for sims older than 30 days', () => {
    const sims = [makeSim({}, 35)]
    const result = prioritizeSimulations(PRIORITY_PATHWAYS, sims)
    expect(result[0].freshnessDecay).toBe(1.5)
  })

  it('computes expectedValue = uncertaintyScore × pathwayImportance × freshnessDecay', () => {
    const sims = [makeSim({ uncertaintyScore: 0.5, endpointName: 'hs_crp' }, 5)]
    const result = prioritizeSimulations(PRIORITY_PATHWAYS, sims)
    // hs_crp → NF-kB / Inflammation → importance 0.9; freshness 1.0
    // effective uncertainty = min(1, 0.5 × 1.0) = 0.5
    // expectedValue = 0.5 × 0.9 × 1.0 = 0.45
    expect(result[0].expectedValue).toBeCloseTo(0.45, 5)
  })

  it('marks top-3 sims as shouldAutoQueue by default', () => {
    const sims = [
      makeSim({ id: 's1', endpointName: 'hs_crp', uncertaintyScore: 0.9 }),
      makeSim({ id: 's2', endpointName: 'hba1c',  uncertaintyScore: 0.8 }),
      makeSim({ id: 's3', endpointName: 'egfr',   uncertaintyScore: 0.7 }),
      makeSim({ id: 's4', endpointName: 'alt',    uncertaintyScore: 0.1 }),
    ]
    const result = prioritizeSimulations(PRIORITY_PATHWAYS, sims)
    const autoQueued = result.filter((r) => r.shouldAutoQueue)
    expect(autoQueued).toHaveLength(3)
  })

  it('respects topN parameter', () => {
    const sims = [
      makeSim({ id: 's1', endpointName: 'hs_crp', uncertaintyScore: 0.9 }),
      makeSim({ id: 's2', endpointName: 'hba1c',  uncertaintyScore: 0.8 }),
      makeSim({ id: 's3', endpointName: 'egfr',   uncertaintyScore: 0.7 }),
    ]
    const result = prioritizeSimulations(PRIORITY_PATHWAYS, sims, 1)
    const autoQueued = result.filter((r) => r.shouldAutoQueue)
    expect(autoQueued).toHaveLength(1)
  })

  it('assigns null matchedPathway for unmapped endpoints', () => {
    const sims = [makeSim({ endpointName: 'unknown_biomarker_xyz' })]
    const result = prioritizeSimulations(PRIORITY_PATHWAYS, sims)
    expect(result[0].matchedPathway).toBeNull()
  })

  it('sorts sims by expectedValue descending', () => {
    const sims = [
      makeSim({ id: 's1', endpointName: 'egfr',   uncertaintyScore: 0.3 }), // low priority
      makeSim({ id: 's2', endpointName: 'hs_crp', uncertaintyScore: 0.9 }), // high priority
    ]
    const result = prioritizeSimulations(PRIORITY_PATHWAYS, sims)
    expect(result[0].expectedValue).toBeGreaterThan(result[1].expectedValue)
  })
})
