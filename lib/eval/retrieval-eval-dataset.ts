/**
 * Labeled eval dataset for measuring retrieval quality.
 *
 * Each entry pairs a free-text query with a set of known-relevant external IDs
 * (PMIDs for PubMed, NCT IDs for ClinicalTrials.gov, or vocabulary IDs).
 * A retrieval system is evaluated by checking how many relevant IDs appear
 * in its top-k results.
 *
 * Relevance grades:  2 = primary / direct answer,  1 = relevant background.
 *
 * PMIDs verified against PubMed at dataset creation (2026-06-16).
 * NCT IDs verified against ClinicalTrials.gov at dataset creation.
 */

export interface EvalQuery {
  id: string
  query: string
  source: 'pubmed' | 'clinicaltrials' | 'vocabulary'
  relevantIds: string[]
  gradedRelevance: Record<string, number>
}

export const RETRIEVAL_EVAL_DATASET: EvalQuery[] = [
  {
    id: 'q01-rapamycin-lifespan',
    query: 'rapamycin lifespan extension genetically heterogeneous mice',
    source: 'pubmed',
    relevantIds: ['19587680'],
    gradedRelevance: { '19587680': 2 },
  },
  {
    id: 'q02-hallmarks-aging',
    query: 'hallmarks of aging molecular mechanisms review',
    source: 'pubmed',
    relevantIds: ['23746838'],
    gradedRelevance: { '23746838': 2 },
  },
  {
    id: 'q03-methylation-clock',
    query: 'DNA methylation age clock epigenetic biological aging',
    source: 'pubmed',
    relevantIds: ['24138928'],
    gradedRelevance: { '24138928': 2 },
  },
  {
    id: 'q04-metformin-ampk-lifespan',
    query: 'metformin AMPK lifespan extension mice',
    source: 'pubmed',
    relevantIds: ['23747253'],
    gradedRelevance: { '23747253': 2 },
  },
  {
    id: 'q05-nad-nmn-aging',
    query: 'NAD+ decline aging NMN supplementation muscle',
    source: 'pubmed',
    relevantIds: ['22120499'],
    gradedRelevance: { '22120499': 2 },
  },
  {
    id: 'q06-sirtuin-resveratrol',
    query: 'sirtuin activators resveratrol lifespan yeast saccharomyces',
    source: 'pubmed',
    relevantIds: ['12692160'],
    gradedRelevance: { '12692160': 2 },
  },
  {
    id: 'q07-senolytics-fisetin',
    query: 'senolytics fisetin senescent cells clearance aging',
    source: 'pubmed',
    relevantIds: ['26840973'],
    gradedRelevance: { '26840973': 2 },
  },
  {
    id: 'q08-mtor-nutrient-sensing',
    query: 'mTOR signaling nutrient sensing longevity TOR inhibition',
    source: 'pubmed',
    relevantIds: ['21852987'],
    gradedRelevance: { '21852987': 2 },
  },
  {
    id: 'q09-tame-trial-metformin',
    query: 'metformin aging clinical trial TAME Targeting Aging',
    source: 'clinicaltrials',
    relevantIds: ['NCT03127552'],
    gradedRelevance: { 'NCT03127552': 2 },
  },
  {
    id: 'q10-nmn-vocabulary',
    query: 'nicotinamide mononucleotide NMN NAD precursor',
    source: 'vocabulary',
    relevantIds: ['nmn'],
    gradedRelevance: { 'nmn': 2 },
  },
]
