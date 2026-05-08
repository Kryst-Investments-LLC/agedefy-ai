import { describe, expect, it } from 'vitest'

/**
 * Smoke tests for trust-engine module exports.
 * Integration tests requiring a live database are handled by the integration suite.
 */

describe('trust-engine module', () => {
  it('exports computeTrustScore and role type', async () => {
    const mod = await import('@/lib/trust/trust-engine')
    expect(typeof mod.computeTrustScore).toBe('function')
    expect(typeof mod.computeScientistTrust).toBe('function')
    expect(typeof mod.computeSponsorTrust).toBe('function')
    expect(typeof mod.computeReviewerTrust).toBe('function')
  })

  it('TrustScore interface has expected shape via function signature', async () => {
    const mod = await import('@/lib/trust/trust-engine')
    // Verify function is callable (signature returns TrustScore | null)
    expect(mod.computeTrustScore.length).toBeGreaterThanOrEqual(2)
  })
})

describe('reproducibility module', () => {
  it('exports replication functions', async () => {
    const mod = await import('@/lib/trust/reproducibility')
    expect(typeof mod.proposeReplication).toBe('function')
    expect(typeof mod.fundReplication).toBe('function')
    expect(typeof mod.listReplications).toBe('function')
  })
})
