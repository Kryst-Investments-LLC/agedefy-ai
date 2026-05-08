import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const workspaceRoot = path.resolve(__dirname, "..")

function read(relativePath: string) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8")
}

describe("modules/marketplace components namespace", () => {
  it("exports the standalone marketplace UI surfaces from the components barrel", () => {
    const source = read("modules/marketplace/components/index.ts")

    expect(source).toContain('export * from "@/modules/marketplace/components/deal-room-ui"')
    expect(source).toContain('export * from "@/modules/marketplace/components/discovery-browser"')
    expect(source).toContain('export * from "@/modules/marketplace/components/funding-request-ui"')
    expect(source).toContain('export * from "@/modules/marketplace/components/marketplace-header"')
    expect(source).toContain('export * from "@/modules/marketplace/components/match-results-ui"')
    expect(source).toContain('export * from "@/modules/marketplace/components/messaging-ui"')
    expect(source).toContain('export * from "@/modules/marketplace/components/scientist-dashboard"')
    expect(source).toContain('export * from "@/modules/marketplace/components/sponsor-dashboard"')
  })

  it("makes the module namespace the canonical app integration point", () => {
    const primaryRoute = read("app/scientist-sponsor-marketplace/page.tsx")
    const aliasRoute = read("app/scientist-sponsor/page.tsx")

    expect(primaryRoute).toContain('import { MarketplacePage } from "@/modules/marketplace/pages"')
    expect(primaryRoute).toContain('import { getMarketplaceWorkspaceSnapshot } from "@/modules/marketplace/services"')
    expect(aliasRoute).toContain('export { default } from "@/app/scientist-sponsor-marketplace/page"')
  })
})