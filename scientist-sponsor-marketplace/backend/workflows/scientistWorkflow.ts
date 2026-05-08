import { discoveryEngineIntegration } from "@/scientist-sponsor-marketplace/backend/integrations/discoveryEngineIntegration"
import { protocolEngineIntegration } from "@/scientist-sponsor-marketplace/backend/integrations/protocolEngineIntegration"
import { logMarketplaceAuditEvent } from "@/scientist-sponsor-marketplace/backend/services/auditService"
import { complianceService } from "@/scientist-sponsor-marketplace/backend/services/complianceService"
import { appendDiscoveryEvidence, buildDiscoverySlug, discoveryService } from "@/scientist-sponsor-marketplace/backend/services/discoveryService"
import { fundingRequestService } from "@/scientist-sponsor-marketplace/backend/services/fundingRequestService"
import { toJsonValue } from "@/scientist-sponsor-marketplace/backend/models/json"

export const scientistWorkflow = {
  async createDiscovery(input: {
    scientistId: string
    title: string
    category: string
    summary: string
    developmentStage: string
    scientificImpactScore: number
    commercialReadiness: number
    fundingGoalCents: number
    currency?: string
    evidenceSummary?: string | null
  }) {
    const metadata = discoveryEngineIntegration.deriveMetadata(input.summary, input.category)
    const slug = await buildDiscoverySlug(input.title)
    const discovery = await discoveryService.create({
      scientistId: input.scientistId,
      title: input.title,
      slug,
      category: input.category,
      summary: input.summary,
      developmentStage: input.developmentStage,
      scientificImpactScore: input.scientificImpactScore,
      commercialReadiness: input.commercialReadiness,
      fundingGoalCents: input.fundingGoalCents,
      currency: input.currency ?? "USD",
      evidenceSummary: input.evidenceSummary ?? null,
      evidenceLinks: toJsonValue([]),
      metadata: toJsonValue(metadata),
    })

    await logMarketplaceAuditEvent({
      actorRole: "scientist",
      action: "discovery.created",
      entityType: "Discovery",
      entityId: (discovery as { id: string }).id,
      details: { title: input.title },
    })

    return discovery
  },

  async uploadEvidence(input: { discoveryId: string; evidence: { label: string; url: string; evidenceType?: string } }) {
    const discovery = await appendDiscoveryEvidence(input.discoveryId, input.evidence)

    await logMarketplaceAuditEvent({
      actorRole: "scientist",
      action: "discovery.evidence_uploaded",
      entityType: "Discovery",
      entityId: input.discoveryId,
      details: input.evidence,
    })

    return discovery
  },

  async setFundingNeeds(input: {
    discoveryId: string
    scientistId: string
    requestedAmountCents: number
    useOfFunds: string
    currency?: string
    timelineMonths: number
  }) {
    const milestones = protocolEngineIntegration.suggestMilestones(input.useOfFunds)
    const fundingRequest = await fundingRequestService.create({
      discoveryId: input.discoveryId,
      scientistId: input.scientistId,
      requestedAmountCents: input.requestedAmountCents,
      currency: input.currency ?? "USD",
      useOfFunds: input.useOfFunds,
      timelineMonths: input.timelineMonths,
      milestonePlan: toJsonValue(milestones),
      evidenceUploads: toJsonValue([]),
    })

    await logMarketplaceAuditEvent({
      actorRole: "scientist",
      action: "funding_request.created",
      entityType: "FundingRequest",
      entityId: (fundingRequest as { id: string }).id,
      details: { requestedAmountCents: input.requestedAmountCents },
    })

    return fundingRequest
  },

  async publishToMarketplace(input: { discovery: any; fundingRequest: any }) {
    const assessment = complianceService.evaluateDiscovery(input.discovery, input.fundingRequest)

    if (!assessment.isCompliant) {
      return { published: false, assessment }
    }

    const [discovery, fundingRequest] = await Promise.all([
      discoveryService.update(input.discovery.id, {
        status: "PUBLISHED",
        publishedAt: new Date().toISOString(),
      }),
      input.fundingRequest
        ? fundingRequestService.update(input.fundingRequest.id, {
            status: "OPEN",
            publishedAt: new Date().toISOString(),
          })
        : Promise.resolve(null),
    ])

    await logMarketplaceAuditEvent({
      actorRole: "scientist",
      action: "discovery.published",
      entityType: "Discovery",
      entityId: input.discovery.id,
      details: { assessment },
    })

    return { published: true, assessment, discovery, fundingRequest }
  },
}
