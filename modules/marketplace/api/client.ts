import type { MarketplaceEntityName, MarketplaceRole, MarketplaceWorkspaceSnapshot, RankedMatch } from "@/modules/marketplace/types"

import { marketplaceModuleEndpoints, marketplaceModuleRouteRegistry } from "@/modules/marketplace/api/endpoints"

type WorkflowName = "scientist" | "sponsor" | "deal"

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? "Marketplace API request failed")
  }

  return body as T
}

function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value))
    }
  }

  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export function createMarketplaceApiClient(config?: { baseUrl?: string; fetchImpl?: typeof fetch }) {
  const baseUrl = config?.baseUrl ?? ""
  const fetchImpl = config?.fetchImpl ?? fetch

  return {
    async getWorkspace(actingAsRole?: MarketplaceRole) {
      return parseJson<MarketplaceWorkspaceSnapshot>(
        await fetchImpl(`${baseUrl}${withQuery(marketplaceModuleEndpoints.workspace, { actingAsRole })}`, { cache: "no-store" }),
      )
    },

    async getMatches(filters?: {
      category?: string
      maxCostCents?: number
      minImpactScore?: number
    }) {
      return parseJson<RankedMatch[]>(
        await fetchImpl(`${baseUrl}${withQuery(marketplaceModuleEndpoints.matches, filters ?? {})}`, { cache: "no-store" }),
      )
    },

    async listEntity<TRecord>(entity: MarketplaceEntityName, actingAsRole?: MarketplaceRole) {
      return parseJson<{ entity: string; records: TRecord[]; actingAs: MarketplaceRole }>(
        await fetchImpl(`${baseUrl}${withQuery(marketplaceModuleRouteRegistry[entity], { actingAsRole })}`, { cache: "no-store" }),
      )
    },

    async getEntity<TRecord>(entity: MarketplaceEntityName, id: string, actingAsRole?: MarketplaceRole) {
      return parseJson<TRecord>(
        await fetchImpl(`${baseUrl}${withQuery(`${marketplaceModuleRouteRegistry[entity]}/${id}`, { actingAsRole })}`, { cache: "no-store" }),
      )
    },

    async createEntity<TRecord>(entity: MarketplaceEntityName, payload: Record<string, unknown>, actingAsRole?: MarketplaceRole) {
      return parseJson<TRecord>(
        await fetchImpl(`${baseUrl}${marketplaceModuleRouteRegistry[entity]}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, actingAsRole }),
        }),
      )
    },

    async updateEntity<TRecord>(entity: MarketplaceEntityName, id: string, payload: Record<string, unknown>, actingAsRole?: MarketplaceRole) {
      return parseJson<TRecord>(
        await fetchImpl(`${baseUrl}${marketplaceModuleRouteRegistry[entity]}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, actingAsRole }),
        }),
      )
    },

    async deleteEntity<TRecord>(entity: MarketplaceEntityName, id: string, actingAsRole?: MarketplaceRole) {
      return parseJson<TRecord>(
        await fetchImpl(`${baseUrl}${withQuery(`${marketplaceModuleRouteRegistry[entity]}/${id}`, { actingAsRole })}`, {
          method: "DELETE",
        }),
      )
    },

    async runWorkflow<TRecord>(workflow: WorkflowName, payload: Record<string, unknown>, actingAsRole?: MarketplaceRole) {
      return parseJson<TRecord>(
        await fetchImpl(`${baseUrl}${marketplaceModuleEndpoints.workflows[workflow]}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, actingAsRole }),
        }),
      )
    },
  }
}

export const marketplaceApiClient = createMarketplaceApiClient()
