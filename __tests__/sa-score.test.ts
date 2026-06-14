import { describe, expect, it } from 'vitest'

import { computeSaScore } from '@/lib/services/sa-score'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function score(smiles: string) {
  const r = computeSaScore(smiles)
  if (r === null) throw new Error(`computeSaScore returned null for: ${smiles}`)
  return r
}

// ---------------------------------------------------------------------------
// Null / empty inputs
// ---------------------------------------------------------------------------

describe('computeSaScore — null inputs', () => {
  it('returns null for empty string', () => {
    expect(computeSaScore('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(computeSaScore('   ')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Known drug spot-checks (label + approximate range)
// ---------------------------------------------------------------------------

describe('computeSaScore — known drug spot-checks', () => {
  it('scores methanol (2 heavy atoms, trivial) as easy near 1.5', () => {
    const r = score('CO')
    expect(r.label).toBe('easy')
    expect(r.score).toBeGreaterThanOrEqual(1.0)
    expect(r.score).toBeLessThanOrEqual(2.0)
  })

  it('scores aspirin (13 ha, 1 ring, 0 stereo) as easy around 1.9', () => {
    const r = score('CC(=O)Oc1ccccc1C(=O)O')
    expect(r.label).toBe('easy')
    expect(r.score).toBeGreaterThanOrEqual(1.5)
    expect(r.score).toBeLessThanOrEqual(2.5)
  })

  it('scores caffeine (14 ha, 2 rings, 0 stereo) as easy', () => {
    const r = score('Cn1cnc2c1c(=O)n(c(=O)n2C)C')
    expect(r.label).toBe('easy')
    expect(r.score).toBeGreaterThanOrEqual(1.5)
    expect(r.score).toBeLessThanOrEqual(3.0)
  })

  it('scores ibuprofen (15 ha, 1 ring, 1 stereo) as easy but higher than aspirin', () => {
    const aspirin = score('CC(=O)Oc1ccccc1C(=O)O')
    const ibuprofen = score('CC(C)Cc1ccc(cc1)[C@@H](C)C(=O)O')
    expect(ibuprofen.label).toBe('easy')
    expect(ibuprofen.score).toBeGreaterThan(aspirin.score)
  })
})

// ---------------------------------------------------------------------------
// Feature-count verification
// ---------------------------------------------------------------------------

describe('computeSaScore — ring counting', () => {
  it('naphthalene has exactly 2 ring closures', () => {
    const r = score('c1ccc2ccccc2c1')
    expect(r.details.ringCount).toBe(2)
  })

  it('benzene has exactly 1 ring closure', () => {
    const r = score('c1ccccc1')
    expect(r.details.ringCount).toBe(1)
  })

  it('decalin has 2 ring closures', () => {
    const r = score('C1CCC2CCCCC2C1')
    expect(r.details.ringCount).toBe(2)
  })

  it('more rings → higher score, all else equal', () => {
    const oneRing = score('C1CCCCC1')
    const twoRings = score('C1CCC2CCCCC2C1')
    expect(twoRings.score).toBeGreaterThan(oneRing.score)
  })
})

describe('computeSaScore — stereocenter counting', () => {
  it('@@ counts as one stereocenter, @ counts as one (two total for [C@@H]...[C@H]...)', () => {
    const r = score('[C@@H](O)[C@H](N)C(=O)O')
    expect(r.details.stereocenterCount).toBe(2)
  })

  it('molecule with 6 stereocenters has count 6', () => {
    // Six alternating @/@@ in a ring
    const r = score('[C@@H]1([C@H]([C@@H]([C@H]([C@@H]([C@H]1N)O)O)O)O)O')
    expect(r.details.stereocenterCount).toBe(6)
  })

  it('more stereocenters → higher score', () => {
    const noStereo = score('CC(O)CC(N)C(=O)O')
    const withStereo = score('[C@@H](O)[C@H](N)C(=O)O')
    expect(withStereo.score).toBeGreaterThan(noStereo.score)
  })
})

describe('computeSaScore — heavy atom counting', () => {
  it('acetic acid (4 ha) scores lower than nonadecanoic acid (21 ha)', () => {
    const small = score('CC(=O)O')
    const large = score('CCCCCCCCCCCCCCCCCCC(=O)O')
    expect(large.score).toBeGreaterThan(small.score)
  })

  it('Cl and Br are each counted as one heavy atom', () => {
    const chloro = score('ClC')
    expect(chloro.details.estimatedHeavyAtoms).toBe(2)
  })

  it('bracketed atom [NH4+] counts as one heavy atom', () => {
    const r = score('[NH4+]')
    expect(r.details.estimatedHeavyAtoms).toBe(1)
  })
})

describe('computeSaScore — bracketed atom penalty', () => {
  it('charged atoms add a small synthesizability penalty', () => {
    const noBrackets = score('CC(=O)Oc1ccccc1C(=O)O')
    const withCharge = score('[NH3+]CC(=O)Oc1ccccc1C(=O)O')
    expect(withCharge.score).toBeGreaterThan(noBrackets.score)
    expect(withCharge.details.bracketedAtomCount).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Score invariants
// ---------------------------------------------------------------------------

describe('computeSaScore — score invariants', () => {
  it('score is always clamped to [1.0, 10.0]', () => {
    const smiles = [
      'C',
      'CC(=O)Oc1ccccc1C(=O)O',
      'Cn1cnc2c1c(=O)n(c(=O)n2C)C',
      '[C@@H]1([C@H]([C@@H]([C@H]([C@@H]([C@H]1N)O)O)O)O)O',
    ]
    for (const s of smiles) {
      const r = score(s)
      expect(r.score).toBeGreaterThanOrEqual(1.0)
      expect(r.score).toBeLessThanOrEqual(10.0)
    }
  })

  it('result includes all four detail fields with numeric values', () => {
    const r = score('CC(=O)Oc1ccccc1C(=O)O')
    expect(typeof r.details.estimatedHeavyAtoms).toBe('number')
    expect(typeof r.details.ringCount).toBe('number')
    expect(typeof r.details.stereocenterCount).toBe('number')
    expect(typeof r.details.bracketedAtomCount).toBe('number')
    expect(r.details.estimatedHeavyAtoms).toBeGreaterThan(0)
  })

  it('label is consistent with numeric score', () => {
    const smiles = [
      'CO',
      'CC(=O)Oc1ccccc1C(=O)O',
      '[C@@H]1([C@H]([C@@H]([C@H]([C@@H]([C@H]1N)O)O)O)O)O',
    ]
    for (const s of smiles) {
      const r = score(s)
      if (r.score <= 3.5) expect(r.label).toBe('easy')
      else if (r.score <= 6.0) expect(r.label).toBe('moderate')
      else expect(r.label).toBe('hard')
    }
  })

  it('monotonic: methanol < aspirin < ibuprofen in score', () => {
    const methanol = score('CO')
    const aspirin = score('CC(=O)Oc1ccccc1C(=O)O')
    const ibuprofen = score('CC(C)Cc1ccc(cc1)[C@@H](C)C(=O)O')
    expect(methanol.score).toBeLessThan(aspirin.score)
    expect(aspirin.score).toBeLessThan(ibuprofen.score)
  })

  it('6-stereocenter molecule scores in moderate-or-hard range (> 3.5)', () => {
    const r = score('[C@@H]1([C@H]([C@@H]([C@H]([C@@H]([C@H]1N)O)O)O)O)O')
    expect(r.score).toBeGreaterThan(3.5)
  })
})
