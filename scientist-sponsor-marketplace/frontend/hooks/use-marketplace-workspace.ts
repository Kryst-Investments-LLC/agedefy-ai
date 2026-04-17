"use client"

import { useMarketplaceContext } from "@/scientist-sponsor-marketplace/frontend/context/marketplace-context"

export function useMarketplaceWorkspace() {
  return useMarketplaceContext()
}
