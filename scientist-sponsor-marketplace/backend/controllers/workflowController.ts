import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { deriveTenantContext } from "@/lib/tenancy"
import { assertDealRoomAccess, assertDiscoveryOwnership, assertDiscoveryReadableBySponsor, assertFundingRequestOwnership, buildMarketplaceActorContext } from "@/scientist-sponsor-marketplace/backend/permissions/access-control"
import { canPerform } from "@/scientist-sponsor-marketplace/backend/permissions/permissions"
import { identityIntegration } from "@/scientist-sponsor-marketplace/backend/integrations/identityIntegration"
import { scientistWorkflow } from "@/scientist-sponsor-marketplace/backend/workflows/scientistWorkflow"
import { sponsorWorkflow } from "@/scientist-sponsor-marketplace/backend/workflows/sponsorWorkflow"
import { dealWorkflow } from "@/scientist-sponsor-marketplace/backend/workflows/dealWorkflow"
import { ensureScientistProfile } from "@/scientist-sponsor-marketplace/backend/services/scientistService"
import { ensureSponsorProfile } from "@/scientist-sponsor-marketplace/backend/services/sponsorService"
import { marketplaceRoleSchema } from "@/scientist-sponsor-marketplace/shared/schemas/entities"

export async function handleWorkflow(request: NextRequest, workflow: string) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const actorRole = identityIntegration.resolveRole(session.user.role, body.actingAsRole ? marketplaceRoleSchema.parse(body.actingAsRole) : undefined)
  const actor = await buildMarketplaceActorContext({
    userId: session.user.id,
    name: session.user.name,
    globalRole: String(session.user.role ?? "MEMBER"),
    requestedRole: body.actingAsRole ? marketplaceRoleSchema.parse(body.actingAsRole) : undefined,
  })
  const scientist = await ensureScientistProfile({ id: session.user.id, name: session.user.name })
  const sponsor = await ensureSponsorProfile({ id: session.user.id, name: session.user.name })
  const tenantContext = deriveTenantContext({ sessionUser: session.user, request })

  const runIdempotentWorkflow = (fingerprintValue: unknown, execute: () => Promise<{ status?: number; body: unknown } | unknown>) =>
    executeRouteIdempotentJsonMutation({
      request,
      tenantId: tenantContext.tenantId,
      actorUserId: session.user.id,
      requestFingerprint: createIdempotencyFingerprint({ workflow, actorUserId: session.user.id, ...JSON.parse(JSON.stringify(fingerprintValue ?? null)) }),
      execute: async () => {
        const result = await execute()
        if (typeof result === "object" && result !== null && "body" in result) {
          return { status: Number((result as { status?: number }).status ?? 200), body: (result as { body: unknown }).body }
        }
        return { status: 200, body: result }
      },
    })

  if (workflow === "scientist") {
    switch (body.action) {
      case "createDiscovery": {
        if (!canPerform(actorRole, "manageDiscovery")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        return runIdempotentWorkflow(body, async () => ({
          status: 201,
          body: await scientistWorkflow.createDiscovery({
            scientistId: scientist.id,
            title: body.title,
            category: body.category,
            summary: body.summary,
            developmentStage: body.developmentStage,
            scientificImpactScore: Number(body.scientificImpactScore ?? 0.6),
            commercialReadiness: Number(body.commercialReadiness ?? 0.45),
            fundingGoalCents: Number(body.fundingGoalCents ?? 100000),
            evidenceSummary: body.evidenceSummary ?? null,
            currency: body.currency ?? "USD",
          }),
        }))
      }
      case "uploadEvidence": {
        const ownership = await assertDiscoveryOwnership(actor, body.discoveryId)
        if (ownership.response) {
          return ownership.response
        }

        return runIdempotentWorkflow(body, async () => ({
          body: await scientistWorkflow.uploadEvidence({
            discoveryId: body.discoveryId,
            evidence: body.evidence,
          }),
        }))
      }
      case "setFundingNeeds": {
        const ownership = await assertDiscoveryOwnership(actor, body.discoveryId)
        if (ownership.response) {
          return ownership.response
        }

        const fundingRequestOwnership = await assertFundingRequestOwnership(actor, body.discoveryId)
        if (fundingRequestOwnership.response) {
          return fundingRequestOwnership.response
        }

        const existing = fundingRequestOwnership.fundingRequest
        return runIdempotentWorkflow(body, async () => ({
          body: existing
          ? await db.marketplaceFundingRequest.update({
              where: { discoveryId: body.discoveryId },
              data: {
                requestedAmountCents: Number(body.requestedAmountCents),
                useOfFunds: body.useOfFunds,
                timelineMonths: Number(body.timelineMonths),
              },
            })
          : await scientistWorkflow.setFundingNeeds({
              discoveryId: body.discoveryId,
              scientistId: scientist.id,
              requestedAmountCents: Number(body.requestedAmountCents),
              useOfFunds: body.useOfFunds,
              timelineMonths: Number(body.timelineMonths ?? 12),
              currency: body.currency ?? "USD",
            }),
        }))
      }
      case "publish": {
        const ownership = await assertDiscoveryOwnership(actor, body.discoveryId)
        if (ownership.response) {
          return ownership.response
        }

        const discovery = ownership.discovery
        const fundingRequest = await db.marketplaceFundingRequest.findUnique({ where: { discoveryId: body.discoveryId } })

        return runIdempotentWorkflow(body, async () => ({
          body: await scientistWorkflow.publishToMarketplace({
            discovery: JSON.parse(JSON.stringify(discovery)),
            fundingRequest: fundingRequest ? JSON.parse(JSON.stringify(fundingRequest)) : null,
          }),
        }))
      }
      default:
        return NextResponse.json({ error: "Unknown scientist workflow action" }, { status: 400 })
    }
  }

  if (workflow === "sponsor") {
    switch (body.action) {
      case "browse": {
        const results = await sponsorWorkflow.browseDiscoveries({
          category: body.category,
          maxCostCents: body.maxCostCents ? Number(body.maxCostCents) : undefined,
          minImpactScore: body.minImpactScore ? Number(body.minImpactScore) : undefined,
          stage: body.stage,
          search: body.search,
        })
        return NextResponse.json(results)
      }
      case "requestMoreInfo": {
        const readable = await assertDiscoveryReadableBySponsor(actor, body.discoveryId)
        if (readable.response) {
          return readable.response
        }

        const discovery = await db.marketplaceDiscovery.findUnique({ where: { id: body.discoveryId }, include: { scientist: true } })
        if (!discovery) {
          return NextResponse.json({ error: "Discovery not found" }, { status: 404 })
        }

        return runIdempotentWorkflow(body, async () => ({
          status: 201,
          body: await sponsorWorkflow.requestMoreInfo({
            discoveryId: discovery.id,
            scientistId: discovery.scientistId,
            sponsorId: sponsor.id,
            sponsorUserId: session.user.id,
            scientistUserId: discovery.scientist.userId,
            message: body.message ?? "We would like additional diligence materials.",
          }),
        }))
      }
      case "enterDealRoom": {
        const readable = await assertDiscoveryReadableBySponsor(actor, body.discoveryId)
        if (readable.response) {
          return readable.response
        }

        const discovery = readable.discovery

        return runIdempotentWorkflow(body, async () => ({
          body: await sponsorWorkflow.enterDealRoom({
            discoveryId: discovery.id,
            scientistId: discovery.scientistId,
            sponsorId: sponsor.id,
          }),
        }))
      }
      case "fund": {
        const access = await assertDealRoomAccess(actor, body.dealRoomId, "write")
        if (access.response) {
          return access.response
        }

        const dealRoom = access.dealRoom
        if (dealRoom.sponsorId !== sponsor.id && actor.role !== "admin") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        return runIdempotentWorkflow(body, async () => ({
          status: 201,
          body: await dealWorkflow.processPayment({
            dealRoomId: dealRoom.id,
            discoveryId: dealRoom.discoveryId,
            sponsorId: sponsor.id,
            sponsorUserId: session.user.id,
            sponsorUserEmail: session.user.email ?? null,
            sponsorUserName: session.user.name ?? null,
            scientistUserId: dealRoom.scientist.userId,
            amountCents: Number(body.amountCents),
            currency: body.currency ?? "USD",
            subscriptionTier: body.subscriptionTier ?? "growth",
          }),
        }))
      }
      default:
        return NextResponse.json({ error: "Unknown sponsor workflow action" }, { status: 400 })
    }
  }

  if (workflow === "deal") {
    switch (body.action) {
      case "negotiate":
        {
          const access = await assertDealRoomAccess(actor, body.dealRoomId, "write")
          if (access.response) {
            return access.response
          }

        return runIdempotentWorkflow(body, async () => ({
          body: await dealWorkflow.negotiate({
            dealRoomId: body.dealRoomId,
            termsPatch: body.termsPatch ?? {},
            actorRole,
            actorUserId: session.user.id,
          }),
        }))
        }
      case "message":
        {
          const access = await assertDealRoomAccess(actor, body.dealRoomId, "write")
          if (access.response) {
            return access.response
          }

        return runIdempotentWorkflow(body, async () => ({
          status: 201,
          body: await dealWorkflow.sendMessage({
            dealRoomId: body.dealRoomId,
            actorRole,
            actorUserId: session.user.id,
            body: body.body,
            attachments: body.attachments ?? [],
          }),
        }))
        }
      case "buildAgreement":
        {
          const access = await assertDealRoomAccess(actor, body.dealRoomId, "write")
          if (access.response) {
            return access.response
          }

        return runIdempotentWorkflow(body, async () => ({
          body: await dealWorkflow.buildAgreement({
            dealRoomId: body.dealRoomId,
            agreementTerms: body.agreementTerms ?? {},
            actorRole,
            actorUserId: session.user.id,
          }),
        }))
        }
      case "approveAgreement":
        if (!canPerform(actorRole, "approveAgreement")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        {
          const access = await assertDealRoomAccess(actor, body.dealRoomId, "write")
          if (access.response) {
            return access.response
          }
        }

        return runIdempotentWorkflow(body, async () => ({
          body: await dealWorkflow.approveAgreement({
            dealRoomId: body.dealRoomId,
            actorRole,
            actorUserId: session.user.id,
            approvalNote: body.approvalNote,
          }),
        }))
      case "markMilestoneComplete":
        if (actorRole !== "scientist") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        {
          const access = await assertDealRoomAccess(actor, body.dealRoomId, "write")
          if (access.response) {
            return access.response
          }
        }

        try {
          return runIdempotentWorkflow(body, async () => ({
            body: await dealWorkflow.markMilestoneComplete({
              dealRoomId: body.dealRoomId,
              transactionId: body.transactionId,
              actorUserId: session.user.id,
            }),
          }))
        } catch (error) {
          return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to mark milestone complete" }, { status: 400 })
        }
      case "approveAndRelease":
        if (actorRole !== "admin") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        {
          const access = await assertDealRoomAccess(actor, body.dealRoomId, "write")
          if (access.response) {
            return access.response
          }
        }

        try {
          return runIdempotentWorkflow(body, async () => ({
            body: await dealWorkflow.approveAndRelease({
              dealRoomId: body.dealRoomId,
              transactionId: body.transactionId,
              actorUserId: session.user.id,
            }),
          }))
        } catch (error) {
          return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to approve and release payout" }, { status: 400 })
        }
      case "rejectPayoutReview":
        if (actorRole !== "admin") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        {
          const access = await assertDealRoomAccess(actor, body.dealRoomId, "write")
          if (access.response) {
            return access.response
          }
        }

        try {
          return runIdempotentWorkflow(body, async () => ({
            body: await dealWorkflow.rejectPayoutReview({
              dealRoomId: body.dealRoomId,
              transactionId: body.transactionId,
              actorUserId: session.user.id,
              rejection: body.rejection,
            }),
          }))
        } catch (error) {
          return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reject payout review" }, { status: 400 })
        }
      default:
        return NextResponse.json({ error: "Unknown deal workflow action" }, { status: 400 })
    }
  }

  return NextResponse.json({ error: "Unknown workflow" }, { status: 404 })
}
