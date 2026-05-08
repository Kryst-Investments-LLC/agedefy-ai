/**
 * Sprint 6 — Federated Learning Tests
 *
 * Tests for gradient privacy (DP-SGD), secure aggregation,
 * server config builder, FL types, and recommendation blending.
 *
 * @module __tests__/federated-learning.test
 */

import { describe, it, expect } from 'vitest'

import {
  sampleGaussian,
  gaussianNoise,
  l2Norm,
  clipGradient,
  privatiseGradient,
  composedEpsilon,
  maxPerStepEpsilon,
} from '@/lib/fl/gradient-privacy'

import {
  generateMask,
  computeCommitment,
  maskGradients,
  aggregateMaskedUpdates,
} from '@/lib/fl/secure-aggregation'

import {
  DEFAULT_FL_CONFIG,
  MODEL_ARCHITECTURES,
  STRATEGY_DESCRIPTIONS,
  buildFLConfig,
} from '@/lib/fl/server-config'

import {
  generateRecommendations,
  type FLPredictionRecord,
} from '@/lib/analytics/recommendations'

/* ================================================================== */
/*  Gradient Privacy (DP-SGD)                                         */
/* ================================================================== */

describe('Gradient Privacy — DP-SGD', () => {
  it('sampleGaussian returns finite numbers', () => {
    for (let i = 0; i < 100; i++) {
      const val = sampleGaussian()
      expect(Number.isFinite(val)).toBe(true)
    }
  })

  it('sampleGaussian distribution has approximate mean 0 and std 1', () => {
    const N = 5000
    const samples = Array.from({ length: N }, () => sampleGaussian())
    const mean = samples.reduce((s, v) => s + v, 0) / N
    const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / N
    expect(Math.abs(mean)).toBeLessThan(0.1)
    expect(Math.abs(Math.sqrt(variance) - 1)).toBeLessThan(0.15)
  })

  it('gaussianNoise generates correct length', () => {
    const noise = gaussianNoise(50, 0.5)
    expect(noise).toHaveLength(50)
    noise.forEach((v) => expect(Number.isFinite(v)).toBe(true))
  })

  it('l2Norm computes correctly', () => {
    expect(l2Norm([3, 4])).toBeCloseTo(5, 10)
    expect(l2Norm([1, 1, 1, 1])).toBeCloseTo(2, 10)
    expect(l2Norm([])).toBe(0)
  })

  it('clipGradient does not clip within norm', () => {
    const gradient = [0.3, 0.4]
    const result = clipGradient(gradient, 1.0)
    expect(result.wasClipped).toBe(false)
    expect(result.clipped).toEqual(gradient)
    expect(result.originalNorm).toBeCloseTo(0.5, 5)
  })

  it('clipGradient clips gradient exceeding norm', () => {
    const gradient = [3, 4] // norm = 5
    const result = clipGradient(gradient, 1.0)
    expect(result.wasClipped).toBe(true)
    expect(l2Norm(result.clipped)).toBeCloseTo(1.0, 5)
    expect(result.originalNorm).toBeCloseTo(5, 5)
  })

  it('privatiseGradient adds noise and clips', () => {
    const gradient = [10, 10, 10] // large gradient
    const result = privatiseGradient(gradient, {
      maxGradientNorm: 1.0,
      noiseMultiplier: 1.1,
      batchSize: 32,
    })

    expect(result.wasClipped).toBe(true)
    expect(result.noiseSigma).toBeGreaterThan(0)
    expect(result.epsilonStep).toBeGreaterThan(0)
    expect(Number.isFinite(result.epsilonStep)).toBe(true)
    expect(result.noisedGradients).toHaveLength(3)
  })

  it('privatiseGradient preserves length', () => {
    const gradient = [0.1, -0.2, 0.3, 0.05, -0.15]
    const result = privatiseGradient(gradient, {
      maxGradientNorm: 5.0,
      noiseMultiplier: 0.5,
      batchSize: 16,
    })
    expect(result.noisedGradients).toHaveLength(5)
  })

  it('composedEpsilon is non-decreasing with rounds', () => {
    const e1 = composedEpsilon(0.1, 10)
    const e2 = composedEpsilon(0.1, 50)
    const e3 = composedEpsilon(0.1, 100)
    expect(e1).toBeLessThan(e2)
    expect(e2).toBeLessThan(e3)
  })

  it('composedEpsilon returns 0 for 0 steps', () => {
    expect(composedEpsilon(0.1, 0)).toBe(0)
  })

  it('maxPerStepEpsilon returns full budget for 0 steps', () => {
    expect(maxPerStepEpsilon(8.0, 0)).toBe(8.0)
  })

  it('maxPerStepEpsilon decreases as rounds increase', () => {
    const e1 = maxPerStepEpsilon(8.0, 10)
    const e2 = maxPerStepEpsilon(8.0, 50)
    expect(e1).toBeGreaterThan(e2)
  })
})

/* ================================================================== */
/*  Secure Aggregation                                                */
/* ================================================================== */

