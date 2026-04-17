import { describe, expect, it } from "vitest"

import {
  adminMarketplaceQueueCategoryQueryParam,
  adminMarketplaceQueueSeverityQueryParam,
  applyAdminMarketplaceQueueFilters,
  readAdminMarketplaceQueueFilters,
} from "@/lib/admin-marketplace-queue-filters"

describe("admin marketplace queue filter URLs", () => {
  it("reads legacy filter params and normalizes them to compact aliases", () => {
    const legacyParams = new URLSearchParams("marketplaceCategory=compliance&marketplaceSeverity=critical&tab=marketplace")

    const filters = readAdminMarketplaceQueueFilters(legacyParams)
    const normalizedParams = applyAdminMarketplaceQueueFilters(legacyParams, filters)

    expect(filters).toEqual({
      categoryFilter: "compliance",
      severityFilter: "critical",
    })
    expect(normalizedParams.get(adminMarketplaceQueueCategoryQueryParam)).toBe("compliance")
    expect(normalizedParams.get(adminMarketplaceQueueSeverityQueryParam)).toBe("critical")
    expect(normalizedParams.get("marketplaceCategory")).toBeNull()
    expect(normalizedParams.get("marketplaceSeverity")).toBeNull()
    expect(normalizedParams.get("tab")).toBe("marketplace")
  })

  it("prefers compact aliases when both legacy and compact params are present", () => {
    const mixedParams = new URLSearchParams("mc=documentation&ms=high&marketplaceCategory=compliance&marketplaceSeverity=critical")

    expect(readAdminMarketplaceQueueFilters(mixedParams)).toEqual({
      categoryFilter: "documentation",
      severityFilter: "high",
    })
  })
})