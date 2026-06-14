/**
 * PubChem PUG REST Service
 *
 * Real-time compound lookup by name, SMILES, or InChIKey via the public
 * PubChem PUG REST API. Returns canonical structure + curated physicochemical
 * properties. No API key required.
 *
 * Uses the repo's circuit-breaker for upstream failure isolation and an
 * in-process TTL cache (default 1 h) to stay well inside PubChem's ≤5 req/s
 * rate limit during normal operation.
 *
 * Configuration (all optional — defaults work for production):
 *   PUBCHEM_BASE_URL     Override the PUG REST base (useful for tests/proxies)
 *   PUBCHEM_TIMEOUT_MS   Per-request timeout in ms (default 10 000)
 *   PUBCHEM_CACHE_TTL_MS Cache TTL in ms (default 3 600 000 = 1 hour)
 */

import { executeWithCircuitBreaker } from '@/lib/circuit-breaker'
import { logger } from '@/lib/logger'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1_000 // 1 hour

/** Properties fetched from every compound lookup. */
const PROPERTY_LIST = [
  'IUPACName',
  'MolecularFormula',
  'MolecularWeight',
  'CanonicalSMILES',
  'IsomericSMILES',
  'InChI',
  'InChIKey',
  'XLogP',
  'TPSA',
  'HBondDonorCount',
  'HBondAcceptorCount',
  'RotatableBondCount',
].join(',')

// ── Public types ──────────────────────────────────────────────────────────────

/** Normalised compound returned by every lookup method. */
export interface PubChemCompound {
  /** PubChem Compound Identifier. */
  cid: number
  iupacName: string | null
  molecularFormula: string | null
  /** Molecular weight in g/mol. */
  molecularWeight: number | null
  /** Canonical (standardised) SMILES. */
  canonicalSmiles: string | null
  /** Isomeric SMILES, preserving stereo information. */
  isomericSmiles: string | null
  inchi: string | null
  inchiKey: string | null
  /** Octanol-water partition coefficient (Wildman-Crippen). */
  xlogp: number | null
  /** Topological polar surface area (Å²). */
  tpsa: number | null
  hBondDonorCount: number | null
  hBondAcceptorCount: number | null
  rotatableBondCount: number | null
}

/** Thrown when PubChem returns a non-recoverable error. */
export class PubChemServiceError extends Error {
  readonly status: number | undefined
  /** True when the caller may retry (rate-limit, timeout, 5xx). */
  readonly retryable: boolean

  constructor(message: string, status?: number, retryable = false) {
    super(message)
    this.name = 'PubChemServiceError'
    this.status = status
    this.retryable = retryable
  }
}

// ── Internal types ────────────────────────────────────────────────────────────

interface RawProperty {
  CID: number
  IUPACName?: string
  MolecularFormula?: string
  MolecularWeight?: number | string
  CanonicalSMILES?: string
  IsomericSMILES?: string
  InChI?: string
  InChIKey?: string
  XLogP?: number | string
  TPSA?: number | string
  HBondDonorCount?: number | string
  HBondAcceptorCount?: number | string
  RotatableBondCount?: number | string
}

interface PropertyResponse {
  PropertyTable?: {
    Properties?: RawProperty[]
  }
}

interface CacheEntry {
  data: PubChemCompound
  timestamp: number
}

// ── Service ───────────────────────────────────────────────────────────────────

class PubChemService {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly cacheTtlMs: number
  private readonly cache: Map<string, CacheEntry>

