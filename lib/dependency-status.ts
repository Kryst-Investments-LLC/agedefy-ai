import { getCircuitStates } from "@/lib/circuit-breaker"

// Groups the circuit-breaker dependencies into user-meaningful categories for the
// honest degraded-state UI (INT-008). A category is "degraded" when any of its
// dependencies' breakers are open. Add a dependency here when it gains a breaker.
export type DependencyCategory = "ai" | "payments" | "research-data"

const CATEGORY_DEPENDENCIES: Record<DependencyCategory, { label: string; dependencies: string[] }> = {
  ai: {
    label: "AI features",
    dependencies: ["openai-api", "anthropic-api", "grok-api"],
  },
  payments: {
    label: "Payments",
    dependencies: ["stripe-billing-write", "stripe-marketplace-confirmation"],
  },
  "research-data": {
    label: "Compound & structure data",
    dependencies: ["chembl-api", "pubchem-api", "rcsb-files", "rcsb-metadata", "aeonforge-discovery"],
  },
}

export interface CategoryStatus {
  category: DependencyCategory
  label: string
  available: boolean
}

export interface DependencyStatus {
  degraded: boolean
  categories: CategoryStatus[]
  degradedLabels: string[]
}

export async function getDependencyStatus(): Promise<DependencyStatus> {
  const allDeps = Object.values(CATEGORY_DEPENDENCIES).flatMap((c) => c.dependencies)
  const states = await getCircuitStates(allDeps)
  const availableByDep = new Map(states.map((s) => [s.dependency, s.available]))

  const categories: CategoryStatus[] = (
    Object.entries(CATEGORY_DEPENDENCIES) as [DependencyCategory, { label: string; dependencies: string[] }][]
  ).map(([category, { label, dependencies }]) => ({
    category,
    label,
    // Degraded only when a dependency's breaker is explicitly OPEN (available === false).
    available: dependencies.every((d) => availableByDep.get(d) !== false),
  }))

  const degradedLabels = categories.filter((c) => !c.available).map((c) => c.label)
  return { degraded: degradedLabels.length > 0, categories, degradedLabels }
}
