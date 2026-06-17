import { env } from "@/lib/env"
import { executeWithCircuitBreaker } from "@/lib/circuit-breaker"

const EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
const CB_DEPENDENCY = "pubmed-api"

export type PubMedSearchResult = {
  pmids: string[]
  count: number
}

export type PubMedArticleSummary = {
  pmid: string
  title: string
  authors: string
  source: string
  publishedDate: string
}

export type StudyType = 'RCT' | 'meta-analysis' | 'observational'

export interface PubMedFilters {
  minYear?: number
  studyType?: StudyType
}

const STUDY_TYPE_MESH: Record<StudyType, string> = {
  'RCT': 'randomized controlled trial[pt]',
  'meta-analysis': 'meta-analysis[pt]',
  'observational': 'observational study[pt]',
}

export async function searchPubMed(
  query: string,
  maxResults: number,
  filters: PubMedFilters = {},
): Promise<PubMedSearchResult> {
  return executeWithCircuitBreaker({
    dependency: CB_DEPENDENCY,
    execute: async () => {
      let term = query
      if (filters.minYear) {
        term += ` AND ${filters.minYear}:${new Date().getFullYear()}[dp]`
      }
      if (filters.studyType) {
        term += ` AND ${STUDY_TYPE_MESH[filters.studyType]}`
      }

      const params = new URLSearchParams({
        db: "pubmed",
        retmode: "json",
        retmax: String(maxResults),
        term,
      })

      if (env.PUBMED_EMAIL) {
        params.set("email", env.PUBMED_EMAIL)
      }

      const response = await fetch(`${EUTILS_BASE}/esearch.fcgi?${params.toString()}`, {
        next: { revalidate: 300 },
      })

      if (!response.ok) {
        throw new Error(`PubMed search failed: ${response.status}`)
      }

      const data = await response.json()
      const result = data?.esearchresult

      return {
        pmids: result?.idlist ?? [],
        count: Number(result?.count ?? 0),
      }
    },
  })
}

export async function fetchPubMedSummaries(pmids: string[]): Promise<PubMedArticleSummary[]> {
  if (pmids.length === 0) return []

  return executeWithCircuitBreaker({
    dependency: CB_DEPENDENCY,
    execute: async () => {
      const params = new URLSearchParams({
        db: "pubmed",
        retmode: "json",
        id: pmids.join(","),
      })

      if (env.PUBMED_EMAIL) {
        params.set("email", env.PUBMED_EMAIL)
      }

      const response = await fetch(`${EUTILS_BASE}/esummary.fcgi?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`PubMed summary failed: ${response.status}`)
      }

      const data = await response.json()
      const uids: string[] = data?.result?.uids ?? []

      return uids.map((uid) => {
        const entry = data.result[uid]
        return {
          pmid: uid,
          title: entry?.title ?? "",
          authors: (entry?.authors ?? []).map((a: { name: string }) => a.name).join(", "),
          source: entry?.source ?? "",
          publishedDate: entry?.pubdate ?? "",
        }
      })
    },
  })
}

export async function fetchPubMedAbstract(pmid: string): Promise<string | null> {
  return executeWithCircuitBreaker({
    dependency: CB_DEPENDENCY,
    execute: async () => {
      const params = new URLSearchParams({
        db: "pubmed",
        retmode: "xml",
        rettype: "abstract",
        id: pmid,
      })

      if (env.PUBMED_EMAIL) {
        params.set("email", env.PUBMED_EMAIL)
      }

      const response = await fetch(`${EUTILS_BASE}/efetch.fcgi?${params.toString()}`)

      if (!response.ok) return null

      const xml = await response.text()
      const match = xml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/)
      return match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null
    },
  })
}