  constructor() {
    this.baseUrl = (process.env.PUBCHEM_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.timeoutMs = parseInt(process.env.PUBCHEM_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10)
    this.cacheTtlMs = parseInt(process.env.PUBCHEM_CACHE_TTL_MS ?? String(DEFAULT_CACHE_TTL_MS), 10)
    this.cache = new Map()
  }

  /**
   * Look up a compound by common or IUPAC name.
   * Returns null when PubChem does not recognise the name.
   */
  async lookupByName(name: string): Promise<PubChemCompound | null> {
    const url = `${this.baseUrl}/compound/name/${encodeURIComponent(name)}/property/${PROPERTY_LIST}/JSON`
    return this.cachedGet(`name:${name}`, url)
  }

  /**
   * Look up a compound by its InChIKey (27-character standard identifier).
   * Returns null when the InChIKey is not found in PubChem.
   */
  async lookupByInchiKey(inchiKey: string): Promise<PubChemCompound | null> {
    const url = `${this.baseUrl}/compound/inchikey/${encodeURIComponent(inchiKey)}/property/${PROPERTY_LIST}/JSON`
    return this.cachedGet(`inchikey:${inchiKey}`, url)
  }

  /**
   * Look up a compound by SMILES string.
   * Uses HTTP POST to avoid URL-encoding problems with complex SMILES.
   * Returns null when PubChem cannot parse or match the SMILES.
   */
  async lookupBySmiles(smiles: string): Promise<PubChemCompound | null> {
    const cacheKey = `smiles:${smiles}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      logger.debug('PubChem cache hit', { namespace: 'smiles' })
      return cached.data
    }

    const url = `${this.baseUrl}/compound/smiles/property/${PROPERTY_LIST}/JSON`
    const result = await executeWithCircuitBreaker({
      dependency: 'pubchem-api',
      execute: () =>
        this.request(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `smiles=${encodeURIComponent(smiles)}`,
        }),
    })

    if (result !== null) {
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
    }
    return result
  }

  /** Drop the in-process cache. Call in tests or after bulk ingest. */
  clearCache(): void {
    this.cache.clear()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async cachedGet(cacheKey: string, url: string): Promise<PubChemCompound | null> {
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      logger.debug('PubChem cache hit', { cacheKey })
      return cached.data
    }

    const result = await executeWithCircuitBreaker({
      dependency: 'pubchem-api',
      execute: () => this.request(url),
    })

    if (result !== null) {
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
    }
    return result
  }

  private async request(url: string, init: RequestInit = {}): Promise<PubChemCompound | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'biozephyra/1.0',
          ...(init.headers as Record<string, string> | undefined),
        },
        signal: controller.signal,
      })
      return await this.parseResponse(res)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PubChemServiceError(
          `PubChem request timed out after ${this.timeoutMs}ms`,
          undefined,
          true,
        )
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private async parseResponse(res: Response): Promise<PubChemCompound | null> {
    // 404 = compound not found; return null rather than throwing
    if (res.status === 404) return null

    // 400 = malformed identifier; log and return null (not an upstream fault)
    if (res.status === 400) {
      const detail = await res.text()
      logger.warn('PubChem bad request', { status: 400, detail: detail.slice(0, 200) })
      return null
    }

    if (res.status === 429) {
      throw new PubChemServiceError('PubChem rate limit exceeded', 429, true)
    }

    if (!res.ok) {
      throw new PubChemServiceError(
        `PubChem API error ${res.status}`,
        res.status,
        res.status >= 500,
      )
    }

    let data: PropertyResponse
    try {
      data = (await res.json()) as PropertyResponse
    } catch {
      throw new PubChemServiceError('PubChem returned non-JSON response', undefined, false)
    }

    const raw = data.PropertyTable?.Properties?.[0]
    if (!raw) return null
    return this.fromRaw(raw)
  }

  private fromRaw(raw: RawProperty): PubChemCompound {
    return {
      cid: raw.CID,
      iupacName: raw.IUPACName ?? null,
      molecularFormula: raw.MolecularFormula ?? null,
      molecularWeight: raw.MolecularWeight != null ? Number(raw.MolecularWeight) : null,
      canonicalSmiles: raw.CanonicalSMILES ?? null,
      isomericSmiles: raw.IsomericSMILES ?? null,
      inchi: raw.InChI ?? null,
      inchiKey: raw.InChIKey ?? null,
      xlogp: raw.XLogP != null ? Number(raw.XLogP) : null,
      tpsa: raw.TPSA != null ? Number(raw.TPSA) : null,
      hBondDonorCount: raw.HBondDonorCount != null ? Number(raw.HBondDonorCount) : null,
      hBondAcceptorCount: raw.HBondAcceptorCount != null ? Number(raw.HBondAcceptorCount) : null,
      rotatableBondCount: raw.RotatableBondCount != null ? Number(raw.RotatableBondCount) : null,
    }
  }
}

export const pubchemService = new PubChemService()
