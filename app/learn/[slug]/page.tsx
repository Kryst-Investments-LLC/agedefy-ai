// CI-008: reads required data from the database — force dynamic rendering so
// the DB is queried at request time, never at build (a DB failure can then
// never be swallowed into a statically-generated page).
export const dynamic = "force-dynamic"
import { notFound } from "next/navigation"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { db } from "@/lib/db"
import { ArrowLeft } from "lucide-react"

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

export default async function LearnArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const article = await db.learnArticle.findUnique({
    where: { slug },
    include: { author: { select: { name: true, role: true } } },
  })

  if (!article || !article.published) notFound()

  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10 text-foreground">
        <Link href="/learn">
          <Button variant="ghost" className="text-muted-foreground hover:text-white mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Learning Center
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="secondary">{topicLabel[article.topic] ?? article.topic}</Badge>
            {/* REMOVED: green "Reviewed" badge — no clinical review process is wired to this field.
                TODO: restore only when a real editorial/clinical review workflow populates it. */}
          </div>
          <h1 className="text-4xl font-bold leading-tight">{article.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{article.summary}</p>
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            {article.author.name && <span>By {article.author.name}</span>}
            {article.publishedAt && (
              <span>
                {new Date(article.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            )}
          </div>
        </div>

        {/* Article body rendered as markdown-like content */}
        <article className="prose prose-invert prose-teal max-w-none">
          {article.body.split("\n").map((line, i) => {
            if (line.startsWith("### ")) {
              return <h3 key={i} className="text-xl font-semibold mt-6 mb-2">{line.slice(4)}</h3>
            }
            if (line.startsWith("## ")) {
              return <h2 key={i} className="text-2xl font-bold mt-8 mb-3">{line.slice(3)}</h2>
            }
            if (line.startsWith("- **")) {
              const match = line.match(/^- \*\*(.+?)\*\*(.*)$/)
              if (match) {
                return <p key={i} className="ml-4 mb-1"><strong className="text-foreground">{match[1]}</strong>{match[2]}</p>
              }
            }
            if (line.startsWith("- ")) {
              return <p key={i} className="ml-4 mb-1 text-muted-foreground">• {line.slice(2)}</p>
            }
            if (/^\d+\. \*\*/.test(line)) {
              const match = line.match(/^\d+\. \*\*(.+?)\*\*(.*)$/)
              if (match) {
                return <p key={i} className="ml-4 mb-1"><strong className="text-foreground">{match[1]}</strong>{match[2]}</p>
              }
            }
            if (line.startsWith("**Key reference:**")) {
              return (
                <div key={i} className="mt-6 rounded-lg border border-border bg-background p-4">
                  <p className="text-sm text-muted-foreground">{line.replace(/\*\*/g, "")}</p>
                </div>
              )
            }
            if (line.trim() === "") {
              return <div key={i} className="h-2" />
            }
            return <p key={i} className="text-muted-foreground mb-2">{line.replace(/\*\*(.+?)\*\*/g, "$1")}</p>
          })}
        </article>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">
            This article is for educational purposes only and does not constitute medical advice. 
            Always consult a qualified healthcare provider before making changes to your health regimen.
          </p>
        </div>
      </main>
    </div>
    </AppShell>
  )
}
