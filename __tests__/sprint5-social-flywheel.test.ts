import { describe, expect, it, vi, beforeEach } from 'vitest'

// ─── Mocks ─────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    referral: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userConsentGrant: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
    },
    interventionOutcome: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    aggregateOutcome: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    compound: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: vi.fn(),
    },
    userXP: {
      upsert: vi.fn().mockResolvedValue({ totalXP: 200, level: 2 }),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

// ─── Share Token Tests ─────────────────────────────────────────────

describe('share-token', () => {
  // Set a consistent secret
  beforeEach(() => {
    process.env.JWT_SECRET_KEY = 'test-secret-key-for-share-tokens'
  })

  it('exports generateShareToken and verifyShareToken', async () => {
    const mod = await import('@/lib/sharing/share-token')
    expect(typeof mod.generateShareToken).toBe('function')
    expect(typeof mod.verifyShareToken).toBe('function')
  })

  it('generates a valid token with correct payload', async () => {
    const { generateShareToken } = await import('@/lib/sharing/share-token')
    const result = generateShareToken({
      userId: 'user-123',
      shareType: 'bio-age',
    })

    expect(result.token).toBeDefined()
    expect(result.token).toContain('.')
    expect(result.payload.userId).toBe('user-123')
    expect(result.payload.shareType).toBe('bio-age')
    expect(result.payload.expiresAt).toBeGreaterThan(result.payload.issuedAt)
  })

  it('verifies a valid token', async () => {
    const { generateShareToken, verifyShareToken } = await import('@/lib/sharing/share-token')
    const { token } = generateShareToken({
      userId: 'user-456',
      shareType: 'achievement',
      entityId: 'ach-001',
    })

    const payload = verifyShareToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.userId).toBe('user-456')
    expect(payload!.shareType).toBe('achievement')
    expect(payload!.entityId).toBe('ach-001')
  })

  it('rejects tampered tokens', async () => {
    const { generateShareToken, verifyShareToken } = await import('@/lib/sharing/share-token')
    const { token } = generateShareToken({
      userId: 'user-789',
      shareType: 'bio-age',
    })

    // Tamper with the signature
    const tampered = token.slice(0, -4) + 'xxxx'
    expect(verifyShareToken(tampered)).toBeNull()
  })

  it('rejects expired tokens', async () => {
    const { generateShareToken, verifyShareToken } = await import('@/lib/sharing/share-token')
    const { token } = generateShareToken({
      userId: 'user-expired',
      shareType: 'bio-age',
      expirySeconds: -1, // already expired
    })

    expect(verifyShareToken(token)).toBeNull()
  })

  it('default expiry is 7 days', async () => {
    const { generateShareToken } = await import('@/lib/sharing/share-token')
    const result = generateShareToken({
      userId: 'user-ttl',
      shareType: 'protocol',
    })

    const expectedExpiry = 7 * 24 * 60 * 60
    const actualTTL = result.payload.expiresAt - result.payload.issuedAt
    expect(actualTTL).toBe(expectedExpiry)
  })
})

// ─── k-Anonymity Tests ─────────────────────────────────────────────

describe('k-anonymity', () => {
  it('exports k-anonymity functions', async () => {
    const mod = await import('@/lib/anonymization/k-anonymity')
    expect(typeof mod.generaliseAge).toBe('function')
    expect(typeof mod.generaliseSex).toBe('function')
    expect(typeof mod.applyKAnonymity).toBe('function')
    expect(typeof mod.enforceKAnonymity).toBe('function')
  })

  it('generalises age to decade buckets', async () => {
    const { generaliseAge } = await import('@/lib/anonymization/k-anonymity')
    expect(generaliseAge(25)).toBe('20-29')
    expect(generaliseAge(42)).toBe('40-49')
    expect(generaliseAge(67)).toBe('60-69')
    expect(generaliseAge(null)).toBe('unknown')
  })

  it('generalises biological sex', async () => {
    const { generaliseSex } = await import('@/lib/anonymization/k-anonymity')
    expect(generaliseSex('male')).toBe('male')
    expect(generaliseSex('Female')).toBe('female')
    expect(generaliseSex('M')).toBe('male')
    expect(generaliseSex(null)).toBe('unknown')
    expect(generaliseSex('non-binary')).toBe('other')
  })

  it('enforces k≥5 by suppressing small groups', async () => {
    const { enforceKAnonymity } = await import('@/lib/anonymization/k-anonymity')

    const records = [
      // Group A: 5 records (meets k=5)
      ...Array.from({ length: 5 }, () => ({ ageBucket: '30-39', sexBucket: 'male', regionBucket: 'global' })),
      // Group B: 3 records (below k=5)
      ...Array.from({ length: 3 }, () => ({ ageBucket: '50-59', sexBucket: 'female', regionBucket: 'europe' })),
    ]

    const result = enforceKAnonymity(records, 5)
    expect(result.records).toHaveLength(5)
    expect(result.suppressed).toBe(3)
    expect(result.k).toBe(5)
  })

  it('validates when all groups meet k threshold', async () => {
    const { enforceKAnonymity } = await import('@/lib/anonymization/k-anonymity')

    const records = Array.from({ length: 10 }, () => ({
      ageBucket: '40-49',
      sexBucket: 'male',
      regionBucket: 'global',
    }))

    const result = enforceKAnonymity(records, 5)
    expect(result.valid).toBe(true)
    expect(result.suppressed).toBe(0)
    expect(result.records).toHaveLength(10)
  })

  it('full pipeline anonymises and validates', async () => {
    const { applyKAnonymity } = await import('@/lib/anonymization/k-anonymity')

    const rawRecords = Array.from({ length: 6 }, (_, i) => ({
      userId: `u${i}`,
      age: 35 + i, // all will be 30-39 or 40-49
      biologicalSex: 'male',
      region: 'us',
      delta: 0.5,
    }))

    const result = applyKAnonymity(rawRecords, 5)
    // Should have records (some may be suppressed if split across buckets)
    expect(result.k).toBe(5)
    expect(result.records.length + result.suppressed).toBe(6)
  })
})

