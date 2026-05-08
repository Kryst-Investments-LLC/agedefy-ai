import Link from "next/link"
import { getServerSession } from "next-auth"

import { Navigation } from "@/components/navigation"
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
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-10 text-white">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">Research intelligence</p>
          <h1 className="mt-3 text-4xl font-bold">Research collections</h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            Ingest PubMed articles and clinical trial records into persistent collections.
            Use the dashboard to run new ingestions.
          </p>
        </div>

        {!session?.user?.id ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-8 text-center">
            <p className="text-gray-300">Sign in to view your research collections.</p>
            <Link href="/sign-in"><Button className="mt-4 bg-teal-600 hover:bg-teal-700">Sign in</Button></Link>
          </div>
        ) : collections.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-8 text-center">
            <p className="text-gray-300">No research collections yet.</p>
            <p className="mt-2 text-sm text-gray-500">Use the Enterprise Operations panel on the dashboard to ingest PubMed articles.</p>
            <Link href="/dashboard"><Button className="mt-4 bg-teal-600 hover:bg-teal-700">Open dashboard</Button></Link>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {collections.map((col) => (
                <div key={col.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
                  <p className="font-semibold">{col.name}</p>
                  {col.description ? <p className="mt-1 text-sm text-gray-400">{col.description}</p> : null}
                  <p className="mt-3 text-xs text-gray-500">{col._count.entries} entries · updated {new Date(col.updatedAt).toLocaleDateString()}</p>
                </div>
              ))}
            </section>

            <section className="mt-10">
              <h2 className="text-2xl font-semibold">Recent articles</h2>
              <div className="mt-4 space-y-3">
                {recentEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                    <p className="font-medium">{entry.title}</p>
                    <p className="mt-1 text-xs text-gray-400">{entry.authors ?? "Unknown authors"} · {entry.source.toLowerCase()}{entry.externalId ? ` · ${entry.externalId}` : ""}</p>
                    {entry.url ? <a href={entry.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-teal-400 hover:underline">Open source</a> : null}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
