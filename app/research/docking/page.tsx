import type { Metadata } from "next"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { Navigation } from "@/components/navigation"
import { authOptions } from "@/lib/auth"
import { DockingExplorer } from "@/components/discovery/docking-explorer"

export const metadata: Metadata = {
  title: "3D Protein Docking — Biozephyra",
  description: "Visualize receptor structures and docked ligand poses in 3D.",
}

const ALLOWED_ROLES = new Set(["RESEARCHER", "CLINICIAN", "ADMIN"])

export default async function DockingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect("/sign-in")

  // Discovery/chemistry tooling is researcher-scoped.
  const role = (session.user as { role?: string }).role
  if (!role || !ALLOWED_ROLES.has(role)) redirect("/dashboard")

  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">3D Protein Docking</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Load a receptor structure from the RCSB PDB and inspect its binding
            site in 3D — cartoon, surface, or stick. Optionally overlay a docked
            ligand pose by SMILES. Rotate, zoom, and switch representations.
          </p>
        </div>

        <DockingExplorer />

        <p className="text-[11px] text-muted-foreground">
          Structures are fetched from RCSB PDB and PubChem. Poses shown here are
          computational/illustrative and require experimental validation. Not medical advice.
        </p>
      </main>
    </>
  )
}
