import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function PathwaysPage() {
  const pathways = await db.pathway.findMany({
    include: {
      _count: { select: { compounds: true } },
    },
    orderBy: { name: "asc" },
  })

  const categories = [...new Set(pathways.map((p) => p.category))].sort()

  return (
    <AppShell>
      <div className="min-h-full bg-background">
      <main className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">Longevity Pathways</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Biological pathways relevant to aging, metabolism, and longevity — with the compounds known to affect them.
        </p>

        {pathways.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>No pathways in the knowledge graph yet. Run the seed to populate.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map((category) => {
              const group = pathways.filter((p) => p.category === category)
              return (
                <section key={category}>
                  <h2 className="text-lg font-semibold text-teal-600 dark:text-teal-400 mb-4 capitalize">
                    {category}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.map((pathway) => (
                      <Link
                        key={pathway.id}
                        href={`/pathways/${pathway.id}`}
                        className="block bg-card/50 border border-border rounded-lg p-5 hover:border-teal-600 transition-colors"
                      >
                        <h3 className="text-foreground font-medium mb-1">{pathway.name}</h3>
                        {pathway.description && (
                          <p className="text-muted-foreground text-xs line-clamp-2 mb-3">
                            {pathway.description}
                          </p>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {pathway._count.compounds} compound{pathway._count.compounds !== 1 ? "s" : ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
    </AppShell>
  )
}
