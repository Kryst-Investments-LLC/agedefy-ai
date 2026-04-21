import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { BookOpen, ExternalLink } from "lucide-react"

const topicLabel: Record<string, string> = {
  OVERVIEW: "Overview",
  PATHWAYS: "Pathways",
  COMPOUNDS: "Compounds",
  BIOMARKERS: "Biomarkers",
  PROTOCOLS: "Protocols",
  NUTRITION: "Nutrition",
  EXERCISE: "Exercise",
  SLEEP: "Sleep",
}

/**
 * Curated, free external longevity science resources. These are public lecture
 * series, university programs, and review papers — not paid endorsements. Each
 * link should remain stable; if any 404s, replace with the canonical archive.
 */
const externalResources: { title: string; provider: string; url: string; format: string; cost: string }[] = [
  {
    title: "MIT 7.343 Biology of Aging (lecture notes & syllabi)",
    provider: "MIT OpenCourseWare",
    url: "https://ocw.mit.edu/courses/7-343-biology-of-aging-fall-2009/",
    format: "Lecture series",
    cost: "Free",
  },
  {
    title: "The Hallmarks of Aging (López-Otín et al., 2023 update)",
    provider: "Cell — open access",
    url: "https://www.cell.com/cell/fulltext/S0092-8674(22)01617-0",
    format: "Review paper",
    cost: "Free",
  },
  {
    title: "Stanford Center on Longevity — public lectures",
    provider: "Stanford University",
    url: "https://longevity.stanford.edu/",
    format: "Video + reports",
    cost: "Free",
  },
  {
    title: "Biology of Aging Specialization",
    provider: "Coursera (audit available)",
    url: "https://www.coursera.org/learn/biology-of-aging",
    format: "Online course",
    cost: "Free to audit",
  },
  {
    title: "Lifespan podcast & book companion (David Sinclair lab)",
    provider: "Harvard Medical School",
    url: "https://lifespanpodcast.com/",
    format: "Podcast",
    cost: "Free",
  },
  {
    title: "Buck Institute educational webinars",
    provider: "Buck Institute for Research on Aging",
    url: "https://www.buckinstitute.org/learning-resources/",
    format: "Webinars + articles",
    cost: "Free",
  },
  {
    title: "ClinicalTrials.gov — longevity & senolytic studies",
    provider: "U.S. National Library of Medicine",
    url: "https://clinicaltrials.gov/search?term=longevity",
    format: "Trial registry",
    cost: "Free",
  },
]

export default async function LearnPage() {
  const [articles, topics] = await Promise.all([
    db.learnArticle.findMany({
      where: { published: true },
      select: {
        id: true,
        title: true,
        slug: true,
        topic: true,
        summary: true,
        publishedAt: true,
        author: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
    }),
    db.learnArticle.groupBy({
      by: ["topic"],
      where: { published: true },
      _count: true,
    }),
  ])

  const topicCounts = Object.fromEntries(topics.map((t) => [t.topic, t._count]))

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="mx-auto max-w-4xl px-4 py-10 text-white">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">Evidence-based</p>
          <h1 className="mt-3 text-4xl font-bold flex items-center gap-3">
            <BookOpen className="h-9 w-9" /> Learning Center
          </h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            Curated articles on longevity science and related pathways. Source coverage and review depth can vary by article, so verify important claims against cited literature.
          </p>
        </div>

        {/* Topic filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {Object.entries(topicCounts).map(([topic, count]) => (
            <Badge key={topic} variant="outline" className="text-sm py-1 px-3">
              {topicLabel[topic] ?? topic} ({count})
            </Badge>
          ))}
        </div>

        {articles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No articles published yet. Content is being prepared by the science team.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <Link key={article.id} href={`/learn/${article.slug}`}>
                <Card className="transition-colors hover:border-teal-700 cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">{topicLabel[article.topic] ?? article.topic}</Badge>
                      {article.publishedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(article.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-lg">{article.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{article.summary}</p>
                    {article.author.name && (
                      <p className="text-xs text-muted-foreground mt-2">By {article.author.name}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* External resources — curated free / open-access courses, lectures, registries */}
        <section className="mt-12">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <ExternalLink className="h-6 w-6" /> Recommended external resources
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Free or audit-only longevity-science material from universities and public registries. We don&apos;t
              receive referral fees from any of these and we don&apos;t guarantee continued availability — verify the
              URL before relying on it.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {externalResources.map((res) => (
              <a
                key={res.url}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-gray-800 bg-gray-950 p-4 transition-colors hover:border-teal-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-snug">{res.title}</p>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                </div>
                <p className="mt-1 text-xs text-gray-400">{res.provider}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">{res.format}</Badge>
                  <Badge variant="secondary" className="text-xs">{res.cost}</Badge>
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
