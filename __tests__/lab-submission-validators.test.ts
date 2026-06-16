import { describe, expect, it } from 'vitest'
import {
  assayRequestSchema,
  createLabSubmissionSchema,
  patchLabSubmissionSchema,
  labIngestSchema,
  listLabSubmissionsQuerySchema,
} from '@/lib/validators/lab-submission'

const VALID_ASSAY = {
  assayName: 'IC50_SIRT1',
  assayType: 'biochemical',
  description: 'Sirtuin 1 inhibition assay',
  concentrationRangeUm: [0.01, 10] as [number, number],
  replicates: 3,
}

describe('assayRequestSchema', () => {
  it('accepts a minimal assay request', () => {
    const r = assayRequestSchema.safeParse({ assayName: 'IC50' })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.replicates).toBe(3) // default
  })

  it('accepts a fully-specified assay request', () => {
    const r = assayRequestSchema.safeParse({
      ...VALID_ASSAY,
      controls: ['positive: known inhibitor 50µM', 'negative: DMSO 0.1%'],
      protocolNote: 'Use TR-FRET readout.',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty assayName', () => {
    const r = assayRequestSchema.safeParse({ assayName: '' })
    expect(r.success).toBe(false)
  })

  it('rejects concentrationRangeUm where lo >= hi', () => {
    const r = assayRequestSchema.safeParse({
      assayName: 'IC50',
      concentrationRangeUm: [10, 0.01],
    })
    expect(r.success).toBe(false)
  })

  it('rejects replicates outside 1–20', () => {
    expect(assayRequestSchema.safeParse({ assayName: 'IC50', replicates: 0 }).success).toBe(false)
    expect(assayRequestSchema.safeParse({ assayName: 'IC50', replicates: 21 }).success).toBe(false)
  })
})

describe('createLabSubmissionSchema', () => {
  const valid = {
    labName: 'BioAssay CRO',
    requestedAssays: [VALID_ASSAY],
  }

  it('accepts minimal valid input', () => {
    expect(createLabSubmissionSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts fully-specified input', () => {
    const r = createLabSubmissionSchema.safeParse({
      ...valid,
      labContact: 'jane@bioassay.com',
      deadlineAt: '2026-07-01T00:00:00.000Z',
      notes: 'Rush order',
    })
    expect(r.success).toBe(true)
  })

  it('rejects empty labName', () => {
    const r = createLabSubmissionSchema.safeParse({ ...valid, labName: '' })
    expect(r.success).toBe(false)
  })

  it('rejects empty requestedAssays array', () => {
    const r = createLabSubmissionSchema.safeParse({ ...valid, requestedAssays: [] })
    expect(r.success).toBe(false)
  })

  it('rejects more than 20 assay requests', () => {
    const r = createLabSubmissionSchema.safeParse({
      ...valid,
      requestedAssays: Array.from({ length: 21 }, (_, i) => ({ assayName: `A${i}` })),
    })
    expect(r.success).toBe(false)
  })

  it('rejects a non-ISO deadlineAt', () => {
    const r = createLabSubmissionSchema.safeParse({ ...valid, deadlineAt: 'next Friday' })
    expect(r.success).toBe(false)
  })
})

describe('patchLabSubmissionSchema', () => {
  it('accepts COMPLETE', () => {
    expect(patchLabSubmissionSchema.safeParse({ status: 'COMPLETE' }).success).toBe(true)
  })

  it('accepts VOID with notes', () => {
    expect(
      patchLabSubmissionSchema.safeParse({ status: 'VOID', notes: 'Lab closed' }).success,
    ).toBe(true)
  })

  it('rejects PENDING and PARTIAL (not settable via PATCH)', () => {
    expect(patchLabSubmissionSchema.safeParse({ status: 'PENDING' }).success).toBe(false)
    expect(patchLabSubmissionSchema.safeParse({ status: 'PARTIAL' }).success).toBe(false)
  })

  it('rejects missing status', () => {
    expect(patchLabSubmissionSchema.safeParse({}).success).toBe(false)
  })
})

describe('labIngestSchema', () => {
  const validResult = {
    assayName: 'IC50_SIRT1',
    value: 0.35,
    unit: 'µM',
    measuredAt: '2026-06-20T14:00:00.000Z',
  }

  it('accepts minimal valid ingest', () => {
    const r = labIngestSchema.safeParse({ token: 'abc', results: [validResult] })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.final).toBe(false) // default
    expect(r.data.results[0].operator).toBe('=') // default
  })

  it('accepts final:true and full result fields', () => {
    const r = labIngestSchema.safeParse({
      token: 'tok',
      results: [{
        ...validResult,
        operator: '<',
        flag: 'active',
        assayType: 'biochemical',
        lab: 'CRO Inc',
        rawDataUri: 'https://eln.cro.com/run/42',
        notes: 'Within spec',
      }],
      final: true,
    })
    expect(r.success).toBe(true)
  })

  it('rejects empty results array', () => {
    const r = labIngestSchema.safeParse({ token: 'tok', results: [] })
    expect(r.success).toBe(false)
  })

  it('rejects results with non-numeric value', () => {
    const r = labIngestSchema.safeParse({
      token: 'tok',
      results: [{ ...validResult, value: 'high' }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects a result with invalid flag', () => {
    const r = labIngestSchema.safeParse({
      token: 'tok',
      results: [{ ...validResult, flag: 'UNKNOWN' }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects a non-ISO measuredAt', () => {
    const r = labIngestSchema.safeParse({
      token: 'tok',
      results: [{ ...validResult, measuredAt: 'yesterday' }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects a bad rawDataUri', () => {
    const r = labIngestSchema.safeParse({
      token: 'tok',
      results: [{ ...validResult, rawDataUri: 'not-a-url' }],
    })
    expect(r.success).toBe(false)
  })
})

describe('listLabSubmissionsQuerySchema', () => {
  it('uses defaults for empty query', () => {
    const r = listLabSubmissionsQuerySchema.safeParse({})
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.limit).toBe(20)
    expect(r.data.status).toBeUndefined()
  })

  it('accepts a valid status filter', () => {
    const r = listLabSubmissionsQuerySchema.safeParse({ status: 'PENDING' })
    expect(r.success).toBe(true)
  })

  it('rejects an invalid status', () => {
    const r = listLabSubmissionsQuerySchema.safeParse({ status: 'UNKNOWN' })
    expect(r.success).toBe(false)
  })
})