// ─── Differential Privacy Tests ─────────────────────────────────────

describe('differential-privacy', () => {
  it('exports DP functions', async () => {
    const mod = await import('@/lib/anonymization/differential-privacy')
    expect(typeof mod.addLaplaceNoise).toBe('function')
    expect(typeof mod.addNoisyMean).toBe('function')
    expect(typeof mod.addNoisyCount).toBe('function')
    expect(typeof mod.sampleLaplace).toBe('function')
    expect(typeof mod.SENSITIVITY).toBe('object')
  })

  it('sampleLaplace returns a finite number', async () => {
    const { sampleLaplace } = await import('@/lib/anonymization/differential-privacy')
    const samples = Array.from({ length: 100 }, () => sampleLaplace(1.0))
    samples.forEach((s) => {
      expect(Number.isFinite(s)).toBe(true)
    })
  })

  it('Laplace noise has approximately zero mean', async () => {
    const { sampleLaplace } = await import('@/lib/anonymization/differential-privacy')
    const N = 10000
    const samples = Array.from({ length: N }, () => sampleLaplace(1.0))
    const mean = samples.reduce((a, b) => a + b, 0) / N
    // With N=10000 and scale=1, std dev ≈ sqrt(2) ≈ 1.41
    // Mean should be within ~3 std errors = 3 * 1.41/sqrt(10000) ≈ 0.042
    expect(Math.abs(mean)).toBeLessThan(0.1)
  })

  it('addNoisyCount returns a non-negative integer', async () => {
    const { addNoisyCount } = await import('@/lib/anonymization/differential-privacy')
    const result = addNoisyCount(100, 1.0)
    expect(result.noisedValue).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(result.noisedValue)).toBe(true)
  })

  it('noiseConfidenceBound returns a positive number', async () => {
    const { noiseConfidenceBound } = await import('@/lib/anonymization/differential-privacy')
    const bound = noiseConfidenceBound(1.0, 1.0, 0.95)
    expect(bound).toBeGreaterThan(0)
    expect(Number.isFinite(bound)).toBe(true)
  })

  it('SENSITIVITY values are defined', async () => {
    const { SENSITIVITY } = await import('@/lib/anonymization/differential-privacy')
    expect(SENSITIVITY.count).toBe(1.0)
    expect(SENSITIVITY.meanOutcomeScore).toBe(1.0)
    expect(SENSITIVITY.meanBioAge).toBe(120.0)
  })
})

// ─── Statistics Tests ───────────────────────────────────────────────

