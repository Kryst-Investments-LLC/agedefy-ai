import { describe, expect, it } from 'vitest'
import { buildLabPackage, generateSubmissionToken, hashToken } from '@/lib/lab-package'

const BASE_CANDIDATE = {
  id: 'cand1',
  displayName: 'Resveratrol',
  kind: 'CHEMBL',
  smiles: 'OC1=CC(=CC(=C1)/C=C/C2=CC(=CC(=C2)O)O)O',
  chemblId: 'CHEMBL413',
  targetName: 'SIRT1',
  targetChemblId: 'CHEMBL828',
  hypothesisNote: 'May activate SIRT1 pathway',
  screenJson: null,
  dockJson: null,
}

const ASSAY_REQUESTS = [
  { assayName: 'IC50_SIRT1', assayType: 'biochemical' as const, replicates: 3 },
]

const BUILD_OPTS = {
  submissionId: 'lsub1',
  candidate: BASE_CANDIDATE,
  requestedAssays: ASSAY_REQUESTS,
  labName: 'BioAssay CRO',
  labContact: 'jane@bioassay.com',
  deadlineAt: '2026-07-01T00:00:00.000Z',
  ingestBaseUrl: 'https://platform.example.com',
}

describe('buildLabPackage', () => {
  it('includes the submission_ref', () => {
    const pkg = buildLabPackage(BUILD_OPTS)
    expect(pkg.submission_ref).toBe('lsub1')
  })

  it('sets exported_at to a valid ISO string', () => {
    const pkg = buildLabPackage(BUILD_OPTS)
    expect(() => new Date(pkg.exported_at)).not.toThrow()
    expect(new Date(pkg.exported_at).toISOString()).toBe(pkg.exported_at)
  })

  it('includes candidate identity fields', () => {
    const pkg = buildLabPackage(BUILD_OPTS)
    expect(pkg.candidate.display_name).toBe('Resveratrol')
    expect(pkg.candidate.kind).toBe('CHEMBL')
    expect(pkg.candidate.chembl_id).toBe('CHEMBL413')
    expect(pkg.candidate.smiles).toBe(BASE_CANDIDATE.smiles)
    expect(pkg.candidate.target_name).toBe('SIRT1')
    expect(pkg.candidate.hypothesis_note).toBe('May activate SIRT1 pathway')
  })

  it('sets screening_summary to null when screenJson is null', () => {
    const pkg = buildLabPackage(BUILD_OPTS)
    expect(pkg.candidate.screening_summary).toBeNull()
  })

  it('extracts screening summary from screenJson when present', () => {
    const pkg = buildLabPackage({
      ...BUILD_OPTS,
      candidate: {
        ...BASE_CANDIDATE,
        screenJson: {
          valid: true,
          model_version: 'v1.0',
          descriptors: { qed: 0.55, mol_log_p: -0.14, molecular_weight: 228.24 },
          filters: { lipinski: { pass: true, details: {} } },
          admet_flags: {
            bbb_penetrant: { likely: false, basis: 'low logP' },
            herg_liability_risk: { flag: false, basis: 'rule-based' },
          },
        },
      },
    })
    const s = pkg.candidate.screening_summary!
    expect(s.valid).toBe(true)
    expect(s.qed).toBe(0.55)
    expect(s.mol_log_p).toBe(-0.14)
    expect(s.lipinski_pass).toBe(true)
    expect(s.bbb_penetrant).toBe(false)
    expect(s.herg_liability).toBe(false)
    expect(s.model_version).toBe('v1.0')
  })

  it('sets docking_score_kcal_mol to null when dockJson is null', () => {
    const pkg = buildLabPackage(BUILD_OPTS)
    expect(pkg.candidate.docking_score_kcal_mol).toBeNull()
  })

  it('extracts docking score from dockJson when present', () => {
    const pkg = buildLabPackage({
      ...BUILD_OPTS,
      candidate: {
        ...BASE_CANDIDATE,
        dockJson: { binding_affinity_kcal_mol: -8.4, model_version: 'v2' },
      },
    })
    expect(pkg.candidate.docking_score_kcal_mol).toBe(-8.4)
  })

  it('includes assay_requests verbatim', () => {
    const pkg = buildLabPackage(BUILD_OPTS)
    expect(pkg.assay_requests).toHaveLength(1)
    expect(pkg.assay_requests[0].assayName).toBe('IC50_SIRT1')
  })

  it('sets the ingest_endpoint from ingestBaseUrl', () => {
    const pkg = buildLabPackage(BUILD_OPTS)
    expect(pkg.ingest_endpoint).toBe('POST https://platform.example.com/api/lab-submissions/ingest')
  })

  it('does NOT include the submission token in the package', () => {
    const pkg = buildLabPackage(BUILD_OPTS)
    const str = JSON.stringify(pkg)
    // package must not embed any field named "token"
    expect(str).not.toMatch(/"submission_token"/)
    expect(str).not.toMatch(/"token_hash"/)
  })

  it('sets deadline from deadlineAt', () => {
    const pkg = buildLabPackage(BUILD_OPTS)
    expect(pkg.deadline).toBe('2026-07-01T00:00:00.000Z')
  })

  it('sets deadline to null when deadlineAt is not provided', () => {
    const pkg = buildLabPackage({ ...BUILD_OPTS, deadlineAt: undefined })
    expect(pkg.deadline).toBeNull()
  })

  it('includes ingest_schema description', () => {
    const pkg = buildLabPackage(BUILD_OPTS)
    expect(typeof pkg.ingest_schema.description).toBe('string')
    expect(typeof pkg.ingest_schema.results).toBe('string')
    expect(typeof pkg.ingest_schema.final).toBe('string')
  })
})

describe('generateSubmissionToken', () => {
  it('returns a token and tokenHash', () => {
    const { token, tokenHash } = generateSubmissionToken()
    expect(typeof token).toBe('string')
    expect(typeof tokenHash).toBe('string')
    expect(token.length).toBe(64) // 32 bytes hex
    expect(tokenHash.length).toBe(64) // sha256 hex
  })

  it('token and tokenHash are different', () => {
    const { token, tokenHash } = generateSubmissionToken()
    expect(token).not.toBe(tokenHash)
  })

  it('generates unique tokens on each call', () => {
    const a = generateSubmissionToken()
    const b = generateSubmissionToken()
    expect(a.token).not.toBe(b.token)
    expect(a.tokenHash).not.toBe(b.tokenHash)
  })

  it('hashToken produces the same hash as tokenHash', () => {
    const { token, tokenHash } = generateSubmissionToken()
    expect(hashToken(token)).toBe(tokenHash)
  })
})
