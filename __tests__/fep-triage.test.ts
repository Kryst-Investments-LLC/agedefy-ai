import { describe, it, expect } from 'vitest'

import {
  computeFepGateScore,
  type FepTriageInput,
  type ScreenSummary,
  type DockSummary,
} from '@/lib/chemistry/fep-triage'

// ── Fixtures ────────────────────────────────────────────────────────────────

const strongDock: DockSummary = { binding_affinity_kcal_mol: -10.5 }
const goodDock: DockSummary = { binding_affinity_kcal_mol: -8.0 }
const weakDock: DockSummary = { binding_affinity_kcal_mol: -4.5 }

const cleanScreen: ScreenSummary = {
  valid: true,
  qed: 0.75,
  lipinski_pass: true,
  pains_pass: true,
  herg_risk: false,
}

const painsScreen: ScreenSummary = {
  valid: true,
  qed: 0.6,
  lipinski_pass: true,
  pains_pass: false,  // PAINS alert — hard disqualifier
  herg_risk: false,
}

const invalidScreen: ScreenSummary = {
  valid: false,
  qed: null,
  lipinski_pass: null,
  pains_pass: null,
  herg_risk: null,
}

// ── Hard gates ───────────────────────────────────────────────────────────────

describe('computeFepGateScore — hard gates', () => {
  it('returns score=0 and recommend=false when dock is null', () => {
    const result = computeFepGateScore({ screen: cleanScreen, dock: null, acquisitionScore: 1.0 })
    expect(result.score).toBe(0)
    expect(result.recommend).toBe(false)
    expect(result.reason).toMatch(/No docking result/)
  })

  it('returns score=0 and recommend=false when PAINS alert is present', () => {
    const result = computeFepGateScore({ screen: painsScreen, dock: strongDock, acquisitionScore: 1.0 })
    expect(result.score).toBe(0)
    expect(result.recommend).toBe(false)
    expect(result.reason).toMatch(/PAINS/)
  })

  it('returns score=0 and recommend=false when SMILES is invalid', () => {
    const result = computeFepGateScore({ screen: invalidScreen, dock: strongDock, acquisitionScore: 1.0 })
    expect(result.score).toBe(0)
    expect(result.recommend).toBe(false)
    expect(result.reason).toMatch(/Invalid SMILES/)
  })
})

// ── Affinity scoring ─────────────────────────────────────────────────────────

describe('computeFepGateScore — affinity scoring', () => {
  it('gives full affinity score for very strong binder (-11 kcal/mol)', () => {
    const result = computeFepGateScore({
      screen: cleanScreen,
      dock: { binding_affinity_kcal_mol: -11.0 },
      acquisitionScore: 0.5,
    })
    expect(result.components.affinityScore).toBeCloseTo(1.0, 2)
  })

  it('gives zero affinity score for weak binder (-5 kcal/mol)', () => {
    const result = computeFepGateScore({
      screen: cleanScreen,
      dock: { binding_affinity_kcal_mol: -5.0 },
      acquisitionScore: 0.5,
    })
    expect(result.components.affinityScore).toBeCloseTo(0.0, 2)
  })

  it('gives ~0.5 affinity score for moderate binder (-8 kcal/mol)', () => {
    const result = computeFepGateScore({
      screen: cleanScreen,
      dock: { binding_affinity_kcal_mol: -8.0 },
      acquisitionScore: 0.5,
    })
    expect(result.components.affinityScore).toBeCloseTo(0.5, 2)
  })

  it('clamps affinity score at 0 for very weak binders (< -5)', () => {
    const result = computeFepGateScore({
      screen: cleanScreen,
      dock: { binding_affinity_kcal_mol: -2.0 },
      acquisitionScore: 0.5,
    })
    expect(result.components.affinityScore).toBe(0)
  })
})

// ── Drug-likeness scoring ────────────────────────────────────────────────────

