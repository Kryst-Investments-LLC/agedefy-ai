"use client"

import { Button } from "@/components/ui/button"
import { RoleBadge } from "@/scientist-sponsor-marketplace/frontend/ui/role-badge"
import { StatChip } from "@/scientist-sponsor-marketplace/frontend/ui/stat-chip"
import { useMarketplaceWorkspace } from "@/scientist-sponsor-marketplace/frontend/hooks/use-marketplace-workspace"
import { formatCurrency, getAssumableMarketplaceRoles } from "@/scientist-sponsor-marketplace/shared/utils"

export function MarketplaceHeader() {
  const { snapshot, actingAs, setActingAs, isPending } = useMarketplaceWorkspace()
  const visibleRoles = getAssumableMarketplaceRoles(snapshot.actor.globalRole)

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.22),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.18),_transparent_34%),linear-gradient(135deg,_#111827,_#0f172a_55%,_#020617)] p-8 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)]" />
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-200/80">Scientist Sponsor Marketplace</p>
          <div className="mt-4 flex items-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tight">Discovery capital formation, diligence, and deal execution.</h1>
            <RoleBadge role={actingAs} />
          </div>
          <p className="mt-4 text-base text-white/70">
            Publish translational discoveries, rank sponsor fit, negotiate inside controlled deal rooms, and settle funding with audit-ready compliance records.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {visibleRoles.map((role) => (
              <Button
                key={role}
                variant={role === actingAs ? "default" : "outline"}
                className={role === actingAs ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "border-white/15 bg-white/5 text-white hover:bg-white/10"}
                onClick={() => void setActingAs(role)}
                disabled={isPending}
              >
                View as {role}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-2 xl:w-[34rem]">
          <StatChip label="Published Discoveries" value={snapshot.metrics.publishedDiscoveries} />
          <StatChip label="Open Deal Rooms" value={snapshot.metrics.openDealRooms} />
          <StatChip label="Funded Volume" value={formatCurrency(snapshot.metrics.fundedVolumeCents)} />
          <StatChip label="Unread Notifications" value={snapshot.metrics.unreadNotifications} />
        </div>
      </div>
    </section>
  )
}
