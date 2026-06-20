import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  classifyBiomarkers,
  summarizeByOrgan,
  type BiomarkerInput,
} from "@/lib/biomarkers/organ-mapping"
import { BodyInsightsClient } from "@/components/three/body-insights-client"

export const metadata: Metadata = {
  title: "3D Body — Biozephyra",
  description: "An interactive 3D view of your biomarkers mapped to organ systems.",
}

export default async function BodyPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  // Latest measurement per biomarker name for this user.
  const rows = await db.biomarker.findMany({
    where: { userId: session.user.id },
    orderBy: { measuredAt: "desc" },
    select: { name: true, value: true, unit: true, target: true, measuredAt: true },
    take: 200,
  })

  const latestByName = new Map<string, BiomarkerInput>()
  for (const r of rows) {
    if (!latestByName.has(r.name)) {
      latestByName.set(r.name, { name: r.name, value: r.value, unit: r.unit, target: r.target })
    }
  }

  const classified = classifyBiomarkers([...latestByName.values()])
  const organs = summarizeByOrgan(classified)

  return (
    <AppShell>
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Your 3D Body</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Your biomarkers mapped onto organ systems and rendered in 3D. Rotate the
            body, click an organ to inspect its markers, or switch to the 3D dashboard
            to compare everything at once.
          </p>
        </div>

        <BodyInsightsClient biomarkers={classified} organs={organs} />
      </main>
    </AppShell>
  )
}