describe('computeFepGateScore — drug-likeness scoring', () => {
  it('gives full drug-likeness for ideal molecule (high QED, Lipinski pass, PAINS clear)', () => {
    const result = computeFepGateScore({
      screen: { valid: true, qed: 1.0, lipinski_pass: true, pains_pass: true, herg_risk: false },
      dock: goodDock,
      acquisitionScore: 0.5,
    })
    expect(result.components.drugLikenessScore).toBeCloseTo(1.0, 2)
  })

  it('penalises Lipinski failure', () => {
    const passResult = computeFepGateScore({
      screen: { valid: true, qed: 0.7, lipinski_pass: true, pains_pass: true, herg_risk: null },
      dock: goodDock,
      acquisitionScore: 0.5,
    })
    const failResult = computeFepGateScore({
      screen: { valid: true, qed: 0.7, lipinski_pass: false, pains_pass: true, herg_risk: null },
      dock: goodDock,
      acquisitionScore: 0.5,
    })
    expect(passResult.components.drugLikenessScore).toBeGreaterThan(
      failResult.components.drugLikenessScore,
    )
  })

  it('returns neutral drug-likeness (0.5) when screen is null', () => {
    const result = computeFepGateScore({
      screen: null,
      dock: goodDock,
      acquisitionScore: 0.5,
    })
    expect(result.components.drugLikenessScore).toBe(0.5)
  })

  it('returns 0 drug-likeness for invalid molecule', () => {
    // valid=false hard-gates before drug-likeness is relevant; score=0
    const result = computeFepGateScore({ screen: invalidScreen, dock: goodDock, acquisitionScore: 0.5 })
    expect(result.score).toBe(0)
  })
})

// ── Active-learning contribution ─────────────────────────────────────────────

describe('computeFepGateScore — active-learning contribution', () => {
  it('uses 0.5 as neutral when acquisitionScore is null', () => {
    const withNull = computeFepGateScore({ screen: cleanScreen, dock: goodDock, acquisitionScore: null })
    const withHalf = computeFepGateScore({ screen: cleanScreen, dock: goodDock, acquisitionScore: 0.5 })
    expect(withNull.score).toBeCloseTo(withHalf.score, 5)
  })

  it('high acquisition score increases composite', () => {
    const low = computeFepGateScore({ screen: cleanScreen, dock: goodDock, acquisitionScore: 0.0 })
    const high = computeFepGateScore({ screen: cleanScreen, dock: goodDock, acquisitionScore: 1.0 })
    expect(high.score).toBeGreaterThan(low.score)
  })
})

// ── Composite and recommend threshold ───────────────────────────────────────

describe('computeFepGateScore — composite + recommend', () => {
  it('recommends strong binder with clean profile and high AL score', () => {
    const result = computeFepGateScore({
      screen: cleanScreen,
      dock: strongDock,
      acquisitionScore: 0.9,
    })
    expect(result.recommend).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(0.55)
  })

  it('does not recommend weak binder even with clean profile', () => {
    const result = computeFepGateScore({
      screen: cleanScreen,
      dock: weakDock,
      acquisitionScore: 1.0,
    })
    expect(result.recommend).toBe(false)
  })

  it('composite is always in [0, 1]', () => {
    const cases: FepTriageInput[] = [
      { screen: null, dock: null, acquisitionScore: null },
      { screen: cleanScreen, dock: strongDock, acquisitionScore: 1.0 },
      { screen: cleanScreen, dock: weakDock, acquisitionScore: 0.0 },
      { screen: null, dock: goodDock, acquisitionScore: 0.5 },
    ]
    for (const c of cases) {
      const r = computeFepGateScore(c)
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(1)
    }
  })

  it('reason string always includes verdict and key signals', () => {
    const result = computeFepGateScore({
      screen: cleanScreen,
      dock: goodDock,
      acquisitionScore: 0.7,
    })
    expect(result.reason).toMatch(/Vina affinity/)
    expect(result.reason).toMatch(/QED/)
    expect(result.reason).toMatch(/AL acquisition/)
  })
})
