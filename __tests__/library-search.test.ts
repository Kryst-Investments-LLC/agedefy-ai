import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { executeWithCircuitBreakerMock } = vi.hoisted(() => ({
  executeWithCircuitBreakerMock: vi.fn(),
}))

vi.mock('@/lib/circuit-breaker', () => ({
  executeWithCircuitBreaker: executeWithCircuitBreakerMock,
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {
    dependency: string; retryAt?: Date
    constructor(dep: string, retryAt?: Date) {
      super(`${dep} circuit open`)
      this.name = 'CircuitBreakerOpenError'
      this.dependency = dep; this.retryAt = retryAt
    }
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// ── Import after mocks ────────────────────────────────────────────────────────

import { librarySearchService, LibrarySearchError } from '@/lib/services/library-search'
import type { LibrarySearchCriteria } from '@/lib/validators/library-search'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const TARGET_RESPONSE = {
  targets: [
    { target_chembl_id: 'CHEMBL2842', pref_name: 'Serine/threonine-protein kinase mTOR' },
    { target_chembl_id: 'CHEMBL4439', pref_name: 'FKBP12-rapamycin-associated protein' },
  ],
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    molecule_chembl_id: 'CHEMBL413',
    molecule_pref_name: 'Rapamycin',
    canonical_smiles: 'CC1CCC2CC(=O)',
    target_pref_name: 'Serine/threonine-protein kinase mTOR',
    target_chembl_id: 'CHEMBL2842',
    pchembl_value: '8.5',
    assay_type: 'B',
    ...overrides,
  }
}

function makeActivityResponse(activities: ReturnType<typeof makeActivity>[]) {
  return { activities, page_meta: { total_count: activities.length } }
}

function makeMolecule(overrides: Record<string, unknown> = {}) {
  return {
    molecule_chembl_id: 'CHEMBL413',
    pref_name: 'Rapamycin',
    max_phase: '4.0',
    molecule_properties: {
      mw_freebase: '914.17',
      alogp: '4.30',
      hbd: '3',
      hba: '13',
      psa: '195.00',
      rtb: '8',
      molecular_formula: 'C51H79NO13',
    },
    molecule_structures: {
      canonical_smiles: 'CC1CCC2CC(=O)',
      standard_inchi_key: 'QFJCIRLUMCPESM-WIRFZEBQSA-N',
    },
    ...overrides,
  }
}

function makeMoleculeResponse(molecules: ReturnType<typeof makeMolecule>[]) {
  return { molecules }
}

// Circuit-breaker passthrough: execute the fn directly
function cbPassthrough(fn: () => Promise<unknown>) {
  return executeWithCircuitBreakerMock.mockImplementationOnce(
    ({ execute }: { execute: () => Promise<unknown> }) => execute(),
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('librarySearchService.search', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    executeWithCircuitBreakerMock.mockReset()
    executeWithCircuitBreakerMock.mockImplementation(
      ({ execute }: { execute: () => Promise<unknown> }) => execute(),
    )
  })

  // ── Target-directed path ────────────────────────────────────────────────────

  it('resolves target name → activities → molecules and returns ranked hits', async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(json(TARGET_RESPONSE)))       // /target.json
      .mockImplementationOnce(() => Promise.resolve(json(makeActivityResponse([makeActivity()])))) // /activity.json CHEMBL2842
      .mockImplementationOnce(() => Promise.resolve(json(makeActivityResponse([])))) // /activity.json CHEMBL4439
      .mockImplementationOnce(() => Promise.resolve(json(makeMoleculeResponse([makeMolecule()])))) // /molecule.json batch

    const result = await librarySearchService.search({
      targetName: 'mTOR',
      maxResults: 25,
    })

    expect(result.searchPath).toBe('target-directed')
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].chemblId).toBe('CHEMBL413')
    expect(result.hits[0].rank).toBe(1)
    expect(result.hits[0].bestPchemblValue).toBe(8.5)
    expect(result.hits[0].bestTargetName).toContain('mTOR')
    expect(result.hits[0].sources).toEqual(['ChEMBL'])
    expect(result.hits[0].chemblUrl).toContain('CHEMBL413')
  })

  it('uses targetChemblId directly, skipping the target-name lookup', async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(json(makeActivityResponse([makeActivity()])))) // activities only
      .mockImplementationOnce(() => Promise.resolve(json(makeMoleculeResponse([makeMolecule()]))))

    const result = await librarySearchService.search({
      targetChemblId: 'CHEMBL2842',
      maxResults: 25,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.searchPath).toBe('target-directed')
    expect(result.hits[0].chemblId).toBe('CHEMBL413')
  })

  it('deduplicates activities from multiple targets, keeping best pChEMBL per molecule', async () => {
    const molA = makeActivity({ molecule_chembl_id: 'CHEMBL413', pchembl_value: '7.0' })
    const molA2 = makeActivity({ molecule_chembl_id: 'CHEMBL413', pchembl_value: '8.5' }) // same molecule, better value
    const molB = makeActivity({ molecule_chembl_id: 'CHEMBL2', pchembl_value: '6.0' })

    fetchMock
      .mockImplementationOnce(() => Promise.resolve(json(TARGET_RESPONSE)))
      .mockImplementationOnce(() => Promise.resolve(json(makeActivityResponse([molA, molB]))))
      .mockImplementationOnce(() => Promise.resolve(json(makeActivityResponse([molA2]))))
      .mockImplementationOnce(() =>
        Promise.resolve(json(makeMoleculeResponse([makeMolecule(), makeMolecule({ molecule_chembl_id: 'CHEMBL2', pref_name: 'MolB' })])))
      )

    const result = await librarySearchService.search({ targetName: 'mTOR', maxResults: 25 })

    const chembl413 = result.hits.find((h) => h.chemblId === 'CHEMBL413')
    expect(chembl413?.bestPchemblValue).toBe(8.5)    // kept the higher value
    expect(chembl413?.totalBioactivities).toBe(2)    // counted both occurrences
    expect(result.hits).toHaveLength(2)
  })

  it('ranks higher-pChEMBL molecules first', async () => {
    const activities = [
      makeActivity({ molecule_chembl_id: 'CHEMBL1', pchembl_value: '6.0' }),
      makeActivity({ molecule_chembl_id: 'CHEMBL2', pchembl_value: '9.2' }),
      makeActivity({ molecule_chembl_id: 'CHEMBL3', pchembl_value: '7.5' }),
    ]

    fetchMock
      .mockImplementationOnce(() => Promise.resolve(json({ targets: [{ target_chembl_id: 'CHEMBL2842', pref_name: 'mTOR' }] })))
      .mockImplementationOnce(() => Promise.resolve(json(makeActivityResponse(activities))))
      .mockImplementationOnce(() =>
        Promise.resolve(
          json(makeMoleculeResponse(activities.map((a) => makeMolecule({ molecule_chembl_id: a.molecule_chembl_id }))))
        )
      )

    const result = await librarySearchService.search({ targetName: 'mTOR', maxResults: 25 })

    expect(result.hits[0].chemblId).toBe('CHEMBL2')   // pChEMBL 9.2
    expect(result.hits[1].chemblId).toBe('CHEMBL3')   // pChEMBL 7.5
    expect(result.hits[2].chemblId).toBe('CHEMBL1')   // pChEMBL 6.0
  })

  it('filters activities below minPchemblValue before accumulation', async () => {
    const activities = [
      makeActivity({ molecule_chembl_id: 'CHEMBL1', pchembl_value: '5.8' }), // below threshold
      makeActivity({ molecule_chembl_id: 'CHEMBL2', pchembl_value: '7.1' }), // passes
    ]

    fetchMock
      .mockImplementationOnce(() => Promise.resolve(json({ targets: [{ target_chembl_id: 'CHEMBL2842', pref_name: 'mTOR' }] })))
      .mockImplementationOnce(() => Promise.resolve(json(makeActivityResponse(activities))))
      .mockImplementationOnce(() =>
        Promise.resolve(json(makeMoleculeResponse([makeMolecule({ molecule_chembl_id: 'CHEMBL2' })])))
      )

    const result = await librarySearchService.search({
      targetName: 'mTOR',
      minPchemblValue: 6.0,
      maxResults: 25,
    })

    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].chemblId).toBe('CHEMBL2')
  })

  it('applies assay_type filter in activity request URL', async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(json({ targets: [{ target_chembl_id: 'CHEMBL2842', pref_name: 'mTOR' }] })))
      .mockImplementationOnce(() => Promise.resolve(json(makeActivityResponse([makeActivity()]))))
      .mockImplementationOnce(() => Promise.resolve(json(makeMoleculeResponse([makeMolecule()]))))

    await librarySearchService.search({ targetName: 'mTOR', assayType: 'B', maxResults: 25 })

    const activityCall = fetchMock.mock.calls[1][0] as string
    expect(activityCall).toContain('assay_type=B')
  })

  it('returns empty hits when no targets match the name', async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(json({ targets: [] })))

    const result = await librarySearchService.search({ targetName: 'xyznonexistent', maxResults: 10 })

    expect(result.hits).toHaveLength(0)
    expect(result.totalFound).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(1) // only target lookup, no activity fetch
  })

  it('caps returned hits at maxResults', async () => {
    const activities = Array.from({ length: 10 }, (_, i) =>
      makeActivity({ molecule_chembl_id: `CHEMBL${i + 100}`, pchembl_value: String(9 - i * 0.1) })
    )
    const molecules = activities.map((a) => makeMolecule({ molecule_chembl_id: a.molecule_chembl_id }))

    fetchMock
      .mockImplementationOnce(() => Promise.resolve(json({ targets: [{ target_chembl_id: 'CHEMBL2842', pref_name: 'mTOR' }] })))
      .mockImplementationOnce(() => Promise.resolve(json(makeActivityResponse(activities))))
      .mockImplementationOnce(() => Promise.resolve(json(makeMoleculeResponse(molecules))))

    const result = await librarySearchService.search({ targetName: 'mTOR', maxResults: 3 })

    expect(result.hits).toHaveLength(3)
    expect(result.totalFound).toBe(10)
  })

  // ── Property-only path ──────────────────────────────────────────────────────

  it('queries molecule endpoint with property filters when no target specified', async () => {
    const lightMol = makeMolecule({
      molecule_properties: {
        mw_freebase: '380.4', alogp: '2.1', hbd: 3, hba: 7,
        psa: '95.0', rtb: 4, molecular_formula: 'C19H21N5O4',
      },
    })
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json(makeMoleculeResponse([lightMol])))
    )

    const result = await librarySearchService.search({
      mwMax: 500,
      logpMax: 5,
      hbdMax: 5,
      hbaMax: 10,
      maxResults: 25,
    })

    expect(result.searchPath).toBe('property-only')
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('mw_freebase__lte=500')
    expect(url).toContain('alogp__lte=5')
    expect(url).toContain('hbd__lte=5')
    expect(url).toContain('hba__lte=10')
    expect(result.hits).toHaveLength(1)
  })

  it('sends minClinicalPhase as max_phase__gte in molecule query', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json(makeMoleculeResponse([makeMolecule()])))
    )

    await librarySearchService.search({ minClinicalPhase: 2, maxResults: 25 })

    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('max_phase__gte=2')
  })

  it('applies mwMin client-side filter in property-only path when below server-side returned values', async () => {
    const heavyMol = makeMolecule({ molecule_properties: { mw_freebase: '180.0', alogp: '1.0', hbd: 1, hba: 2, psa: '40.0', rtb: 2 } })
    const lightMol = makeMolecule({
      molecule_chembl_id: 'CHEMBL99',
      molecule_properties: { mw_freebase: '350.0', alogp: '2.0', hbd: 2, hba: 4, psa: '80.0', rtb: 3 },
    })

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json(makeMoleculeResponse([heavyMol, lightMol])))
    )

    const result = await librarySearchService.search({ mwMin: 300, maxResults: 25 })

    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].chemblId).toBe('CHEMBL99')
  })

  // ── Lipinski compliance ─────────────────────────────────────────────────────

  it('marks a molecule lipinskiCompliant when all four rules pass', () => {
    const compliant = {
      chemblId: 'CHEMBL1', preferredName: null, canonicalSmiles: null, inchiKey: null,
      molecularFormula: null, molecularWeight: 450, logp: 3.5, hbdCount: 3, hbaCount: 8,
      tpsa: 90, rotatableBonds: 5, maxClinicalPhase: null,
      bestPchemblValue: null, bestTargetName: null, bestAssayType: null, totalBioactivities: 0,
    }
    expect(librarySearchService.isLipinskiCompliant(compliant)).toBe(true)
  })

  it('marks a molecule lipinskiCompliant when exactly one rule fails (Ro5 allows one violation)', () => {
    const oneViolation = {
      chemblId: 'CHEMBL2', preferredName: null, canonicalSmiles: null, inchiKey: null,
      molecularFormula: null, molecularWeight: 600, // > 500 — one violation
      logp: 3.5, hbdCount: 3, hbaCount: 8,
      tpsa: 90, rotatableBonds: 5, maxClinicalPhase: null,
      bestPchemblValue: null, bestTargetName: null, bestAssayType: null, totalBioactivities: 0,
    }
    expect(librarySearchService.isLipinskiCompliant(oneViolation)).toBe(true)
  })

  it('marks a molecule non-compliant when two or more Lipinski rules fail', () => {
    const twoViolations = {
      chemblId: 'CHEMBL3', preferredName: null, canonicalSmiles: null, inchiKey: null,
      molecularFormula: null, molecularWeight: 700, logp: 6.0, // MW > 500 AND logP > 5
      hbdCount: 3, hbaCount: 8,
      tpsa: 90, rotatableBonds: 5, maxClinicalPhase: null,
      bestPchemblValue: null, bestTargetName: null, bestAssayType: null, totalBioactivities: 0,
    }
    expect(librarySearchService.isLipinskiCompliant(twoViolations)).toBe(false)
  })

  // ── Scoring ─────────────────────────────────────────────────────────────────

  it('scores a fully characterised approved molecule near the top of the range', () => {
    const approved = {
      chemblId: 'CHEMBL1', preferredName: null, canonicalSmiles: null, inchiKey: null,
      molecularFormula: null, molecularWeight: 350, logp: 2.0, hbdCount: 2, hbaCount: 5,
      tpsa: 80, rotatableBonds: 4, maxClinicalPhase: 4,
      bestPchemblValue: 9.0, bestTargetName: null, bestAssayType: null, totalBioactivities: 500,
    }
    const score = librarySearchService.computeScore(approved)
    expect(score).toBeGreaterThan(0.8)
    expect(score).toBeLessThanOrEqual(1.0)
  })

  it('scores a molecule with no pChEMBL and no clinical data at the bottom', () => {
    const bare = {
      chemblId: 'CHEMBL2', preferredName: null, canonicalSmiles: null, inchiKey: null,
      molecularFormula: null, molecularWeight: 700, logp: 6.0, hbdCount: 8, hbaCount: 15,
      tpsa: 250, rotatableBonds: 20, maxClinicalPhase: 0,
      bestPchemblValue: null, bestTargetName: null, bestAssayType: null, totalBioactivities: 0,
    }
    expect(librarySearchService.computeScore(bare)).toBe(0)
  })

  it('higher pChEMBL molecule scores higher than lower pChEMBL, all else equal', () => {
    const base = {
      preferredName: null, canonicalSmiles: null, inchiKey: null, molecularFormula: null,
      molecularWeight: 400, logp: 3.0, hbdCount: 2, hbaCount: 6,
      tpsa: 80, rotatableBonds: 4, maxClinicalPhase: 2, bestTargetName: null,
      bestAssayType: null, totalBioactivities: 10,
    }
    const high = librarySearchService.computeScore({ ...base, chemblId: 'A', bestPchemblValue: 9.0 })
    const low  = librarySearchService.computeScore({ ...base, chemblId: 'B', bestPchemblValue: 5.0 })
    expect(high).toBeGreaterThan(low)
  })

  // ── Error handling ──────────────────────────────────────────────────────────

  it('propagates CircuitBreakerOpenError from the circuit breaker', async () => {
    const { CircuitBreakerOpenError } = await import('@/lib/circuit-breaker')
    executeWithCircuitBreakerMock.mockRejectedValueOnce(new CircuitBreakerOpenError('chembl-api'))

    await expect(
      librarySearchService.search({ targetChemblId: 'CHEMBL2842', maxResults: 10 })
    ).rejects.toThrow('chembl-api circuit open')
  })

  it('throws a retryable LibrarySearchError on ChEMBL 429', async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 429 })))

    await expect(
      librarySearchService.search({ minClinicalPhase: 4, maxResults: 10 })
    ).rejects.toMatchObject({ name: 'LibrarySearchError', status: 429, retryable: true })
  })

  it('throws a non-retryable LibrarySearchError on ChEMBL 400', async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 400 })))

    await expect(
      librarySearchService.search({ minClinicalPhase: 1, maxResults: 10 })
    ).rejects.toMatchObject({ name: 'LibrarySearchError', retryable: false })
  })

  it('throws a retryable LibrarySearchError on request timeout (AbortError)', async () => {
    fetchMock.mockImplementationOnce(() => {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })

    await expect(
      librarySearchService.search({ minClinicalPhase: 1, maxResults: 10 })
    ).rejects.toMatchObject({ name: 'LibrarySearchError', retryable: true })
  })

  // ── Provenance and metadata ─────────────────────────────────────────────────

  it('always sets sources to [ChEMBL] and includes a chemblUrl', async () => {
    const lightMol = makeMolecule({
      molecule_properties: {
        mw_freebase: '380.4', alogp: '2.1', hbd: 3, hba: 7,
        psa: '95.0', rtb: 4, molecular_formula: 'C19H21N5O4',
      },
    })
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json(makeMoleculeResponse([lightMol])))
    )

    const result = await librarySearchService.search({ mwMax: 500, maxResults: 5 })

    expect(result.hits[0].sources).toEqual(['ChEMBL'])
    expect(result.hits[0].chemblUrl).toMatch(/^https:\/\/www\.ebi\.ac\.uk\/chembl\/compound_report_card\/CHEMBL413\/$/)
  })

  it('echos criteriaUsed and searchPath in the result envelope', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json(makeMoleculeResponse([])))
    )

    const criteria: LibrarySearchCriteria = { mwMax: 500, logpMax: 5, maxResults: 10 }
    const result = await librarySearchService.search(criteria)

    expect(result.criteriaUsed).toMatchObject({ mwMax: 500, logpMax: 5 })
    expect(result.searchPath).toBe('property-only')
    expect(typeof result.durationMs).toBe('number')
  })

  // ── SA score ────────────────────────────────────────────────────────────────

  it('includes saScore and synthesizabilityLabel from canonical SMILES on each hit', async () => {
    // Aspirin: 13 heavy atoms, 1 ring, no stereocenters → easy
    const aspirinMol = makeMolecule({
      molecule_structures: {
        canonical_smiles: 'CC(=O)Oc1ccccc1C(=O)O',
        standard_inchi_key: 'BSYNRYMUTXBXSQ-UHFFFAOYSA-N',
      },
      molecule_properties: {
        mw_freebase: '180.2', alogp: '1.2', hbd: 1, hba: 3,
        psa: '63.6', rtb: 3, molecular_formula: 'C9H8O4',
      },
    })
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json(makeMoleculeResponse([aspirinMol])))
    )

    const result = await librarySearchService.search({ mwMax: 200, maxResults: 5 })

    const hit = result.hits[0]
    expect(hit.saScore).not.toBeNull()
    expect(hit.saScore).toBeGreaterThan(1.0)
    expect(hit.saScore).toBeLessThan(3.5)
    expect(hit.synthesizabilityLabel).toBe('easy')
  })

  it('sets saScore and synthesizabilityLabel to null when canonical SMILES is absent', async () => {
    const noSmilesMol = makeMolecule({
      molecule_structures: {
        canonical_smiles: null,
        standard_inchi_key: 'BSYNRYMUTXBXSQ-UHFFFAOYSA-N',
      },
      molecule_properties: {
        mw_freebase: '180.2', alogp: '1.2', hbd: 1, hba: 3,
        psa: '63.6', rtb: 3, molecular_formula: 'C9H8O4',
      },
    })
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json(makeMoleculeResponse([noSmilesMol])))
    )

    const result = await librarySearchService.search({ mwMax: 200, maxResults: 5 })

    expect(result.hits[0].saScore).toBeNull()
    expect(result.hits[0].synthesizabilityLabel).toBeNull()
  })

  it('easy-SMILES molecule scores higher than hard-SMILES molecule with equal pChEMBL (SA tiebreaker)', async () => {
    // Same pChEMBL, same clinical phase, same bioactivities — only SMILES differs
    const easyMol = makeMolecule({
      molecule_chembl_id: 'CHEMBL_EASY',
      molecule_structures: { canonical_smiles: 'CC(=O)Oc1ccccc1C(=O)O', standard_inchi_key: null },
      molecule_properties: { mw_freebase: '180', alogp: '1.2', hbd: 1, hba: 3, psa: '63', rtb: 3 },
    })
    // 6 stereocenters + 1 ring → score > 3.5 (moderate or hard)
    const hardMol = makeMolecule({
      molecule_chembl_id: 'CHEMBL_HARD',
      molecule_structures: {
        canonical_smiles: '[C@@H]1([C@H]([C@@H]([C@H]([C@@H]([C@H]1N)O)O)O)O)O',
        standard_inchi_key: null,
      },
      molecule_properties: { mw_freebase: '180', alogp: '1.2', hbd: 1, hba: 3, psa: '63', rtb: 3 },
    })

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json({ targets: [{ target_chembl_id: 'CHEMBL2842', pref_name: 'mTOR' }] }))
    )
    const activities = [
      makeActivity({ molecule_chembl_id: 'CHEMBL_EASY', pchembl_value: '7.0' }),
      makeActivity({ molecule_chembl_id: 'CHEMBL_HARD', pchembl_value: '7.0' }),
    ]
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json(makeActivityResponse(activities)))
    )
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(json(makeMoleculeResponse([easyMol, hardMol])))
    )

    const result = await librarySearchService.search({ targetName: 'mTOR', maxResults: 25 })

    const easyHit = result.hits.find((h) => h.chemblId === 'CHEMBL_EASY')!
    const hardHit = result.hits.find((h) => h.chemblId === 'CHEMBL_HARD')!
    expect(easyHit.score).toBeGreaterThan(hardHit.score)
    expect(easyHit.rank).toBeLessThan(hardHit.rank) // lower rank number = better position
  })
})
