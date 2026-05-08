import { searchPubMed, fetchPubMedSummaries, fetchPubMedAbstract } from "@/lib/research"
import { db } from "@/lib/db"
import { logAudit } from "@/lib/audit"
import { logger } from "@/lib/logger"

// PubMed longevity search queries mapped to ArticleTopic
const TOPIC_QUERIES: Array<{ topic: string; query: string; maxResults: number }> = [
  { topic: "PATHWAYS", query: "longevity signaling pathways mTOR AMPK sirtuins review", maxResults: 8 },
  { topic: "COMPOUNDS", query: "anti-aging compounds rapamycin metformin NMN NAD+ review", maxResults: 8 },
  { topic: "BIOMARKERS", query: "aging biomarkers telomere epigenetic clock review", maxResults: 8 },
  { topic: "PROTOCOLS", query: "caloric restriction intermittent fasting longevity protocol review", maxResults: 6 },
  { topic: "NUTRITION", query: "nutrition longevity Mediterranean diet polyphenols review", maxResults: 6 },
  { topic: "EXERCISE", query: "exercise aging muscle sarcopenia aerobic resistance review", maxResults: 6 },
  { topic: "SLEEP", query: "sleep aging circadian rhythm melatonin health review", maxResults: 4 },
  { topic: "OVERVIEW", query: "hallmarks of aging longevity interventions review 2024", maxResults: 6 },
]

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 80)
    .replace(/^-|-$/g, "")
}

function formatArticleBody(opts: {
  title: string
  authors: string
  source: string
  publishedDate: string
  abstract: string | null
  pmid: string
}): string {
  const lines: string[] = []

  lines.push(`## ${opts.title}`)
  lines.push("")

  if (opts.authors) {
    lines.push(`- **Authors:** ${opts.authors}`)
  }
  if (opts.source) {
    lines.push(`- **Journal:** ${opts.source}`)
  }
  if (opts.publishedDate) {
    lines.push(`- **Published:** ${opts.publishedDate}`)
  }
  lines.push(`- **PubMed ID:** [${opts.pmid}](https://pubmed.ncbi.nlm.nih.gov/${opts.pmid}/)`)
  lines.push("")

  if (opts.abstract) {
    lines.push("## Abstract")
    lines.push("")
    lines.push(opts.abstract)
    lines.push("")
  }

  lines.push("**Key reference:** This article is sourced from PubMed and represents peer-reviewed published research. Always verify findings against the original publication before applying to health decisions.")

  return lines.join("\n")
}

export type ImportResult = {
  topic: string
  searched: number
  imported: number
  skipped: number
  errors: number
  articles: Array<{ pmid: string; title: string; slug: string }>
}

export type PipelineResult = {
  totalImported: number
  totalSkipped: number
  totalErrors: number
  topics: ImportResult[]
}

/**
 * Bulk-import PubMed articles into the Learning Center.
 *
 * - Searches PubMed across 8 longevity topic areas
 * - Fetches article summaries and abstracts
 * - Creates LearnArticle records with proper slugs, topics, and body formatting
 * - Skips articles that already exist (by slug dedup)
 * - Requires an ADMIN or RESEARCHER userId to attribute authorship
 */
export async function runPubMedContentPipeline(opts: {
  authorUserId: string
  published?: boolean
  dryRun?: boolean
}): Promise<PipelineResult> {
  const { authorUserId, published = false, dryRun = false } = opts

  // Validate author exists and has the right role
  const author = await db.user.findUnique({
    where: { id: authorUserId },
    select: { id: true, role: true, email: true },
  })

  if (!author) throw new Error("Author user not found")
  if (!["ADMIN", "RESEARCHER"].includes(author.role)) {
    throw new Error("Author must have ADMIN or RESEARCHER role")
  }

  const result: PipelineResult = {
    totalImported: 0,
    totalSkipped: 0,
    totalErrors: 0,
    topics: [],
  }

  // Get all existing slugs to dedup
  const existingSlugs = new Set(
    (await db.learnArticle.findMany({ select: { slug: true } })).map((a) => a.slug)
  )

  for (const topicConfig of TOPIC_QUERIES) {
    const topicResult: ImportResult = {
      topic: topicConfig.topic,
      searched: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      articles: [],
    }

    try {
      // 1. Search PubMed
      const searchResult = await searchPubMed(topicConfig.query, topicConfig.maxResults)
      topicResult.searched = searchResult.pmids.length

      if (searchResult.pmids.length === 0) {
        result.topics.push(topicResult)
        continue
      }

      // 2. Fetch summaries
      const summaries = await fetchPubMedSummaries(searchResult.pmids)

      // 3. Process each article
      for (const summary of summaries) {
        try {
          const baseSlug = slugify(summary.title)
          if (!baseSlug) {
            topicResult.skipped++
            continue
          }

          // Append pmid to ensure uniqueness
          const slug = `${baseSlug}-${summary.pmid}`

          if (existingSlugs.has(slug)) {
            topicResult.skipped++
            continue
          }

          // 4. Fetch abstract
          const abstract = await fetchPubMedAbstract(summary.pmid)

          // Build article body
          const body = formatArticleBody({
            title: summary.title,
            authors: summary.authors,
            source: summary.source,
            publishedDate: summary.publishedDate,
            abstract,
            pmid: summary.pmid,
          })

          // Trim title for summary if abstract is too long
          const articleSummary = abstract
            ? abstract.substring(0, 300) + (abstract.length > 300 ? "…" : "")
            : `Research article: ${summary.title}`

          if (!dryRun) {
            await db.learnArticle.create({
              data: {
                authorId: authorUserId,
                title: summary.title.substring(0, 500),
                slug,
                topic: topicConfig.topic as never,
                summary: articleSummary,
                body,
                published,
                reviewed: false,
                publishedAt: published ? new Date() : null,
              },
            })
          }

          existingSlugs.add(slug)
          topicResult.imported++
          topicResult.articles.push({
            pmid: summary.pmid,
            title: summary.title,
            slug,
          })

          // Rate-limit PubMed API calls (NCBI asks for max 3 req/sec without API key)
          await new Promise((r) => setTimeout(r, 350))
        } catch (err) {
          logger.warn("Failed to import PubMed article", {
            pmid: summary.pmid,
            error: err instanceof Error ? err.message : String(err),
          })
          topicResult.errors++
        }
      }
    } catch (err) {
      logger.error("Failed to search PubMed for topic", {
        topic: topicConfig.topic,
        error: err instanceof Error ? err.message : String(err),
      })
      topicResult.errors++
    }

    result.topics.push(topicResult)
    result.totalImported += topicResult.imported
    result.totalSkipped += topicResult.skipped
    result.totalErrors += topicResult.errors
  }

  if (!dryRun && result.totalImported > 0) {
    await logAudit({
      actorUserId: authorUserId,
      actorEmail: author.email ?? undefined,
      action: "learn.pipeline.bulk-import",
      entityType: "LearnArticle",
      entityId: "bulk",
      details: {
        totalImported: result.totalImported,
        totalSkipped: result.totalSkipped,
        topics: result.topics.map((t) => `${t.topic}:${t.imported}`).join(", "),
      },
    })
  }

  logger.info("PubMed content pipeline complete", {
    totalImported: result.totalImported,
    totalSkipped: result.totalSkipped,
    totalErrors: result.totalErrors,
    dryRun,
  })

  return result
}
