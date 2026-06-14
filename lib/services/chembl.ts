/**
 * ChEMBL REST Service
 *
 * Given a SMILES string or InChIKey, fetches:
 *   • The matching ChEMBL compound record (identity + physicochemical properties)
 *   • Known bioactivities with inline target name, organism, assay type, and pChEMBL value
 *
 * Uses the public EBI ChEMBL REST API (no key required).
 * Upstream rate limit: ≤ 5 req/s; the 1-hour TTL cache keeps traffic well below that.
 *
 * Configuration (all optional — defaults work for production):
 *   CHEMBL_BASE_URL         Override the REST base (useful for tests/proxies)
 *   CHEMBL_TIMEOUT_MS       Per-request timeout in ms (default 15 000)
 *   CHEMBL_CACHE_TTL_MS     Result cache TTL in ms (default 3 600 000 = 1 h)
 *   CHEMBL_MAX_ACTIVITIES   Max bioactivities fetched per compound (default 200)
 */

import { executeWithCircuitBreaker } from '@/lib/circuit-breaker'
import { logger } from '@/lib/logger'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://www.ebi.ac.uk/chembl/api/data'
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1_000 // 1 hour
const DEFAULT_MAX_ACTIVITIES = 200

// ── Public types ──────────────────────────────────────────────────────────────

export interface ChEMBLCompound {
  chemblId: string
  prefName: string | null
  /** Highest clinical phase reached (0 = preclinical, 4 = approved). */
  maxPhase: number | null
  firstApprovalYear: number | null
  canonicalSmiles: string | null
  inchiKey: string | null
  molecularFormula: string | null
  mwFreebase: number | null
  alogp: number | null
  /** H-bond donor count. */
  hbdCount: number | null
  /** H-bond acceptor count (Lipinski). */
  hbaCount: number | null
  rotatableBonds: number | null
  /** Topological polar surface area (Å²). */
  tpsa: number | null
}

export interface ChEMBLBioactivity {
  activityId: number | null
  assayChemblId: string | null
  /** ChEMBL assay type: B=Binding, F=Functional, A=ADMET, P=Physicochemical, U=Unclassified. */
  assayType: string | null
  assayDescription: string | null
  targetChemblId: string | null
  targetPrefName: string | null
  targetOrganism: string | null
  /** Measurement type: IC50, Ki, EC50, Kd, … */
  standardType: string | null
  /** Relational operator: =, <, >, <=, >= */
  standardRelation: string | null
  standardValue: number | null
  standardUnits: string | null
  /** −log10(standardValue in M). Values ≥ 5 are generally considered active. */
  pchemblValue: number | null
}

export interface ChEMBLResult {
  compound: ChEMBLCompound
  bioactivities: ChEMBLBioactivity[]
  /** Total bioactivities available in ChEMBL (may exceed the returned slice). */
  totalBioactivities: number
}

export class ChEMBLServiceError extends Error {
  readonly status: number | undefined
  /** True when the caller may retry (rate-limit, timeout, 5xx). */
  readonly retryable: boolean

  constructor(message: string, status?: number, retryable = false) {
    super(message)
    this.name = 'ChEMBLServiceError'
    this.status = status
    this.retryable = retryable
  }
}

// ── Internal types ────────────────────────────────────────────────────────────

interface RawMoleculeProperties {
  mw_freebase?: number | string | null
  alogp?: number | string | null
  hbd?: number | string | null
  hba?: number | string | null
  rtb?: number | string | null
  psa?: number | string | null
  molecular_formula?: string | null
}

interface RawMoleculeStructures {
  canonical_smiles?: string | null
  standard_inchi_key?: string | null
}

interface RawMolecule {
  molecule_chembl_id: string
  pref_name?: string | null
  max_phase?: number | null
  first_approval?: number | null
  molecule_properties?: RawMoleculeProperties | null
  molecule_structures?: RawMoleculeStructures | null
}

interface MoleculeListResponse {
  molecules?: RawMolecule[]
  page_meta?: { total_count: number; limit: number; offset: number }
}

interface RawActivity {
  activity_id?: number | null
  assay_chembl_id?: string | null
  assay_type?: string | null
  assay_description?: string | null
  target_chembl_id?: string | null
  target_pref_name?: string | null
  target_organism?: string | null
  standard_type?: string | null
  standard_relation?: string | null
  standard_value?: number | string | null
  standard_units?: string | null
  pchembl_value?: number | string | null
}

interface ActivityListResponse {
  activities?: RawActivity[]
  page_meta?: { total_count: number; limit: number; offset: number }
}

interface CacheEntry {
  data: ChEMBLResult
  timestamp: number
}

// ── Service ───────────────────────────────────────────────────────────────────

class ChEMBLService {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly cacheTtlMs: number
  private readonly maxActivities: number
  private readonly cache: Map<string, CacheEntry>

