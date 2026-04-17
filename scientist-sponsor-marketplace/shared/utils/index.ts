import type { MarketplaceRole } from "@/scientist-sponsor-marketplace/shared/types/entities"

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export function computeWeightedAverage(weights: Record<string, number>, values: Record<string, number>) {
  const entries = Object.entries(weights)
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0)

  if (!totalWeight) {
    return 0
  }

  const weighted = entries.reduce((sum, [key, weight]) => sum + (values[key] ?? 0) * weight, 0)
  return clamp(weighted / totalWeight)
}

export function serializeForJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function formatCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function sumBy<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((sum, item) => sum + pick(item), 0)
}

export function getAssumableMarketplaceRoles(globalRole?: string | null): MarketplaceRole[] {
  if (globalRole === "ADMIN") {
    return ["scientist", "sponsor", "reviewer", "admin"]
  }

  if (globalRole === "RESEARCHER") {
    return ["scientist", "sponsor", "reviewer"]
  }

  return ["scientist", "sponsor"]
}
