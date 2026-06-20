import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { AppShell } from "@/components/app-shell"
import { authOptions } from "@/lib/auth"
import { MarketplacePage } from "@/modules/marketplace/pages"
import { getMarketplaceWorkspaceSnapshot } from "@/modules/marketplace/services"

export default async function ScientistSponsorMarketplacePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/sign-in")
  }

  const initialSnapshot = await getMarketplaceWorkspaceSnapshot({
    userId: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    globalRole: String(session.user.role ?? "MEMBER"),
  })

  return (
    <AppShell>
      <div className="min-h-full bg-[linear-gradient(180deg,_#020617,_#0f172a_30%,_#111827_100%)] text-white">
      <main className="mx-auto max-w-7xl px-4 py-10">
        <MarketplacePage initialSnapshot={initialSnapshot} />
      </main>
    </div>
    </AppShell>
  )
}

