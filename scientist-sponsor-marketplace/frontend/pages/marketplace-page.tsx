"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MarketplaceProvider } from "@/scientist-sponsor-marketplace/frontend/context/marketplace-context"
import { DealRoomPanel } from "@/scientist-sponsor-marketplace/frontend/components/deal-room-panel"
import { MarketplaceHeader } from "@/scientist-sponsor-marketplace/frontend/components/marketplace-header"
import { ScientistDashboard } from "@/scientist-sponsor-marketplace/frontend/components/scientist-dashboard"
import { SponsorDashboard } from "@/scientist-sponsor-marketplace/frontend/components/sponsor-dashboard"
import type { MarketplaceWorkspaceSnapshot } from "@/scientist-sponsor-marketplace/shared/types/entities"

export function MarketplacePage({ initialSnapshot }: { initialSnapshot: MarketplaceWorkspaceSnapshot }) {
  return (
    <MarketplaceProvider initialSnapshot={initialSnapshot}>
      <div className="space-y-8">
        <MarketplaceHeader />
        <Tabs defaultValue="scientist" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-slate-900/90 p-1 text-white">
            <TabsTrigger value="scientist">Scientist Dashboard</TabsTrigger>
            <TabsTrigger value="sponsor">Sponsor Dashboard</TabsTrigger>
            <TabsTrigger value="deal">Deal Room</TabsTrigger>
          </TabsList>
          <TabsContent value="scientist">
            <ScientistDashboard />
          </TabsContent>
          <TabsContent value="sponsor">
            <SponsorDashboard />
          </TabsContent>
          <TabsContent value="deal">
            <DealRoomPanel />
          </TabsContent>
        </Tabs>
      </div>
    </MarketplaceProvider>
  )
}
