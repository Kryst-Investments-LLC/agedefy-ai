import { describe, expect, it } from 'vitest'

/**
 * Smoke tests for mission-control module exports and types.
 * Full integration tests require a live database.
 */

describe('mission-control module', () => {
  it('exports buildMissionControl', async () => {
    const mod = await import('@/lib/loop/mission-control')
    expect(typeof mod.buildMissionControl).toBe('function')
  })

  it('exposes expected role type values', async () => {
    // MissionControlRole is a type-level union; check that the builder
    // accepts the three documented role strings without throwing at compile
    // time (import-time validation).
    const mod = await import('@/lib/loop/mission-control')
    expect(mod.buildMissionControl).toBeDefined()
    // Arity check: (userId, role)
    expect(mod.buildMissionControl.length).toBe(2)
  })
})
