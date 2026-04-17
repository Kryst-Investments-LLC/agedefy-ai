import type { MarketplacePayoutBlockerSeverity, MarketplacePayoutRejectionCategory } from "@/scientist-sponsor-marketplace/shared/types/entities"

export type AdminMarketplaceQueueCategoryFilter = MarketplacePayoutRejectionCategory | "all"
export type AdminMarketplaceQueueSeverityFilter = MarketplacePayoutBlockerSeverity | "all"
export type SearchParamReader = { get(name: string): string | null }

export const adminMarketplaceQueueCategoryQueryParam = "mc"
export const adminMarketplaceQueueSeverityQueryParam = "ms"
export const adminMarketplaceQueueLegacyCategoryQueryParam = "marketplaceCategory"
export const adminMarketplaceQueueLegacySeverityQueryParam = "marketplaceSeverity"

export function isAdminMarketplaceQueueCategoryFilter(value: string | null): value is AdminMarketplaceQueueCategoryFilter {
  return value === "all" || value === "evidence_gap" || value === "compliance" || value === "milestone_scope" || value === "documentation" || value === "other"
}

export function isAdminMarketplaceQueueSeverityFilter(value: string | null): value is AdminMarketplaceQueueSeverityFilter {
  return value === "all" || value === "low" || value === "medium" || value === "high" || value === "critical"
}

export function readAdminMarketplaceQueueCategoryFilter(params: SearchParamReader) {
  const compactValue = params.get(adminMarketplaceQueueCategoryQueryParam)
  if (isAdminMarketplaceQueueCategoryFilter(compactValue)) {
    return compactValue
  }

  const legacyValue = params.get(adminMarketplaceQueueLegacyCategoryQueryParam)
  return isAdminMarketplaceQueueCategoryFilter(legacyValue) ? legacyValue : "all"
}

export function readAdminMarketplaceQueueSeverityFilter(params: SearchParamReader) {
  const compactValue = params.get(adminMarketplaceQueueSeverityQueryParam)
  if (isAdminMarketplaceQueueSeverityFilter(compactValue)) {
    return compactValue
  }

  const legacyValue = params.get(adminMarketplaceQueueLegacySeverityQueryParam)
  return isAdminMarketplaceQueueSeverityFilter(legacyValue) ? legacyValue : "all"
}

export function readAdminMarketplaceQueueFilters(params: SearchParamReader) {
  return {
    categoryFilter: readAdminMarketplaceQueueCategoryFilter(params),
    severityFilter: readAdminMarketplaceQueueSeverityFilter(params),
  }
}

export function applyAdminMarketplaceQueueFilters(
  sourceParams: URLSearchParams,
  filters: {
    categoryFilter: AdminMarketplaceQueueCategoryFilter
    severityFilter: AdminMarketplaceQueueSeverityFilter
  },
) {
  const params = new URLSearchParams(sourceParams.toString())

  if (filters.categoryFilter === "all") {
    params.delete(adminMarketplaceQueueCategoryQueryParam)
  } else {
    params.set(adminMarketplaceQueueCategoryQueryParam, filters.categoryFilter)
  }

  if (filters.severityFilter === "all") {
    params.delete(adminMarketplaceQueueSeverityQueryParam)
  } else {
    params.set(adminMarketplaceQueueSeverityQueryParam, filters.severityFilter)
  }

  params.delete(adminMarketplaceQueueLegacyCategoryQueryParam)
  params.delete(adminMarketplaceQueueLegacySeverityQueryParam)

  return params
}