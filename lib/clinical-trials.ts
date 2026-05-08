import { executeWithCircuitBreaker } from "@/lib/circuit-breaker"

const CT_GOV_BASE = "https://clinicaltrials.gov/api/v2"
const CB_DEPENDENCY = "clinicaltrials-api"

type ClinicalTrialStudy = {
  nctId: string
  title: string
  status: string
  startDate: string | null
  conditions: string[]
  url: string
}

export async function searchClinicalTrials(
  query: string,
  maxResults: number,
): Promise<ClinicalTrialStudy[]> {
  return executeWithCircuitBreaker({
    dependency: CB_DEPENDENCY,
    execute: async () => {
      const params = new URLSearchParams({
        "query.term": query,
        pageSize: String(Math.min(maxResults, 50)),
        format: "json",
      })

      const response = await fetch(`${CT_GOV_BASE}/studies?${params.toString()}`, {
        next: { revalidate: 600 },
      })

      if (!response.ok) {
        throw new Error(`ClinicalTrials.gov search failed: ${response.status}`)
      }

      const data = await response.json()
      const studies: unknown[] = data?.studies ?? []

      return studies.map((study: unknown) => {
        const s = study as Record<string, unknown>
        const protocolSection = s.protocolSection as Record<string, unknown> | undefined
        const identification = protocolSection?.identificationModule as Record<string, unknown> | undefined
        const status = protocolSection?.statusModule as Record<string, unknown> | undefined
        const conditions = protocolSection?.conditionsModule as Record<string, unknown> | undefined

        const nctId = (identification?.nctId as string) ?? ""

        return {
          nctId,
          title: (identification?.briefTitle as string) ?? (identification?.officialTitle as string) ?? "",
          status: (status?.overallStatus as string) ?? "Unknown",
          startDate: (status?.startDateStruct as Record<string, unknown>)?.date as string | null ?? null,
          conditions: (conditions?.conditions as string[]) ?? [],
          url: `https://clinicaltrials.gov/study/${nctId}`,
        }
      })
    },
  })
}
