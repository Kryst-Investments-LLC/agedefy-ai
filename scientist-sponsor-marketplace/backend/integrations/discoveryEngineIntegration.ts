import { clamp } from "@/scientist-sponsor-marketplace/shared/utils"

export const discoveryEngineIntegration = {
  deriveMetadata(summary: string, category: string) {
    const tokens = summary.toLowerCase().split(/\W+/).filter(Boolean)
    const novelty = clamp(new Set(tokens).size / 40)
    const translationalSignal = clamp(tokens.filter((token) => ["clinical", "trial", "patient", "biomarker"].includes(token)).length / 6)

    return {
      extractedKeywords: Array.from(new Set(tokens)).slice(0, 12),
      novelty,
      translationalSignal,
      categorySignal: category,
    }
  },
}
