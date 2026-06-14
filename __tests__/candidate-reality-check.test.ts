import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { pubchemLookupMock, chemblLookupMock, loggerWarnMock } = vi.hoisted(() => ({
  pubchemLookupMock: vi.fn(),
  chemblLookupMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}))

vi.mock('@/lib/services/pubchem', () => ({
  pubchemService: { lookupBySmiles: pubchemLookupMock },
  PubChemServiceError: class PubChemServiceError extends Error {
    status?: number; retryable: boolean
    constructor(msg: string, opts?: { status?: number; retryable?: boolean }) {
      super(msg); this.name = 'PubChemServiceError'
      this.status = opts?.status; this.retryable = opts?.retryable ?? false
    }
  },
}))

vi.mock('@/lib/services/chembl', () => ({
  chemblService: { lookupBySmiles: chemblLookupMock },
  ChEMBLServiceError: class ChEMBLServiceError extends Error {
    status?: number; retryable: boolean
    constructor(msg: string, opts?: { status?: number; retryable?: boolean }) {
      super(msg); this.name = 'ChEMBLServiceError'
      this.status = opts?.status; this.retryable = opts?.retryable ?? false
    }
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: loggerWarnMock, error: vi.fn(), debug: vi.fn() },
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { candidateRealityCheckService } from '@/lib/services/candidate-reality-check'
import type { PubChemCompound } from '@/lib/services/pubchem'
import type { ChEMBLResult } from '@/lib/services/chembl'

// ── Fixture helpers ───────────────────────────────────────────────────────────

const TEST_SMILES = 'OC1=CC(=O)c2c(O)cccc2O1'

function makePubChem(overrides: Partial<PubChemCompound> = {}): PubChemCompound {
  return {
    cid: 5281614,
    iupacName: '2-(3,4-dihydroxyphenyl)-3,5,7-trihydroxy-4H-chromen-4-one',
    molecularFormula: 'C15H10O6',
    molecularWeight: 286.24,
    canonicalSmiles: TEST_SMILES,
    isomericSmiles: TEST_SMILES,
    inchi: 'InChI=1S/C15H10O6',
    inchiKey: 'WMBWREPUVVBILR-UHFFFAOYSA-N',
    xlogp: 1.3,
    tpsa: 131.0,
    hBondDonorCount: 4,
    hBondAcceptorCount: 6,
    rotatableBondCount: 1,
    ...overrides,
  }
}

function makeChEMBL(overrides: Partial<ChEMBLResult> = {}): ChEMBLResult {
  return {
    compound: {
      chemblId: 'CHEMBL413',
      prefName: 'FISETIN',
      maxPhase: 2,
      firstApprovalYear: null,
      canonicalSmiles: TEST_SMILES,
      inchiKey: 'WMBWREPUVVBILR-UHFFFAOYSA-N',
      molecularFormula: 'C15H10O6',
      mwFreebase: 286.24,
      alogp: 1.5,
      hbdCount: 4,
      hbaCount: 6,
      rotatableBonds: 1,
      tpsa: 131.0,
    },
    bioactivities: [
      { activityId: 1, assayChemblId: 'CHEMBL123', assayType: 'B', assayDescription: 'test',
        targetChemblId: 'CHEMBL1824', targetPrefName: 'PI3K', targetOrganism: 'Homo sapiens',
        standardType: 'IC50', standardRelation: '=', standardValue: 3.5,
        standardUnits: 'nM', pchemblValue: 8.5 },
      { activityId: 2, assayChemblId: 'CHEMBL456', assayType: 'B', assayDescription: 'test2',
        targetChemblId: 'CHEMBL1825', targetPrefName: 'BCL2', targetOrganism: 'Homo sapiens',
        standardType: 'IC50', standardRelation: '=', standardValue: 10,
        standardUnits: 'nM', pchemblValue: 8.0 },
    ],
    totalBioactivities: 47,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('candidateRealityCheckService.check', () => {
  beforeEach(() => {
    pubchemLookupMock.mockReset()
    chemblLookupMock.mockReset()
    loggerWarnMock.mockReset()
  })

  // ── UNRESOLVABLE — blank input ──────────────────────────────────────────────

  it('returns UNRESOLVABLE for an empty SMILES without calling any upstream', async () => {
    const result = await candidateRealityCheckService.check('')
    expect(result.status).toBe('UNRESOLVABLE')
    expect(result.lookupError).toBe('SMILES is empty')
    expect(pubchemLookupMock).not.toHaveBeenCalled()
    expect(chemblLookupMock).not.toHaveBeenCalled()
  })

  it('returns UNRESOLVABLE for a whitespace-only SMILES', async () => {
    const result = await candidateRealityCheckService.check('   ')
    expect(result.status).toBe('UNRESOLVABLE')
    expect(result.queriedSmiles).toBe('   ')
  })

  // ── NOT_FOUND_IN_DATABASES ─────────────────────────────────────────────────

  it('returns NOT_FOUND_IN_DATABASES when both sources return null without errors', async () => {
    pubchemLookupMock.mockResolvedValue(null)
    chemblLookupMock.mockResolvedValue(null)

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.status).toBe('NOT_FOUND_IN_DATABASES')
    expect(result.queriedSmiles).toBe(TEST_SMILES)
    expect(result.lookupError).toBeUndefined()
  })

  // ── UNRESOLVABLE — lookup errors ───────────────────────────────────────────

  it('returns UNRESOLVABLE when both sources throw', async () => {
    pubchemLookupMock.mockRejectedValue(new Error('PubChem circuit open'))
    chemblLookupMock.mockRejectedValue(new Error('ChEMBL circuit open'))

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.status).toBe('UNRESOLVABLE')
    expect(result.lookupError).toBeTruthy()
    expect(loggerWarnMock).toHaveBeenCalledTimes(2)
  })

  it('returns UNRESOLVABLE when PubChem throws and ChEMBL returns null', async () => {
    pubchemLookupMock.mockRejectedValue(new Error('PubChem timeout'))
    chemblLookupMock.mockResolvedValue(null)

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.status).toBe('UNRESOLVABLE')
    expect(result.lookupError).toMatch(/PubChem timeout/)
    expect(loggerWarnMock).toHaveBeenCalledOnce()
  })

  it('returns UNRESOLVABLE when PubChem returns null and ChEMBL throws', async () => {
    pubchemLookupMock.mockResolvedValue(null)
    chemblLookupMock.mockRejectedValue(new Error('ChEMBL rate limit'))

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.status).toBe('UNRESOLVABLE')
    expect(result.lookupError).toMatch(/ChEMBL rate limit/)
    expect(loggerWarnMock).toHaveBeenCalledOnce()
  })

  // ── KNOWN_COMPOUND — both sources succeed ──────────────────────────────────

  it('returns KNOWN_COMPOUND with merged data when both sources succeed', async () => {
    pubchemLookupMock.mockResolvedValue(makePubChem())
    chemblLookupMock.mockResolvedValue(makeChEMBL())

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.status).toBe('KNOWN_COMPOUND')
    expect(result.pubchemCid).toBe(5281614)
    expect(result.chemblId).toBe('CHEMBL413')
    expect(result.maxClinicalPhase).toBe(2)
    expect(result.knownBioactivities).toBe(47)
    expect(result.molecularFormula).toBe('C15H10O6')
    expect(result.molecularWeight).toBe(286.24)
  })

  it('prefers PubChem confirmedName and formula when both sources succeed', async () => {
    pubchemLookupMock.mockResolvedValue(makePubChem({ iupacName: 'fisetin-iupac' }))
    chemblLookupMock.mockResolvedValue(makeChEMBL())

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.confirmedName).toBe('fisetin-iupac')
  })

  // ── KNOWN_COMPOUND — only PubChem found ───────────────────────────────────

  it('returns KNOWN_COMPOUND from PubChem data when ChEMBL returns null', async () => {
    pubchemLookupMock.mockResolvedValue(makePubChem())
    chemblLookupMock.mockResolvedValue(null)

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.status).toBe('KNOWN_COMPOUND')
    expect(result.pubchemCid).toBe(5281614)
    expect(result.chemblId).toBeUndefined()
    expect(result.topTargets).toBeUndefined()
    expect(result.knownBioactivities).toBeUndefined()
    expect(result.confirmedName).toBe('2-(3,4-dihydroxyphenyl)-3,5,7-trihydroxy-4H-chromen-4-one')
  })

  it('returns KNOWN_COMPOUND when PubChem throws but ChEMBL succeeds', async () => {
    pubchemLookupMock.mockRejectedValue(new Error('PubChem circuit open'))
    chemblLookupMock.mockResolvedValue(makeChEMBL())

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.status).toBe('KNOWN_COMPOUND')
    expect(result.pubchemCid).toBeUndefined()
    expect(result.chemblId).toBe('CHEMBL413')
    expect(loggerWarnMock).toHaveBeenCalledOnce()
  })

  // ── KNOWN_COMPOUND — only ChEMBL found ────────────────────────────────────

  it('falls back to ChEMBL prefName when PubChem has no iupacName', async () => {
    pubchemLookupMock.mockResolvedValue(makePubChem({ iupacName: null as unknown as string }))
    chemblLookupMock.mockResolvedValue(makeChEMBL())

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.confirmedName).toBe('FISETIN')
  })

  it('returns KNOWN_COMPOUND from ChEMBL only when PubChem returns null', async () => {
    pubchemLookupMock.mockResolvedValue(null)
    chemblLookupMock.mockResolvedValue(makeChEMBL())

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.status).toBe('KNOWN_COMPOUND')
    expect(result.pubchemCid).toBeUndefined()
    expect(result.chemblId).toBe('CHEMBL413')
    expect(result.confirmedName).toBe('FISETIN')
    expect(result.confirmedSmiles).toBe(TEST_SMILES)
    expect(result.molecularWeight).toBe(286.24)
  })

  // ── topTargets ─────────────────────────────────────────────────────────────

  it('deduplicates and caps topTargets at 5, filtering null names', async () => {
    pubchemLookupMock.mockResolvedValue(null)
    chemblLookupMock.mockResolvedValue(makeChEMBL({
      bioactivities: [
        { activityId: 1, assayChemblId: 'A1', assayType: 'B', assayDescription: '',
          targetChemblId: 'T1', targetPrefName: 'BCL2', targetOrganism: 'Homo sapiens',
          standardType: 'IC50', standardRelation: '=', standardValue: 1, standardUnits: 'nM', pchemblValue: 9 },
        { activityId: 2, assayChemblId: 'A2', assayType: 'B', assayDescription: '',
          targetChemblId: 'T2', targetPrefName: 'BCL2', targetOrganism: 'Homo sapiens',  // duplicate
          standardType: 'IC50', standardRelation: '=', standardValue: 2, standardUnits: 'nM', pchemblValue: 8.7 },
        { activityId: 3, assayChemblId: 'A3', assayType: 'B', assayDescription: '',
          targetChemblId: null, targetPrefName: null, targetOrganism: null,  // null name — filtered
          standardType: 'IC50', standardRelation: '=', standardValue: 3, standardUnits: 'nM', pchemblValue: 8 },
        { activityId: 4, assayChemblId: 'A4', assayType: 'B', assayDescription: '',
          targetChemblId: 'T4', targetPrefName: 'PI3K', targetOrganism: 'Homo sapiens',
          standardType: 'IC50', standardRelation: '=', standardValue: 4, standardUnits: 'nM', pchemblValue: 8 },
        { activityId: 5, assayChemblId: 'A5', assayType: 'B', assayDescription: '',
          targetChemblId: 'T5', targetPrefName: 'SIRT1', targetOrganism: 'Homo sapiens',
          standardType: 'IC50', standardRelation: '=', standardValue: 5, standardUnits: 'nM', pchemblValue: 8 },
        { activityId: 6, assayChemblId: 'A6', assayType: 'B', assayDescription: '',
          targetChemblId: 'T6', targetPrefName: 'mTOR', targetOrganism: 'Homo sapiens',
          standardType: 'IC50', standardRelation: '=', standardValue: 6, standardUnits: 'nM', pchemblValue: 7 },
        { activityId: 7, assayChemblId: 'A7', assayType: 'B', assayDescription: '',
          targetChemblId: 'T7', targetPrefName: 'AMPK', targetOrganism: 'Homo sapiens',
          standardType: 'IC50', standardRelation: '=', standardValue: 7, standardUnits: 'nM', pchemblValue: 7 },
        { activityId: 8, assayChemblId: 'A8', assayType: 'B', assayDescription: '',
          targetChemblId: 'T8', targetPrefName: 'HDAC1', targetOrganism: 'Homo sapiens',  // 6th unique → cut
          standardType: 'IC50', standardRelation: '=', standardValue: 8, standardUnits: 'nM', pchemblValue: 6 },
      ],
      totalBioactivities: 7,
    }))

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.status).toBe('KNOWN_COMPOUND')
    expect(result.topTargets).toHaveLength(5)
    expect(result.topTargets).toContain('BCL2')
    expect(result.topTargets).toContain('PI3K')
    expect(result.topTargets).not.toContain('HDAC1')  // capped at 5
    expect(result.topTargets).not.toContain(null)
  })

  // ── confirmedSmiles fallback ────────────────────────────────────────────────

  it('uses ChEMBL canonicalSmiles when PubChem canonicalSmiles is null', async () => {
    pubchemLookupMock.mockResolvedValue(makePubChem({ canonicalSmiles: null as unknown as string }))
    chemblLookupMock.mockResolvedValue(makeChEMBL())

    const result = await candidateRealityCheckService.check(TEST_SMILES)
    expect(result.confirmedSmiles).toBe(TEST_SMILES)  // from ChEMBL
  })

  // ── metadata fields ─────────────────────────────────────────────────────────

  it('preserves queriedSmiles and sets a valid ISO checkedAt timestamp', async () => {
    pubchemLookupMock.mockResolvedValue(makePubChem())
    chemblLookupMock.mockResolvedValue(null)

    const before = Date.now()
    const result = await candidateRealityCheckService.check(TEST_SMILES)
    const after = Date.now()

    expect(result.queriedSmiles).toBe(TEST_SMILES)
    const ts = new Date(result.checkedAt).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })
})