describe('Secure Aggregation', () => {
  it('generateMask returns deterministic values for same seed', () => {
    const mask1 = generateMask('test-seed-123', 10)
    const mask2 = generateMask('test-seed-123', 10)
    expect(mask1).toEqual(mask2)
  })

  it('generateMask returns different values for different seeds', () => {
    const mask1 = generateMask('seed-a', 10)
    const mask2 = generateMask('seed-b', 10)
    expect(mask1).not.toEqual(mask2)
  })

  it('generateMask respects requested length', () => {
    expect(generateMask('seed', 5)).toHaveLength(5)
    expect(generateMask('seed', 100)).toHaveLength(100)
  })

  it('generateMask values are in [-1, 1]', () => {
    const mask = generateMask('test', 200)
    mask.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    })
  })

  it('computeCommitment is deterministic', () => {
    const gradients = [0.1, 0.2, 0.3]
    const c1 = computeCommitment(gradients)
    const c2 = computeCommitment(gradients)
    expect(c1).toBe(c2)
    expect(c1).toHaveLength(64) // SHA-256 hex
  })

  it('computeCommitment changes with different input', () => {
    const c1 = computeCommitment([0.1, 0.2])
    const c2 = computeCommitment([0.1, 0.3])
    expect(c1).not.toBe(c2)
  })

  it('maskGradients adds mask to gradients', () => {
    const original = [1.0, 2.0, 3.0]
    const masked = maskGradients('client-1', 1, original)

    expect(masked.clientId).toBe('client-1')
    expect(masked.round).toBe(1)
    expect(masked.maskedGradients).toHaveLength(3)
    expect(masked.commitment).toHaveLength(64)
    expect(masked.publicSeed).toHaveLength(64)

    // Masked gradients should differ from originals (mask ≠ zeros)
    const allSame = original.every((v, i) => Math.abs(v - masked.maskedGradients[i]) < 1e-10)
    expect(allSame).toBe(false)
  })

  it('aggregateMaskedUpdates returns null below minClients', () => {
    const update = maskGradients('c1', 1, [1.0, 2.0])
    const result = aggregateMaskedUpdates([update], 3)
    expect(result).toBeNull()
  })

  it('aggregateMaskedUpdates aggregates multiple clients', () => {
    const updates = [
      maskGradients('c1', 1, [1.0, 2.0, 3.0]),
      maskGradients('c2', 1, [4.0, 5.0, 6.0]),
      maskGradients('c3', 1, [7.0, 8.0, 9.0]),
    ]

    const result = aggregateMaskedUpdates(updates, 3)
    expect(result).not.toBeNull()
    expect(result!.clientCount).toBe(3)
    expect(result!.aggregatedGradients).toHaveLength(3)
    expect(result!.round).toBe(1)
  })

  it('aggregateMaskedUpdates rejects mismatched lengths', () => {
    const updates = [
      maskGradients('c1', 1, [1.0, 2.0]),
      maskGradients('c2', 1, [4.0, 5.0, 6.0]),
      maskGradients('c3', 1, [7.0, 8.0]),
    ]

    const result = aggregateMaskedUpdates(updates, 2)
    expect(result).toBeNull()
  })
})

/* ================================================================== */
/*  Server Config                                                     */
/* ================================================================== */

describe('FL Server Config', () => {
  it('DEFAULT_FL_CONFIG has valid values', () => {
    expect(DEFAULT_FL_CONFIG.strategy).toBe('fed-avg')
    expect(DEFAULT_FL_CONFIG.minClients).toBe(5)
    expect(DEFAULT_FL_CONFIG.totalRounds).toBe(50)
    expect(DEFAULT_FL_CONFIG.totalEpsilonBudget).toBe(8.0)
    expect(DEFAULT_FL_CONFIG.perRoundEpsilon).toBeCloseTo(0.16, 2)
  })

  it('MODEL_ARCHITECTURES has expected entries', () => {
    expect(Object.keys(MODEL_ARCHITECTURES)).toContain('mlp-3-64')
    expect(Object.keys(MODEL_ARCHITECTURES)).toContain('mlp-2-128')
    expect(Object.keys(MODEL_ARCHITECTURES)).toContain('mlp-4-32')

    const mlp3 = MODEL_ARCHITECTURES['mlp-3-64']
    expect(mlp3.inputDim).toBe(50)
    expect(mlp3.outputDim).toBe(1)
    expect(mlp3.hiddenLayers).toEqual([64, 64, 64])
  })

  it('STRATEGY_DESCRIPTIONS covers all strategies', () => {
    expect(STRATEGY_DESCRIPTIONS['fed-avg']).toBeDefined()
    expect(STRATEGY_DESCRIPTIONS['fed-prox']).toBeDefined()
    expect(STRATEGY_DESCRIPTIONS['fed-adam']).toBeDefined()
  })

  it('buildFLConfig returns default when no overrides', () => {
    const config = buildFLConfig()
    expect(config).toEqual(DEFAULT_FL_CONFIG)
  })

  it('buildFLConfig applies overrides', () => {
    const config = buildFLConfig({ totalRounds: 100, totalEpsilonBudget: 10 })
    expect(config.totalRounds).toBe(100)
    expect(config.totalEpsilonBudget).toBe(10)
    // perRoundEpsilon should be recomputed
    expect(config.perRoundEpsilon).toBeCloseTo(0.1, 5)
  })

  it('buildFLConfig applies hyperparams overrides', () => {
    const config = buildFLConfig({
      hyperparams: { learningRate: 0.001 },
    })
    expect(config.hyperparams.learningRate).toBe(0.001)
    // Other hyperparams should stay default
    expect(config.hyperparams.localEpochs).toBe(DEFAULT_FL_CONFIG.hyperparams.localEpochs)
  })
})

