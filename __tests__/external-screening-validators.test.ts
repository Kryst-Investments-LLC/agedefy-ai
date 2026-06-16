import { describe, expect, it } from 'vitest'
import {
  createAdapterSchema,
  updateAdapterSchema,
  runAdapterSchema,
  externalScreenResponseSchema,
} from '@/lib/validators/external-screening'

describe('createAdapterSchema', () => {
  const valid = {
    name: 'My ADMET Tool',
    endpointUrl: 'https://admet.example.com/screen',
    secret: 'tok-abc123',
  }

  it('accepts minimal valid input with defaults applied', () => {
    const r = createAdapterSchema.safeParse(valid)
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.authHeader).toBe('Authorization')
    expect(r.data.authScheme).toBe('Bearer')
    expect(r.data.timeoutMs).toBe(15_000)
    expect(r.data.enabled).toBe(true)
  })

  it('accepts a fully-specified input', () => {
    const r = createAdapterSchema.safeParse({
      ...valid,
      authHeader: 'X-API-Key',
      authScheme: 'Token',
      timeoutMs: 30_000,
      enabled: false,
      notes: 'CRO pipeline endpoint',
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-URL endpointUrl', () => {
    const r = createAdapterSchema.safeParse({ ...valid, endpointUrl: 'not-a-url' })
    expect(r.success).toBe(false)
  })

  it('rejects an empty name', () => {
    const r = createAdapterSchema.safeParse({ ...valid, name: '' })
    expect(r.success).toBe(false)
  })

  it('rejects an empty secret', () => {
    const r = createAdapterSchema.safeParse({ ...valid, secret: '' })
    expect(r.success).toBe(false)
  })

  it('rejects timeoutMs below 1000', () => {
    const r = createAdapterSchema.safeParse({ ...valid, timeoutMs: 500 })
    expect(r.success).toBe(false)
  })

  it('rejects timeoutMs above 300000', () => {
    const r = createAdapterSchema.safeParse({ ...valid, timeoutMs: 400_000 })
    expect(r.success).toBe(false)
  })
})

describe('updateAdapterSchema', () => {
  it('accepts an empty patch (all fields optional)', () => {
    const r = updateAdapterSchema.safeParse({})
    expect(r.success).toBe(true)
  })

  it('accepts a partial patch', () => {
    const r = updateAdapterSchema.safeParse({ enabled: false, name: 'Renamed' })
    expect(r.success).toBe(true)
  })
})

describe('runAdapterSchema', () => {
  it('accepts minimal input', () => {
    const r = runAdapterSchema.safeParse({ smiles: 'CCO' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.writeBack).toBe(false)
  })

  it('accepts full input', () => {
    const r = runAdapterSchema.safeParse({
      smiles: 'CCO',
      candidateId: 'clxxx123456789012345678901',
      include_pains: true,
      writeBack: true,
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty smiles', () => {
    const r = runAdapterSchema.safeParse({ smiles: '' })
    expect(r.success).toBe(false)
  })

  it('rejects a non-cuid candidateId', () => {
    const r = runAdapterSchema.safeParse({ smiles: 'CCO', candidateId: 'not-a-cuid' })
    expect(r.success).toBe(false)
  })
})

describe('externalScreenResponseSchema', () => {
  it('accepts the minimum required response (smiles + valid)', () => {
    const r = externalScreenResponseSchema.safeParse({ smiles: 'CCO', valid: true })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.model_version).toBe('unknown')
  })

  it('accepts a full response with all optional fields', () => {
    const r = externalScreenResponseSchema.safeParse({
      smiles: 'CCO',
      valid: true,
      canonical_smiles: 'CCO',
      inchi: 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3',
      inchi_key: 'LFQSCWFLJHTTHZ-UHFFFAOYSA-N',
      sanitization_error: null,
      descriptors: { molecular_weight: 46.07, mol_log_p: -0.14, qed: 0.41, sa_score: null },
      filters: { lipinski: { pass: true, details: { mw: true, logp: true } } },
      admet_flags: { bbb_penetrant: { likely: false, basis: 'logP < 0' } },
      model_version: 'my-admet-v3.1',
    })
    expect(r.success).toBe(true)
  })

  it('allows extra top-level fields (passthrough behaviour via unknown)', () => {
    // The schema uses z.object which strips unknown fields — this is fine,
    // raw response is stored separately.
    const r = externalScreenResponseSchema.safeParse({
      smiles: 'CCO',
      valid: true,
      my_proprietary_score: 0.87,
    })
    expect(r.success).toBe(true)
  })

  it('rejects a response missing "valid"', () => {
    const r = externalScreenResponseSchema.safeParse({ smiles: 'CCO' })
    expect(r.success).toBe(false)
  })

  it('rejects a response where "valid" is not a boolean', () => {
    const r = externalScreenResponseSchema.safeParse({ smiles: 'CCO', valid: 'yes' })
    expect(r.success).toBe(false)
  })

  it('rejects a response missing "smiles"', () => {
    const r = externalScreenResponseSchema.safeParse({ valid: true })
    expect(r.success).toBe(false)
  })
})