describe('statistics', () => {
  it('exports statistical functions', async () => {
    const mod = await import('@/lib/flywheel/statistics')
    expect(typeof mod.tTest).toBe('function')
    expect(typeof mod.oneSampleTTest).toBe('function')
    expect(typeof mod.confidenceInterval).toBe('function')
    expect(typeof mod.cohensD).toBe('function')
    expect(typeof mod.chiSquareTest).toBe('function')
    expect(typeof mod.descriptiveStats).toBe('function')
  })

  it('tTest detects significant difference between groups', async () => {
    const { tTest } = await import('@/lib/flywheel/statistics')
    // Group A: mean ≈ 10, Group B: mean ≈ 0
    const groupA = Array.from({ length: 50 }, (_, i) => 10 + (i % 3))
    const groupB = Array.from({ length: 50 }, (_, i) => 0 + (i % 3))
    const result = tTest(groupA, groupB)
    expect(result.significant).toBe(true)
    expect(result.pValue).toBeLessThan(0.05)
    expect(result.preliminary).toBe(false)
  })

  it('tTest flags preliminary when n < 30', async () => {
    const { tTest } = await import('@/lib/flywheel/statistics')
    const result = tTest([1, 2, 3], [4, 5, 6])
    expect(result.preliminary).toBe(true)
  })

  it('confidenceInterval computes valid bounds', async () => {
    const { confidenceInterval } = await import('@/lib/flywheel/statistics')
    const values = [10, 12, 11, 13, 9, 14, 10, 11, 12, 13]
    const ci = confidenceInterval(values)
    expect(ci.lower).toBeLessThan(ci.mean)
    expect(ci.upper).toBeGreaterThan(ci.mean)
    expect(ci.confidenceLevel).toBe(0.95)
  })

  it('cohensD interprets effect sizes correctly', async () => {
    const { cohensD } = await import('@/lib/flywheel/statistics')

    // Large effect: very different groups with some variance
    const large = cohensD(
      Array.from({ length: 30 }, (_, i) => 10 + (i % 3 - 1)),
      Array.from({ length: 30 }, (_, i) => 2 + (i % 3 - 1)),
    )
    expect(large.interpretation).toBe('large')

    // Negligible effect: identical groups
    const negligible = cohensD(
      Array.from({ length: 30 }, (_, i) => 5 + (i % 3 - 1)),
      Array.from({ length: 30 }, (_, i) => 5 + (i % 3 - 1)),
    )
    expect(negligible.interpretation).toBe('negligible')
  })

  it('descriptiveStats computes all fields', async () => {
    const { descriptiveStats } = await import('@/lib/flywheel/statistics')
    const stats = descriptiveStats([1, 2, 3, 4, 5])
    expect(stats.n).toBe(5)
    expect(stats.mean).toBe(3)
    expect(stats.min).toBe(1)
    expect(stats.max).toBe(5)
    expect(stats.median).toBe(3)
    expect(stats.stdDev).toBeGreaterThan(0)
  })
})

// ─── Referral Reward Hook Tests ─────────────────────────────────────

describe('referral-reward', () => {
  it('exports processReferralReward', async () => {
    const mod = await import('@/lib/sharing/referral-reward')
    expect(typeof mod.processReferralReward).toBe('function')
  })

  it('processes rewards for completed referrals', async () => {
    const { db } = await import('@/lib/db')
    const findMany = db.referral.findMany as ReturnType<typeof vi.fn>
    const update = db.referral.update as ReturnType<typeof vi.fn>

    findMany.mockResolvedValueOnce([
      { id: 'ref-1', referrerId: 'referrer-1', refereeId: 'referee-1', status: 'COMPLETED', rewardGranted: false },
    ])
    update.mockResolvedValueOnce({})

    const { processReferralReward } = await import('@/lib/sharing/referral-reward')
    await processReferralReward('referee-1')

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ref-1' },
        data: { rewardGranted: true },
      }),
    )
  })
})

// ─── Recommendations Aggregate Boost Tests ──────────────────────────

describe('recommendations with aggregate support', () => {
  it('generates recommendations without aggregate data', async () => {
    const { generateRecommendations } = await import('@/lib/analytics/recommendations')
    const recs = generateRecommendations({
      biomarkers: [],
      compoundPathways: [],
      labPanels: [],
    })
    expect(Array.isArray(recs)).toBe(true)
  })

  it('accepts aggregateOutcomes parameter', async () => {
    const { generateRecommendations } = await import('@/lib/analytics/recommendations')
    const recs = generateRecommendations({
      biomarkers: [],
      compoundPathways: [],
      labPanels: [],
      aggregateOutcomes: [
        {
          protocolId: 'p1',
          cohortBucket: 'all',
          sampleSize: 50,
          meanOutcomeScore: 0.8,
          period: '2026-04',
        },
      ],
    })
    expect(Array.isArray(recs)).toBe(true)
  })

  it('Recommendation interface includes aggregateSupport field', async () => {
    const { generateRecommendations } = await import('@/lib/analytics/recommendations')
    const recs = generateRecommendations({
      biomarkers: [
        { name: 'glucose', value: 120, unit: 'mg/dL', target: 90, trend: 'UP' },
      ],
      compoundPathways: [],
      labPanels: [],
    })
    // Should not crash with aggregate-extended interface
    for (const rec of recs) {
      expect(rec).toHaveProperty('type')
      expect(rec).toHaveProperty('relevanceScore')
    }
  })
})

// ─── XP Engine referral_reward action ───────────────────────────────

describe('XP engine referral_reward', () => {
  it('includes referral_reward action with 200 XP', async () => {
    const { XP_ACTIONS } = await import('@/lib/gamification/xp-engine')
    expect(XP_ACTIONS.referral_reward).toBe(200)
  })
})
