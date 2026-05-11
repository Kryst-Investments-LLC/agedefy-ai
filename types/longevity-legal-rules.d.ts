declare module "@longevity-standards/legal-rules" {
  export interface JurisdictionRulePack {
    jurisdiction: { code: string; name?: string; region?: string }
    last_reviewed?: string
    rules: Array<{
      id: string
      description?: string
      severity?: "critical" | "high" | "medium" | "low"
      category?: string
      citations?: { title?: string; url?: string }[]
      [k: string]: unknown
    }>
    [k: string]: unknown
  }
  export function listJurisdictions(): string[]
  export function loadJurisdiction(code: string): Promise<JurisdictionRulePack>
  export function loadAll(): Promise<Record<string, JurisdictionRulePack>>
  export function getSchema(): Record<string, unknown>
}
