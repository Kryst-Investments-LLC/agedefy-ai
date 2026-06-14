/**
 * RCSB PDB Service
 *
 * Fetches protein structure metadata and downloads structure files by PDB ID,
 * for use as docking targets or visualisation inputs.
 *
 * Two tiers:
 *   fetchMetadata       — JSON from the RCSB data API; in-memory TTL cache (default 24 h)
 *   fetchStructureFile  — mmCIF / legacy-PDB file; persisted to disk cache indefinitely
 *
 * Metadata and file-download failures gate independently: they use separate
 * circuit-breaker dependency names ('rcsb-metadata' and 'rcsb-files').
 *
 * Configuration (all optional — defaults work for production):
 *   PDB_METADATA_BASE_URL    Override data.rcsb.org REST base
 *   PDB_FILES_BASE_URL       Override files.rcsb.org download base
 *   PDB_TIMEOUT_MS           Per-request timeout in ms (default 30 000)
 *   PDB_CACHE_TTL_MS         In-memory metadata TTL in ms (default 86 400 000 = 24 h)
 *   PDB_STRUCTURE_CACHE_DIR  Directory for cached structure files (default: data/pdb-structures)
 */

import { access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { executeWithCircuitBreaker } from '@/lib/circuit-breaker'
import { logger } from '@/lib/logger'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_METADATA_BASE_URL = 'https://data.rcsb.org/rest/v1/core/entry'
const DEFAULT_FILES_BASE_URL = 'https://files.rcsb.org/download'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1_000 // 24 hours
const DEFAULT_CACHE_DIR = 'data/pdb-structures'

// ── Public types ──────────────────────────────────────────────────────────────

export interface PdbStructureMetadata {
  pdbId: string
  title: string | null
  depositionDate: string | null
  releaseDate: string | null
  revisionDate: string | null
  /** Best-available resolution in Å (X-ray: ls_d_res_high; cryo-EM: em3d reconstruction). */
  resolution: number | null
  rFree: number | null
  /** e.g. "X-RAY DIFFRACTION", "ELECTRON MICROSCOPY", "SOLUTION NMR". */
  experimentalMethod: string | null
  spaceGroup: string | null
  entityCount: number | null
  polymerEntityCount: number | null
  nonpolymerEntityCount: number | null
}

export interface PdbStructureFile {
  pdbId: string
  format: 'cif' | 'pdb'
  /** Absolute path to the cached file on disk. Pass directly to docking tools. */
  path: string
}

export class PdbServiceError extends Error {
  readonly status: number | undefined
  /** True when the caller may retry (rate-limit, timeout, 5xx). */
  readonly retryable: boolean

  constructor(message: string, status?: number, retryable = false) {
    super(message)
    this.name = 'PdbServiceError'
    this.status = status
    this.retryable = retryable
  }
}

// ── Internal types ────────────────────────────────────────────────────────────

interface RawEntry {
  rcsb_id?: string
  struct?: { title?: string | null }
  rcsb_accession_info?: {
    deposit_date?: string | null
    initial_release_date?: string | null
    revision_date?: string | null
  }
  refine?: Array<{
    ls_d_res_high?: number | null
    ls_R_factor_R_free?: number | null
  }>
  exptl?: Array<{ method?: string | null }>
  symmetry?: { space_group_name_H_M?: string | null }
  rcsb_entry_info?: {
    entity_count?: number | null
    polymer_entity_count?: number | null
    nonpolymer_entity_count?: number | null
  }
  em_3d_reconstruction?: Array<{ resolution?: number | null }>
}

interface MetadataCacheEntry {
  data: PdbStructureMetadata
  timestamp: number
}

// ── Service ───────────────────────────────────────────────────────────────────

class PdbService {
  private readonly metadataBaseUrl: string
  private readonly filesBaseUrl: string
  private readonly timeoutMs: number
  private readonly cacheTtlMs: number
  private readonly cacheDir: string
  private readonly metadataCache: Map<string, MetadataCacheEntry>

  constructor() {
    this.metadataBaseUrl = (
      process.env.PDB_METADATA_BASE_URL ?? DEFAULT_METADATA_BASE_URL
    ).replace(/\/$/, '')
    this.filesBaseUrl = (
      process.env.PDB_FILES_BASE_URL ?? DEFAULT_FILES_BASE_URL
    ).replace(/\/$/, '')
    this.timeoutMs = parseInt(process.env.PDB_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10)
    this.cacheTtlMs = parseInt(process.env.PDB_CACHE_TTL_MS ?? String(DEFAULT_CACHE_TTL_MS), 10)
    this.cacheDir = process.env.PDB_STRUCTURE_CACHE_DIR
      ?? path.join(process.cwd(), DEFAULT_CACHE_DIR)
    this.metadataCache = new Map()
  }

  /**
   * Fetch structure metadata for a PDB entry.
   * Returns null when the PDB ID is not found.
   */
  async fetchMetadata(pdbId: string): Promise<PdbStructureMetadata | null> {
    const id = pdbId.toUpperCase().trim()

    const cached = this.metadataCache.get(id)
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      logger.debug('PDB metadata cache hit', { pdbId: id })
      return cached.data
    }

    const result = await executeWithCircuitBreaker({
      dependency: 'rcsb-metadata',
      execute: () => this.requestMetadata(id),
    })

    if (result !== null) {
      this.metadataCache.set(id, { data: result, timestamp: Date.now() })
    }
    return result
  }

  /**
   * Download and cache a structure file for a PDB entry.
   * Checks the local disk cache first; downloads and writes only when absent.
   * Default format is mmCIF (.cif), which covers all entries including recent ones.
   * Returns null when the PDB ID is not found.
   */
  async fetchStructureFile(
    pdbId: string,
    format: 'cif' | 'pdb' = 'cif',
  ): Promise<PdbStructureFile | null> {
    const id = pdbId.toUpperCase().trim()
    const filePath = path.join(this.cacheDir, `${id}.${format}`)

    // Disk cache check — pure local I/O, outside the circuit breaker
    try {
      await access(filePath)
      logger.debug('PDB structure file cache hit', { pdbId: id, format })
      return { pdbId: id, format, path: filePath }
    } catch {
      // File not cached — fall through to download
    }

    const content = await executeWithCircuitBreaker({
      dependency: 'rcsb-files',
      execute: () => this.downloadStructureFile(id, format),
    })

    if (content === null) return null

    await mkdir(this.cacheDir, { recursive: true })
    await writeFile(filePath, content, 'utf-8')
    logger.debug('PDB structure file written to cache', { pdbId: id, format, path: filePath })
    return { pdbId: id, format, path: filePath }
  }

  /** Drop the in-memory metadata cache. Does not remove cached structure files from disk. */
  clearCache(): void {
    this.metadataCache.clear()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async requestMetadata(id: string): Promise<PdbStructureMetadata | null> {
    const url = `${this.metadataBaseUrl}/${encodeURIComponent(id)}`
    const res = await this.request(url)
    if (res.status === 404) return null
    await this.guardStatus(res, 'metadata')

    let data: RawEntry
    try {
      data = (await res.json()) as RawEntry
    } catch {
      throw new PdbServiceError('RCSB returned non-JSON metadata response', undefined, false)
    }
    return this.fromRawEntry(data, id)
  }

  private async downloadStructureFile(
    id: string,
    format: 'cif' | 'pdb',
  ): Promise<string | null> {
    const url = `${this.filesBaseUrl}/${id}.${format}`
    const res = await this.request(url)
    if (res.status === 404) return null
    await this.guardStatus(res, 'file')

    try {
      return await res.text()
    } catch {
      throw new PdbServiceError('RCSB returned unreadable file response', undefined, false)
    }
  }

  private async request(url: string): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await fetch(url, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'biozephyra/1.0',
        },
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PdbServiceError(
          `RCSB request timed out after ${this.timeoutMs}ms`,
          undefined,
          true,
        )
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private async guardStatus(res: Response, context: string): Promise<void> {
    if (res.status === 429) {
      throw new PdbServiceError(`RCSB ${context} rate limit exceeded`, 429, true)
    }
    if (!res.ok) {
      throw new PdbServiceError(
        `RCSB ${context} error ${res.status}`,
        res.status,
        res.status >= 500,
      )
    }
  }

  private fromRawEntry(raw: RawEntry, pdbId: string): PdbStructureMetadata {
    const resolution =
      raw.refine?.[0]?.ls_d_res_high ?? raw.em_3d_reconstruction?.[0]?.resolution ?? null
    return {
      pdbId,
      title: raw.struct?.title ?? null,
      depositionDate: raw.rcsb_accession_info?.deposit_date ?? null,
      releaseDate: raw.rcsb_accession_info?.initial_release_date ?? null,
      revisionDate: raw.rcsb_accession_info?.revision_date ?? null,
      resolution: resolution != null ? Number(resolution) : null,
      rFree: raw.refine?.[0]?.ls_R_factor_R_free ?? null,
      experimentalMethod: raw.exptl?.[0]?.method ?? null,
      spaceGroup: raw.symmetry?.space_group_name_H_M ?? null,
      entityCount: raw.rcsb_entry_info?.entity_count ?? null,
      polymerEntityCount: raw.rcsb_entry_info?.polymer_entity_count ?? null,
      nonpolymerEntityCount: raw.rcsb_entry_info?.nonpolymer_entity_count ?? null,
    }
  }
}

export const pdbService = new PdbService()
