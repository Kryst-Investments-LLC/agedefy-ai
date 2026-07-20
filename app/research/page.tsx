// CI-008: reads required data from the database — force dynamic rendering so
// the DB is queried at request time, never at build (a DB failure can then
// never be swallowed into a statically-generated page).
export const dynamic = "force-dynamic"
import Link from "next/link"
import { getServerSession } from "next-auth"

import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function ResearchPage() {
  const session = await getServerSession(authOptions)

  const collections = session?.user?.id
    ? await db.researchCollection.findMany({
        where: { userId: session.user.id },
        include: { _count: { select: { entries: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      })
    : []

  const recentEntries = session?.user?.id
    ? await db.researchEntry.findMany({
        where: { collection: { userId: session.user.id } },
        orderBy: { createdAt: "desc" },
        take: 12,
      })
    : []

  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="mx-auto max-w-5xl px-4 py-10 text-foreground">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">Research intelligence</p>
          <h1 className="mt-3 text-4xl font-bold">Research collections</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Ingest PubMed articles and clinical trial records into persistent collections.
            Use the dashboard to run new ingestions.
          </p>
        </div>

        {!session?.user?.id ? (
          <div className="rounded-2xl border border-border bg-background p-8 text-center">
            <p className="text-muted-foreground">Sign in to view your research collections.</p>
            <Link href="/sign-in"><Button className="mt-4 bg-teal-600 hover:bg-teal-700">Sign in</Button></Link>
          </div>
        ) : collections.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background p-8 text-center">
            <p className="text-muted-foreground">No research collections yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">Use the Enterprise Operations panel on the dashboard to ingest PubMed articles.</p>
            <Link href="/dashboard"><Button className="mt-4 bg-teal-600 hover:bg-teal-700">Open dashboard</Button></Link>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {collections.map((col) => (
                <div key={col.id} className="rounded-2xl border border-border bg-background p-5">
                  <p className="font-semibold">{col.name}</p>
                  {col.description ? <p className="mt-1 text-sm text-muted-foreground">{col.description}</p> : null}
                  <p className="mt-3 text-xs text-muted-foreground">{col._count.entries} entries · updated {new Date(col.updatedAt).toLocaleDateString()}</p>
                </div>
              ))}
            </section>

            <section className="mt-10">
              <h2 className="text-2xl font-semibold">Recent articles</h2>
              <div className="mt-4 space-y-3">
                {recentEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-border bg-background p-4">
                    <p className="font-medium">{entry.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{entry.authors ?? "Unknown authors"} · {entry.source.toLowerCase()}{entry.externalId ? ` · ${entry.externalId}` : ""}</p>
                    {entry.url ? <a href={entry.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-teal-600 dark:text-teal-400 hover:underline">Open source</a> : null}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
    </AppShell>
  )
}
