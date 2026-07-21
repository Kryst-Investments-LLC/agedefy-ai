/**
 * PubChem PUG REST Ingest Service
 *
 * Fetches compound data from PubChem and upserts into the local
 * knowledge graph.  Designed for batch/cron use.
 */

import { db } from '@/lib/db'
import { fetchWithTimeout } from '@/lib/http/fetch-with-timeout'
import { logger } from '@/lib/logger'

const PUBCHEM_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'

interface PubChemCompound {
  CID: number
  IUPACName?: string
  MolecularFormula?: string
  MolecularWeight?: number
  IsomericSMILES?: string
  InChI?: string
}

interface PubChemPropertyTable {
  PropertyTable?: {
    Properties?: PubChemCompound[]
  }
}

/**
 * Fetch compound properties from PubChem by name.
 */
export async function fetchCompoundByName(
  name: string,
): Promise<PubChemCompound | null> {
  const url = `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(name)}/property/IUPACName,MolecularFormula,MolecularWeight,IsomericSMILES,InChI/JSON`

  const res = await fetchWithTimeout(url)
  if (!res.ok) {
    if (res.status === 404) return null
    logger.warn('PubChem lookup failed', { name, status: res.status })
    return null
  }

  const data: PubChemPropertyTable = await res.json()
  const props = data.PropertyTable?.Properties?.[0]
  return props ?? null
}

/**
 * Fetch compound properties from PubChem by CID.
 */
export async function fetchCompoundByCID(
  cid: number,
): Promise<PubChemCompound | null> {
  const url = `${PUBCHEM_BASE}/compound/cid/${cid}/property/IUPACName,MolecularFormula,MolecularWeight,IsomericSMILES,InChI/JSON`

  const res = await fetchWithTimeout(url)
  if (!res.ok) {
    if (res.status === 404) return null
    logger.warn('PubChem CID lookup failed', { cid, status: res.status })
    return null
  }

  const data: PubChemPropertyTable = await res.json()
  const props = data.PropertyTable?.Properties?.[0]
  return props ?? null
}

/**
 * Ingest a single compound from PubChem by common name.
 * Upserts the compound into the local Compound model if not already present.
 *
 * Returns the local Compound id, or null on failure.
 */
export async function ingestCompoundByName(
  commonName: string,
  category?: string,
): Promise<string | null> {
  const pubchem = await fetchCompoundByName(commonName)
  if (!pubchem) {
    logger.info('PubChem compound not found', { commonName })
    return null
  }

  // Upsert based on name match
  const existing = await db.compound.findFirst({
    where: { name: commonName },
  })

  if (existing) {
    // Update with PubChem metadata if missing
    if (!existing.description && pubchem.IUPACName) {
      await db.compound.update({
        where: { id: existing.id },
        data: { description: `IUPAC: ${pubchem.IUPACName}. MW: ${pubchem.MolecularWeight ?? 'N/A'}` },
      })
    }
    return existing.id
  }

  const compound = await db.compound.create({
    data: {
      name: commonName,
      category: category ?? 'SUPPLEMENT',
      description: [
        pubchem.IUPACName ? `IUPAC: ${pubchem.IUPACName}` : null,
        pubchem.MolecularFormula ? `Formula: ${pubchem.MolecularFormula}` : null,
        pubchem.MolecularWeight ? `MW: ${pubchem.MolecularWeight}` : null,
      ]
        .filter(Boolean)
        .join('. '),
    },
  })

  logger.info('PubChem compound ingested', {
    compoundId: compound.id,
    name: commonName,
    cid: pubchem.CID,
  })

  return compound.id
}

/**
 * Batch ingest a list of compound names.
 *
 * Adds a 1 s delay between requests to respect PubChem rate limits (≤5/s).
 */
export async function batchIngestCompounds(
  names: string[],
  category?: string,
): Promise<{ ingested: string[]; failed: string[] }> {
  const ingested: string[] = []
  const failed: string[] = []

  for (const name of names) {
    const id = await ingestCompoundByName(name, category)
    if (id) {
      ingested.push(name)
    } else {
      failed.push(name)
    }
    // Respect PubChem rate limit
    await new Promise((r) => setTimeout(r, 1000))
  }

  logger.info('Batch PubChem ingest complete', {
    total: names.length,
    ingested: ingested.length,
    failed: failed.length,
  })

  return { ingested, failed }
}
