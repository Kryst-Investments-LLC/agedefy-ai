import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
  delete process.env.MECHANISTIC_SIDECAR_URL
  vi.resetModules()
})

afterEach(() => {
  delete process.env.MECHANISTIC_SIDECAR_URL
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('digital-twin-agent (T3)', () => {
  it('uses the deterministic fallback when no sidecar is configured', async () => {
    const { runDigitalTwinAgent } = await import('@/lib/agents/digital-twin-agent')
    const result = await runDigitalTwinAgent({
      baseline: { hs_crp: 2.0, ldl: 130 },
      interventions: [
        { intervention_id: 'rapamycin_6mg_weekly', dose: 6, schedule: 'weekly', start_week: 0 },
        { intervention_id: 'statin_atorva_20mg', dose: 20, schedule: 'daily', start_week: 4 },
      ],
      outcomes: ['hs_crp', 'ldl'],
      horizonWeeks: 52,
    })

    expect(result.fallbackUsed).toBe(true)
    expect(result.backend_used).toBe('fallback-exponential')
    expect(result.model_version).toMatch(/^fallback-exponential@/)
    expect(result.horizon_weeks).toBe(52)
    expect(result.trajectories.hs_crp.weekly_means).toHaveLength(52)
    // hs_crp under rapamycin should trend down over 52 weeks
    expect(result.trajectories.hs_crp.weekly_means[51]).toBeLessThan(2.0)
    // LDL doesn't move until statin starts at week 4
    expect(result.trajectories.ldl.weekly_means[0]).toBeCloseTo(130, 1)
    expect(result.trajectories.ldl.weekly_means[51]).toBeLessThan(130)
    // CI bands envelope the mean
    expect(result.trajectories.hs_crp.ci95_low[10]).toBeLessThan(
      result.trajectories.hs_crp.weekly_means[10],
    )
    expect(result.trajectories.hs_crp.ci95_high[10]).toBeGreaterThan(
      result.trajectories.hs_crp.weekly_means[10],
    )
    // contributors split summed to ~1 at the final week
    const sum = Object.values(result.trajectories.hs_crp.contributors ?? {}).reduce(
      (a, b) => a + b,
      0,
    )
    expect(sum).toBeGreaterThan(0.99)
    expect(sum).toBeLessThan(1.01)
  })

  it('flags unknown intervention/outcome combos with low_confidence_flag', async () => {
    const { runDigitalTwinAgent } = await import('@/lib/agents/digital-twin-agent')
    const result = await runDigitalTwinAgent({
      baseline: { hs_crp: 2.0 },
      interventions: [
        { intervention_id: 'nicotinamide_riboside_300mg', dose: 300, schedule: 'daily', start_week: 0 },
      ],
      outcomes: ['hs_crp'],
      horizonWeeks: 16,
    })
    expect(result.trajectories.hs_crp.low_confidence_flag).toBe(true)
  })

  it('clamps horizons over the 25-year max', async () => {
    const { runDigitalTwinAgent } = await import('@/lib/agents/digital-twin-agent')
    const result = await runDigitalTwinAgent({
      baseline: { hs_crp: 2.0 },
      interventions: [],
      outcomes: ['hs_crp'],
      horizonWeeks: 9999,
    })
    expect(result.horizon_weeks).toBe(1300)
    expect(result.trajectories.hs_crp.weekly_means).toHaveLength(1300)
  })

  it('rejects invalid input with DigitalTwinValidationError', async () => {
    const { runDigitalTwinAgent, DigitalTwinValidationError } = await import(
      '@/lib/agents/digital-twin-agent'
    )
    await expect(
      runDigitalTwinAgent({
        baseline: { hs_crp: 2.0 },
        interventions: [],
        outcomes: [],
        horizonWeeks: 52,
      }),
    ).rejects.toBeInstanceOf(DigitalTwinValidationError)

    await expect(
      runDigitalTwinAgent({
        baseline: { hs_crp: 2.0 },
        interventions: [],
        outcomes: ['hs_crp'],
        horizonWeeks: 1,
      }),
    ).rejects.toBeInstanceOf(DigitalTwinValidationError)
  })

  it('calls the mechanistic-sidecar when configured and returns its trajectory', async () => {
    process.env.MECHANISTIC_SIDECAR_URL = 'http://mech.test'
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        simulation_id: 'sim-abc',
        horizon_weeks: 52,
        backend_used: 'hybrid',
        model_version: 'mechanistic-sidecar@1.2.3',
        trajectories: {
          hs_crp: {
            weekly_means: new Array(52).fill(1.5),
            ci95_low: new Array(52).fill(1.2),
            ci95_high: new Array(52).fill(1.8),
            contributors: { rapamycin_6mg_weekly: 1.0 },
          },
        },
      }),
    )

    const { runDigitalTwinAgent } = await import('@/lib/agents/digital-twin-agent')
    const result = await runDigitalTwinAgent({
      baseline: { hs_crp: 2.0 },
      interventions: [
        { intervention_id: 'rapamycin_6mg_weekly', dose: 6, schedule: 'weekly', start_week: 0 },
      ],
      outcomes: ['hs_crp'],
      horizonWeeks: 52,
    })

    expect(result.fallbackUsed).toBe(false)
    expect(result.backend_used).toBe('hybrid')
    expect(result.model_version).toBe('mechanistic-sidecar@1.2.3')
    expect(fetchMock.mock.calls[0][0]).toBe('http://mech.test/v1/simulate')
  })

  it('falls back to the local simulator when the sidecar returns 5xx', async () => {
    process.env.MECHANISTIC_SIDECAR_URL = 'http://mech.test'
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'solver_unavailable' }, 503))

    const { runDigitalTwinAgent } = await import('@/lib/agents/digital-twin-agent')
    const result = await runDigitalTwinAgent({
      baseline: { hs_crp: 2.0 },
      interventions: [
        { intervention_id: 'rapamycin_6mg_weekly', dose: 6, schedule: 'weekly', start_week: 0 },
      ],
      outcomes: ['hs_crp'],
      horizonWeeks: 16,
    })

    expect(result.fallbackUsed).toBe(true)
    expect(result.backend_used).toBe('fallback-exponential')
  })

  it('propagates 4xx errors from the sidecar without falling back silently', async () => {
    process.env.MECHANISTIC_SIDECAR_URL = 'http://mech.test'
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'unknown_intervention' }, 422))

    const { runDigitalTwinAgent } = await import('@/lib/agents/digital-twin-agent')
    const { SidecarError } = await import('@/lib/sidecars')

    await expect(
      runDigitalTwinAgent({
        baseline: { hs_crp: 2.0 },
        interventions: [
          { intervention_id: 'rapamycin_6mg_weekly', dose: 6, schedule: 'weekly', start_week: 0 },
        ],
        outcomes: ['hs_crp'],
        horizonWeeks: 16,
      }),
    ).rejects.toBeInstanceOf(SidecarError)
  })
})
