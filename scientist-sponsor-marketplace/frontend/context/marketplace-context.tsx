"use client"

import { createContext, useContext, useState, useTransition } from "react"

import type { MarketplaceRole, MarketplaceWorkspaceSnapshot } from "@/scientist-sponsor-marketplace/shared/types/entities"

type MarketplaceContextValue = {
  snapshot: MarketplaceWorkspaceSnapshot
  actingAs: MarketplaceRole
  setActingAs: (role: MarketplaceRole) => Promise<void>
  refresh: () => Promise<void>
  isPending: boolean
  setSnapshot: React.Dispatch<React.SetStateAction<MarketplaceWorkspaceSnapshot>>
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null)

async function requestSnapshot(role: MarketplaceRole) {
  const response = await fetch(`/api/scientist-sponsor-marketplace/workspace?actingAsRole=${role}`, { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Unable to refresh workspace")
  }

  return (await response.json()) as MarketplaceWorkspaceSnapshot
}

export function MarketplaceProvider({ initialSnapshot, children }: { initialSnapshot: MarketplaceWorkspaceSnapshot; children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [actingAs, setActingAsState] = useState<MarketplaceRole>(initialSnapshot.actor.actingAs)
  const [isPending, startTransition] = useTransition()

  const load = async (role: MarketplaceRole) => {
    const next = await requestSnapshot(role)
    setSnapshot(next)
    setActingAsState(role)
  }

  const refresh = async () => {
    startTransition(() => {
      void load(actingAs)
    })
  }

  const setActingAs = async (role: MarketplaceRole) => {
    startTransition(() => {
      void load(role)
    })
  }

  return (
    <MarketplaceContext.Provider value={{ snapshot, actingAs, setActingAs, refresh, isPending, setSnapshot }}>
      {children}
    </MarketplaceContext.Provider>
  )
}

export function useMarketplaceContext() {
  const context = useContext(MarketplaceContext)
  if (!context) {
    throw new Error("useMarketplaceContext must be used within MarketplaceProvider")
  }

  return context
}
