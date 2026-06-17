/**
 * BM25-style token-overlap reranker.
 *
 * Scores each item by how many query tokens appear in its text, weighted by
 * a TF component (BM25 k1/b formula). No LLM calls, no user health data.
 * Without a corpus for IDF estimation we treat all terms as equally
 * informative — which is appropriate for a domain-constrained vocabulary.
 */

const BM25_K1 = 1.5
const BM25_B = 0.75
const AVG_DOC_LEN = 80 // approximate token count for titles + short abstracts

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'this',
  'that', 'these', 'those', 'it', 'its', 'not', 'no',
])

export interface RankableItem {
  id: string
  text: string
  source: 'pubmed' | 'clinicaltrials' | 'vocabulary'
  metadata?: Record<string, unknown>
}

export interface RankedItem extends RankableItem {
  score: number
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

function termFrequencies(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
  return tf
}

function bm25Score(queryTokens: string[], docTokens: string[]): number {
  const docLen = docTokens.length
  const tf = termFrequencies(docTokens)
  let score = 0
  for (const qt of queryTokens) {
    const f = tf.get(qt) ?? 0
    if (f === 0) continue
    score += (f * (BM25_K1 + 1)) / (f + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / AVG_DOC_LEN)))
  }
  return score
}

/**
 * Rank items by BM25 score descending. Items with score 0 are retained at
 * the end (preserving original relative order among them) so callers can
 * truncate at their desired k.
 */
export function rerank(query: string, items: RankableItem[]): RankedItem[] {
  const queryTokens = tokenize(query)

  const scored: RankedItem[] = items.map((item) => ({
    ...item,
    score: bm25Score(queryTokens, tokenize(item.text)),
  }))

  // Stable sort: higher score first; ties preserve insertion order.
  scored.sort((a, b) => b.score - a.score)
  return scored
}
