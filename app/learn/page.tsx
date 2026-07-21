import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { BookOpen } from "lucide-react"

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
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="mx-auto max-w-4xl px-4 py-10 text-foreground">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">Evidence-based</p>
          <h1 className="mt-3 text-4xl font-bold flex items-center gap-3">
            <BookOpen className="h-9 w-9" /> Learning Center
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
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
      </main>
    </div>
    </AppShell>
  )
}
