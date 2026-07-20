// CI-008: reads required data from the database — force dynamic rendering so
// the DB is queried at request time, never at build (a DB failure can then
// never be swallowed into a statically-generated page).
export const dynamic = "force-dynamic"
import { notFound } from "next/navigation"
import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { db } from "@/lib/db"

type Props = {
  params: Promise<{ id: string }>
}

export default async function PathwayDetailPage({ params }: Props) {
  const { id } = await params

  const pathway = await db.pathway.findUnique({
    where: { id },
    include: {
      compounds: {
        include: {
          compound: {
            select: {
              id: true,
              name: true,
              category: true,
              mechanism: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!pathway) notFound()

  const effectGroups: Record<string, typeof pathway.compounds> = {}
  for (const cp of pathway.compounds) {
    const key = cp.effect
    if (!effectGroups[key]) effectGroups[key] = []
    effectGroups[key].push(cp)
  }

  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="max-w-4xl mx-auto px-4 py-12">
        <Link href="/pathways" className="text-teal-600 dark:text-teal-400 hover:underline text-sm mb-4 inline-block">
          ← All Pathways
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-2">{pathway.name}</h1>

        <span className="inline-block text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize mb-4">
          {pathway.category}
        </span>

        {pathway.description && (
          <p className="text-muted-foreground text-sm mb-8 max-w-2xl">{pathway.description}</p>
        )}

        {pathway.compounds.length === 0 ? (
          <p className="text-muted-foreground text-sm">No compounds linked to this pathway yet.</p>
        ) : (
          <div className="space-y-8">
            {Object.entries(effectGroups).map(([effect, compounds]) => (
              <section key={effect}>
                <h2 className="text-lg font-semibold text-foreground mb-3 capitalize">
                  {effect}s
                  <span className="text-muted-foreground text-sm font-normal ml-2">
                    ({compounds.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {compounds.map((cp) => (
                    <Link
                      key={cp.id}
                      href={`/compounds/${cp.compound.id}`}
                      className="bg-card/50 border border-border rounded-lg p-4 hover:border-teal-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-foreground font-medium">{cp.compound.name}</h3>
                        {cp.strength && (
                          <span className="text-xs text-muted-foreground capitalize">{cp.strength}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{cp.compound.category}</span>
                      {cp.compound.mechanism && (
                        <p className="text-muted-foreground text-xs mt-2 line-clamp-2">
                          {cp.compound.mechanism}
                        </p>
                      )}
                      {cp.evidence && (
                        <p className="text-muted-foreground text-xs mt-1 italic line-clamp-1">
                          {cp.evidence}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
    </AppShell>
  )
}
