import type { Metadata } from "next"

import { AppShell } from "@/components/app-shell"
import { WearableConnectCard, WearableDataFeed } from "@/components/wearable-connect"

export const metadata: Metadata = {
  title: "Wearable Devices | Biozephyra",
  description: "Connect and manage your wearable health devices",
}

export default function WearablesPage() {
  return (
    <AppShell pageTitle="Wearables">
      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wearable Devices</h1>
          <p className="text-muted-foreground mt-1">
            Connect fitness trackers and health wearables to automatically sync your
            activity, sleep, and biometric data.
          </p>
        </div>

        <WearableConnectCard />
        <WearableDataFeed />
      </div>
    </AppShell>
  )
}