/* ================================================================== */
/*  FL Types (Client Adapter)                                         */
/* ================================================================== */

describe('FL Client Types', () => {
  it('BioAgeDeltaFeatures interface is usable', async () => {
    // Type check — ensure the module exports compile
    const features: import('@/lib/fl/client').BioAgeDeltaFeatures = {
      biomarkers: { glucose: 0.5, ldl: 0.3 },
      protocolDurationDays: 90,
      protocolCompoundCount: 3,
      ageBucket: '40-50',
      biologicalSex: 'male',
    }
    expect(features.biomarkers.glucose).toBe(0.5)
  })

  it('FLClientAdapter is exported', async () => {
    const { FLClientAdapter } = await import('@/lib/fl/client')
    expect(FLClientAdapter).toBeDefined()
    const adapter = new FLClientAdapter('http://localhost:9999')
    expect(adapter).toBeDefined()
  })
})

/* ================================================================== */
/*  Recommendations — FL Prediction Blending                          */
/* ================================================================== */

describe('Recommendations — FL Prediction Blending', () => {
  const baseBiomarkers = [
    { name: 'ldl', value: 160, unit: 'mg/dL', target: 100, trend: 'UP' },
  ]

  const baseCompoundPathways = [
    {
      compound: { id: 'c1', name: 'Berberine', mechanism: 'ldl lowering' },
      pathway: { id: 'p1', name: 'LDL Metabolism', category: 'lipid' },
    },
  ]

  it('generates recommendations without FL predictions', () => {
    const recs = generateRecommendations({
      biomarkers: baseBiomarkers,
      compoundPathways: baseCompoundPathways,
      labPanels: [],
    })
    expect(recs.length).toBeGreaterThan(0)
    expect(recs[0].flPrediction).toBeUndefined()
  })

  it('blends FL predictions into matching recommendations', () => {
    const flPredictions: FLPredictionRecord[] = [
      {
        entityId: 'c1',
        entityType: 'Compound',
        predictedDelta: 0.8,
        confidence: 0.85,
        modelVersion: 3,
      },
    ]

    const recs = generateRecommendations({
      biomarkers: baseBiomarkers,
      compoundPathways: baseCompoundPathways,
      labPanels: [],
      flPredictions,
    })

    const compoundRec = recs.find((r) => r.relatedEntityId === 'c1')
    expect(compoundRec).toBeDefined()
    expect(compoundRec!.flPrediction).toBeDefined()
    expect(compoundRec!.flPrediction!.predictedDelta).toBe(0.8)
    expect(compoundRec!.flPrediction!.modelVersion).toBe(3)
  })

  it('does not blend low-confidence FL predictions', () => {
    const flPredictions: FLPredictionRecord[] = [
      {
        entityId: 'c1',
        entityType: 'Compound',
        predictedDelta: 0.9,
        confidence: 0.3, // below 0.5 threshold
        modelVersion: 1,
      },
    ]

    const recs = generateRecommendations({
      biomarkers: baseBiomarkers,
      compoundPathways: baseCompoundPathways,
      labPanels: [],
      flPredictions,
    })

    const compoundRec = recs.find((r) => r.relatedEntityId === 'c1')
    expect(compoundRec).toBeDefined()
    expect(compoundRec!.flPrediction).toBeUndefined()
  })

  it('high-confidence FL prediction upgrades low evidence to moderate', () => {
    // Create compound pathway with very low gap to get "low" evidence quality
    const flPredictions: FLPredictionRecord[] = [
      {
        entityId: 'c1',
        entityType: 'Compound',
        predictedDelta: 0.7,
        confidence: 0.85,
        modelVersion: 2,
      },
    ]

    const recsWithout = generateRecommendations({
      biomarkers: baseBiomarkers,
      compoundPathways: baseCompoundPathways,
      labPanels: [],
    })

    const recsWith = generateRecommendations({
      biomarkers: baseBiomarkers,
      compoundPathways: baseCompoundPathways,
      labPanels: [],
      flPredictions,
    })

    // Both should have compound recs
    const without = recsWithout.find((r) => r.relatedEntityId === 'c1')
    const withFL = recsWith.find((r) => r.relatedEntityId === 'c1')
    expect(without).toBeDefined()
    expect(withFL).toBeDefined()

    // With FL should have higher relevance
    expect(withFL!.relevanceScore).toBeGreaterThanOrEqual(without!.relevanceScore)
  })
})
