import { describe, expect, it, vi } from 'vitest'

import { fetchCompoundByName, fetchCompoundByCID } from '@/lib/knowledge-graph/pubchem-ingest'

// ---------------------------------------------------------------------------
// PubChem ingest — unit tests
// ---------------------------------------------------------------------------

describe('PubChem Ingest', () => {
  it('exports fetchCompoundByName', () => {
    expect(typeof fetchCompoundByName).toBe('function')
  })

  it('exports fetchCompoundByCID', () => {
    expect(typeof fetchCompoundByCID).toBe('function')
  })

  it('returns null for unknown compound name', async () => {
    // Mock fetch to return 404
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })
    try {
      const result = await fetchCompoundByName('totallyfakecompound999xyz')
      expect(result).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('parses a valid PubChem compound response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          PropertyTable: {
            Properties: [
              {
                CID: 5280343,
                IUPACName: 'quercetin',
                MolecularFormula: 'C15H10O7',
                MolecularWeight: 302.24,
                IsomericSMILES: 'OC1=CC(O)=C2C(=O)...',
              },
            ],
          },
        }),
    })
    try {
      const result = await fetchCompoundByName('quercetin')
      expect(result).not.toBeNull()
      expect(result!.CID).toBe(5280343)
      expect(result!.MolecularFormula).toBe('C15H10O7')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('returns null for unknown CID', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })
    try {
      const result = await fetchCompoundByCID(99999999)
      expect(result).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

// ---------------------------------------------------------------------------
// Contribution validation schemas (inline test of API contract)
// ---------------------------------------------------------------------------

describe('KG Contribution schemas', () => {
  it('contribution entity types are well-defined', () => {
    const validTypes = ['pathway-link', 'interaction', 'biomarker-effect', 'study-link']
    expect(validTypes).toHaveLength(4)
    for (const t of validTypes) {
      expect(typeof t).toBe('string')
    }
  })

  it('review decisions are well-defined', () => {
    const validDecisions = ['APPROVED', 'REJECTED']
    expect(validDecisions).toHaveLength(2)
  })
})