  constructor() {
    this.baseUrl = (process.env.CHEMBL_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.timeoutMs = parseInt(process.env.CHEMBL_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10)
    this.cacheTtlMs = parseInt(process.env.CHEMBL_CACHE_TTL_MS ?? String(DEFAULT_CACHE_TTL_MS), 10)
    this.maxActivities = parseInt(process.env.CHEMBL_MAX_ACTIVITIES ?? String(DEFAULT_MAX_ACTIVITIES), 10)
    this.cache = new Map()
  }

  /**
   * Look up a compound by its InChIKey and return its bioactivities.
   * Returns null when ChEMBL does not recognise the InChIKey.
   */
  async lookupByInchiKey(inchiKey: string): Promise<ChEMBLResult | null> {
    const cacheKey = `inchikey:${inchiKey}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      logger.debug('ChEMBL cache hit', { cacheKey })
      return cached.data
    }

    const result = await executeWithCircuitBreaker({
      dependency: 'chembl-api',
      execute: () => this.fetchByInchiKey(inchiKey),
    })

    if (result !== null) {
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() })
    }
    return result
  }

  /**
   * Look up a compound by SMILES (exact match after ChEMBL standardisation) and return its bioactivities.
   * Returns null when the SMILES cannot be matched to any ChEMBL compound.
   */
  async lookupBySmiles(smiles: string): Promise<ChEMBLResult | null> {
    const cacheKey = `smiles:${smiles}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      logger.debug('ChEMBL cache hit', { cacheKey })
      return cached.data
    }

    const result = await executeWithCircuitBreaker({
      dependency: 'chembl-api',
      execute: () => this.fetchBySmiles(smiles),
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

  private async fetchByInchiKey(inchiKey: string): Promise<ChEMBLResult | null> {
    const url = `${this.baseUrl}/molecule.json?molecule_structures__standard_inchi_key=${encodeURIComponent(inchiKey)}`
    const res = await this.request(url)
    if (res.status === 404) return null
    const molecule = await this.parseMoleculeList(res)
    if (!molecule) return null
    return this.buildResult(molecule)
  }

  private async fetchBySmiles(smiles: string): Promise<ChEMBLResult | null> {
    const url = `${this.baseUrl}/molecule.json?molecule_structures__canonical_smiles__flexmatch=${encodeURIComponent(smiles)}`
    const res = await this.request(url)
    if (res.status === 404) return null
    const molecule = await this.parseMoleculeList(res)
    if (!molecule) return null
    return this.buildResult(molecule)
  }

  private async buildResult(molecule: RawMolecule): Promise<ChEMBLResult> {
    const { activities, total } = await this.fetchActivities(molecule.molecule_chembl_id)
    return {
      compound: this.fromRawMolecule(molecule),
      bioactivities: activities.map((a) => this.fromRawActivity(a)),
      totalBioactivities: total,
    }
  }

  private async fetchActivities(
    chemblId: string,
  ): Promise<{ activities: RawActivity[]; total: number }> {
    const url = `${this.baseUrl}/activity.json?molecule_chembl_id=${encodeURIComponent(chemblId)}&limit=${this.maxActivities}`
    const res = await this.request(url)

    if (res.status === 404) return { activities: [], total: 0 }

    await this.guardStatus(res)

    let data: ActivityListResponse
    try {
      data = (await res.json()) as ActivityListResponse
    } catch {
      throw new ChEMBLServiceError('ChEMBL returned non-JSON activity response', undefined, false)
    }

    return {
      activities: data.activities ?? [],
      total: data.page_meta?.total_count ?? (data.activities?.length ?? 0),
    }
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  private async request(url: string): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'biozephyra/1.0',
        },
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ChEMBLServiceError(
          `ChEMBL request timed out after ${this.timeoutMs}ms`,
          undefined,
          true,
        )
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private async guardStatus(res: Response): Promise<void> {
    if (res.status === 429) throw new ChEMBLServiceError('ChEMBL rate limit exceeded', 429, true)
    if (!res.ok) {
      throw new ChEMBLServiceError(
        `ChEMBL API error ${res.status}`,
        res.status,
        res.status >= 500,
      )
    }
  }

  private async parseMoleculeList(res: Response): Promise<RawMolecule | null> {
    await this.guardStatus(res)

    let data: MoleculeListResponse
    try {
      data = (await res.json()) as MoleculeListResponse
    } catch {
      throw new ChEMBLServiceError('ChEMBL returned non-JSON molecule response', undefined, false)
    }

    const molecule = data.molecules?.[0]
    if (!molecule?.molecule_chembl_id) return null
    return molecule
  }

  // ── Normalisation ─────────────────────────────────────────────────────────

  private fromRawMolecule(raw: RawMolecule): ChEMBLCompound {
    const p = raw.molecule_properties ?? {}
    const s = raw.molecule_structures ?? {}
    return {
      chemblId: raw.molecule_chembl_id,
      prefName: raw.pref_name ?? null,
      maxPhase: raw.max_phase ?? null,
      firstApprovalYear: raw.first_approval ?? null,
      canonicalSmiles: s.canonical_smiles ?? null,
      inchiKey: s.standard_inchi_key ?? null,
      molecularFormula: p.molecular_formula ?? null,
      mwFreebase: p.mw_freebase != null ? Number(p.mw_freebase) : null,
      alogp: p.alogp != null ? Number(p.alogp) : null,
      hbdCount: p.hbd != null ? Number(p.hbd) : null,
      hbaCount: p.hba != null ? Number(p.hba) : null,
      rotatableBonds: p.rtb != null ? Number(p.rtb) : null,
      tpsa: p.psa != null ? Number(p.psa) : null,
    }
  }

  private fromRawActivity(raw: RawActivity): ChEMBLBioactivity {
    return {
      activityId: raw.activity_id ?? null,
      assayChemblId: raw.assay_chembl_id ?? null,
      assayType: raw.assay_type ?? null,
      assayDescription: raw.assay_description ?? null,
      targetChemblId: raw.target_chembl_id ?? null,
      targetPrefName: raw.target_pref_name ?? null,
      targetOrganism: raw.target_organism ?? null,
      standardType: raw.standard_type ?? null,
      standardRelation: raw.standard_relation ?? null,
      standardValue: raw.standard_value != null ? Number(raw.standard_value) : null,
      standardUnits: raw.standard_units ?? null,
      pchemblValue: raw.pchembl_value != null ? Number(raw.pchembl_value) : null,
    }
  }
}

export const chemblService = new ChEMBLService()
