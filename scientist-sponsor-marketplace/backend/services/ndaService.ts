import { DEFAULT_NDA_TERMS } from "@/scientist-sponsor-marketplace/shared/constants"
import type { NdaPackage } from "@/scientist-sponsor-marketplace/shared/types/entities"

export const ndaService = {
  generatePackage(discoveryTitle: string): NdaPackage {
    return {
      title: `${discoveryTitle} Mutual Evaluation NDA`,
      terms: DEFAULT_NDA_TERMS,
      version: "v1",
      generatedAt: new Date().toISOString(),
    }
  },

  acceptPackage() {
    return {
      acceptedAt: new Date().toISOString(),
      status: "accepted" as const,
    }
  },
}
