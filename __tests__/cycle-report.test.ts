import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// cycle-report — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  loopCycleFindUnique: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    loopCycle: {
      findUnique: mocks.loopCycleFindUnique,
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}))

import { generateCycleReport, CYCLE_REPORT_DISCLAIMER } from '@/lib/reports/cycle-report'

const BASE_CYCLE = {
  id: 'cycle-1',
  userId: 'user-1',
  startedAt: new Date('2026-05-01'),
  completedAt: new Date('2026-05-29'),
  snapshot: { biomarkersJson: '[]', activeProtocolId: 'proto-1' },
  protocolOutcome: null,
  reflectionReport: null,
}

describe('generateCycleReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when cycle is not found', async () => {
    mocks.loopCycleFindUnique.mockResolvedValue(null)
    const result = await generateCycleReport('missing-cycle')
    expect(result).toBeNull()
    expect(mocks.loggerWarn).toHaveBeenCalled()
  })

  it('returns a valid report for a cycle with no outcome or reflection', async () => {
    mocks.loopCycleFindUnique.mockResolvedValue(BASE_CYCLE)
    const report = await generateCycleReport('cycle-1')

    expect(report).not.toBeNull()
    expect(report!.loopCycleId).toBe('cycle-1')
    expect(report!.userId).toBe('user-1')
    expect(report!.disclaimer).toBe(CYCLE_REPORT_DISCLAIMER)
    expect(report!.biomarkerSummary).toEqual([])
    expect(report!.agentInsights).toEqual([])
    expect(report!.nextCycleRecommendations.length).toBeGreaterThan(0)
  })

  it('includes default recommendation when no specific issues', async () => {
    mocks.loopCycleFindUnique.mockResolvedValue(BASE_CYCLE)
    const report = await generateCycleReport('cycle-1')
    expect(report!.nextCycleRecommendations[0]).toContain('Continue current protocol')
  })

  it('builds biomarker summary from outcome targetBiomarkers', async () => {
    mocks.loopCycleFindUnique.mockResolvedValue({
      ...BASE_CYCLE,
      protocolOutcome: {
        protocolId: 'proto-1',
        overallEfficacy: 0.75,
        twinPredictionAccuracy: 0.85,
        targetBiomarkers: [
          { name: 'CRP', predictedDelta: -1.5, predictedDirection: 'down' },
        ],
        observedBiomarkers: [
          { name: 'CRP', observedDelta: -1.2, observedDirection: 'down', confidence: 0.9 },
        ],
      },
    })

    const report = await generateCycleReport('cycle-1')
    expect(report!.biomarkerSummary).toHaveLength(1)
    const crp = report!.biomarkerSummary[0]
    expect(crp.name).toBe('CRP')
    expect(crp.delta).toBeCloseTo(-1.2)
    expect(crp.direction).toBe('down')
    expect(crp.accuracyVsPrediction).toBe('within_range')
  })

  it('marks over_response when observed >> predicted', async () => {
    mocks.loopCycleFindUnique.mockResolvedValue({
      ...BASE_CYCLE,
      protocolOutcome: {
        protocolId: 'proto-1',
        overallEfficacy: 0.9,
        twinPredictionAccuracy: 0.7,
        targetBiomarkers: [
          { name: 'CRP', predictedDelta: -1.0, predictedDirection: 'down' },
        ],
        observedBiomarkers: [
          { name: 'CRP', observedDelta: -2.0, observedDirection: 'down', confidence: 0.9 },
        ],
      },
    })

    const report = await generateCycleReport('cycle-1')
    expect(report!.biomarkerSummary[0].accuracyVsPrediction).toBe('over_response')
  })

  it('marks opposite when observed direction reversed from predicted', async () => {
    mocks.loopCycleFindUnique.mockResolvedValue({
      ...BASE_CYCLE,
      protocolOutcome: {
        protocolId: 'proto-1',
        overallEfficacy: 0.2,
        twinPredictionAccuracy: 0.4,
        targetBiomarkers: [
          { name: 'CRP', predictedDelta: -1.0, predictedDirection: 'down' },
        ],
        observedBiomarkers: [
          { name: 'CRP', observedDelta: 1.0, observedDirection: 'up', confidence: 0.9 },
        ],
      },
    })

    const report = await generateCycleReport('cycle-1')
    expect(report!.biomarkerSummary[0].accuracyVsPrediction).toBe('opposite')
  })

  it('sets high twin accuracy interpretation when accuracy >= 0.8', async () => {
    mocks.loopCycleFindUnique.mockResolvedValue({
      ...BASE_CYCLE,
      protocolOutcome: {
        protocolId: 'proto-1',
        overallEfficacy: 0.9,
        twinPredictionAccuracy: 0.85,
        targetBiomarkers: [],
        observedBiomarkers: [],
      },
    })

    const report = await generateCycleReport('cycle-1')
    expect(report!.twinAccuracy.interpretation).toContain('High accuracy')
  })

  it('recommends calibration when twin accuracy < 0.6', async () => {
    mocks.loopCycleFindUnique.mockResolvedValue({
      ...BASE_CYCLE,
      protocolOutcome: {
        protocolId: 'proto-1',
        overallEfficacy: 0.5,
        twinPredictionAccuracy: 0.45,
        targetBiomarkers: [],
        observedBiomarkers: [],
      },
    })

    const report = await generateCycleReport('cycle-1')
    expect(report!.twinAccuracy.interpretation).toContain('Low accuracy')
    expect(report!.nextCycleRecommendations.some((r) => r.includes('calibration'))).toBe(true)
  })

  it('includes reflection agent insights', async () => {
    mocks.loopCycleFindUnique.mockResolvedValue({
      ...BASE_CYCLE,
      reflectionReport: {
        insights: ['CRP improving', 'Protocol adherence good'],
        twinAccuracyDelta: 0.05,
      },
    })

    const report = await generateCycleReport('cycle-1')
    expect(report!.agentInsights).toHaveLength(2)
    expect(report!.agentInsights[0]).toBe('CRP improving')
  })

  it('returns null and logs error on DB failure', async () => {
    mocks.loopCycleFindUnique.mockRejectedValue(new Error('db connection lost'))
    const result = await generateCycleReport('cycle-1')
    expect(result).toBeNull()
    expect(mocks.loggerError).toHaveBeenCalled()
  })
})
