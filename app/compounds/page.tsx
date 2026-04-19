import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * Public compounds index — lets visitors browse and click through to compound
 * detail pages without signing in. Compound detail (`/compounds/[id]`) is not
 * gated by middleware, but until now the only way to discover IDs was via the
 * Mixer search box, which made the detail pages feel auth-walled.
 *
 * Server-rendered list of the first 60 compounds, ordered by name. Client-side
 * filtering would require a `"use client"` boundary; we keep this simple and
 * defer to the existing `/mixer` search for queries.
 */
export default async function CompoundsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  // SQLite (the dev DB) does not support Prisma's `mode: "insensitive"`.
  // SQLite's LIKE is case-insensitive for ASCII by default, so a plain
  // `contains` matches "Resveratrol" when the user types "resveratrol".
  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { aliases: { contains: q } },
        ],
      }
    : undefined

  const compounds = await db.compound.findMany({
    where,
    take: 60,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      mechanism: true,
    },
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-3xl font-bold mb-2">Compounds</h1>
        <p className="text-muted-foreground mb-6">
          Browse the longevity compound knowledge graph. Click any entry for the
          full detail page including 3D molecular structure, pathway targets,
          interactions, and study links. No sign-in required.
        </p>

        <form className="mb-6">
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or alias..."
            className="max-w-md"
          />
        </form>

        {compounds.length === 0 ? (
          <p className="text-muted-foreground">
            No compounds found{q ? ` for "${q}"` : ""}. Seed the database with{" "}
            <code className="rounded bg-muted px-1 py-0.5">pnpm db:seed</code>.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {compounds.map((c) => (
              <Link key={c.id} href={`/compounds/${c.id}`}>
                <Card className="h-full transition hover:border-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="truncate">{c.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {c.category}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  {c.mechanism && (
                    <CardContent>
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {c.mechanism}
                      </p>
                    </CardContent>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
