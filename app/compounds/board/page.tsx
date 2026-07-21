// CI-008: reads required data from the database — force dynamic rendering so
// the DB is queried at request time, never at build (a DB failure can then
// never be swallowed into a statically-generated page).
export const dynamic = "force-dynamic"
import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { CompoundBoardClient } from "@/components/three/compound-board-client"

export const metadata: Metadata = {
  title: "Compound Board — Biozephyra",
  description: "An interactive 3D board — drag compounds around by touch or mouse.",
}

export default async function CompoundBoardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  const compounds = await db.compound.findMany({
    orderBy: { name: "asc" },
    take: 16,
    select: { id: true, name: true, category: true },
  })

  return (
    <AppShell>
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Compound Board</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            An interactive 3D workspace. Pick up any compound and move it around the
            board — by touch on a tablet or smart screen, or with a mouse. Rotate the
            whole board, zoom in, and tap a compound to open it.
          </p>
        </div>

        {compounds.length === 0 ? (
          <p className="text-muted-foreground">No compounds in the catalog yet.</p>
        ) : (
          <CompoundBoardClient compounds={compounds} />
        )}
      </main>
    </AppShell>
  )
}
