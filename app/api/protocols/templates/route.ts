import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"

/**
 * GET /api/protocols/templates — curated protocol templates from the knowledge graph
 * POST /api/protocols/templates — adopt a template (creates a real protocol)
 */

interface ProtocolTemplate {
  id: string
  name: string
  description: string
  category: string
  compounds: { name: string; category: string; mechanism: string | null }[]
  targetPathways: string[]
  biomarkerTargets: string[]
  evidence: string
  caution: string
}

function buildTemplates(
  compounds: { id: string; name: string; category: string; mechanism: string | null }[],
  pathwayLinks: { compound: { name: string }; pathway: { name: string }; effect: string }[],
  biomarkerEffects: { compound: { name: string }; biomarkerName: string; direction: string }[]
): ProtocolTemplate[] {
  const compoundMap = new Map(compounds.map((c) => [c.name, c]))
  const compoundPathways = new Map<string, Set<string>>()
  for (const link of pathwayLinks) {
    if (!compoundPathways.has(link.compound.name)) compoundPathways.set(link.compound.name, new Set())
    compoundPathways.get(link.compound.name)!.add(link.pathway.name)
  }
  const compoundBiomarkers = new Map<string, string[]>()
  for (const eff of biomarkerEffects) {
    if (!compoundBiomarkers.has(eff.compound.name)) compoundBiomarkers.set(eff.compound.name, [])
    compoundBiomarkers.get(eff.compound.name)!.push(`${eff.direction === "decrease" ? "↓" : "↑"} ${eff.biomarkerName}`)
  }

  const templates: ProtocolTemplate[] = []

  // 1. mTOR + Autophagy Protocol
  const mtorCompounds = ["Rapamycin", "Spermidine"].filter((n) => compoundMap.has(n))
  if (mtorCompounds.length > 0) {
    templates.push({
      id: "mtor-autophagy",
      name: "mTOR Inhibition + Autophagy Enhancement",
      description: "Targets the most validated longevity pathway (mTOR) combined with autophagy activation. Rapamycin is the most consistently lifespan-extending compound across species.",
      category: "Core Longevity",
      compounds: mtorCompounds.map((n) => compoundMap.get(n)!),
      targetPathways: [...new Set(mtorCompounds.flatMap((n) => [...(compoundPathways.get(n) ?? [])]))],
      biomarkerTargets: [...new Set(mtorCompounds.flatMap((n) => compoundBiomarkers.get(n) ?? []))],
      evidence: "ITP mouse studies, Mannick 2014 (human immune function improvement)",
      caution: "Rapamycin requires medical supervision. Intermittent dosing protocols under investigation.",
    })
  }

  // 2. NAD+ Restoration Protocol
  const nadCompounds = ["NMN", "Nicotinamide Riboside (NR)", "Resveratrol"].filter((n) => compoundMap.has(n))
  if (nadCompounds.length > 0) {
    templates.push({
      id: "nad-restoration",
      name: "NAD+ Restoration",
      description: "Addresses the age-related decline in NAD+ levels through direct precursor supplementation plus sirtuin activation.",
      category: "Metabolic Optimization",
      compounds: nadCompounds.map((n) => compoundMap.get(n)!),
      targetPathways: [...new Set(nadCompounds.flatMap((n) => [...(compoundPathways.get(n) ?? [])]))],
      biomarkerTargets: [...new Set(nadCompounds.flatMap((n) => compoundBiomarkers.get(n) ?? []))],
      evidence: "Yoshino 2021 (NMN human trial), Martens 2018 (NR NIAGEN trial)",
      caution: "Optimal dosing and NMN vs NR preference still being established in long-term human trials.",
    })
  }

  // 3. Senolytic Protocol
  const senoCompounds = ["Dasatinib", "Quercetin", "Fisetin"].filter((n) => compoundMap.has(n))
  if (senoCompounds.length > 0) {
    templates.push({
      id: "senolytic",
      name: "Senolytic (Zombie Cell Clearance)",
      description: "Intermittent senolytic protocol targeting accumulated senescent cells. D+Q and Fisetin selectively induce apoptosis in growth-arrested cells.",
      category: "Cellular Repair",
      compounds: senoCompounds.map((n) => compoundMap.get(n)!),
      targetPathways: [...new Set(senoCompounds.flatMap((n) => [...(compoundPathways.get(n) ?? [])]))],
      biomarkerTargets: [...new Set(senoCompounds.flatMap((n) => compoundBiomarkers.get(n) ?? []))],
      evidence: "Xu 2018 (D+Q in mice), Justice 2019 (D+Q human IPF trial)",
      caution: "Hit-and-run dosing (e.g. 3 days/month). Dasatinib is a prescription drug. Not FDA-approved for aging.",
    })
  }

  // 4. Metabolic Optimization
  const metaCompounds = ["Metformin", "Berberine", "Alpha-Ketoglutarate"].filter((n) => compoundMap.has(n))
  if (metaCompounds.length > 0) {
    templates.push({
      id: "metabolic-opt",
      name: "Metabolic Optimization",
      description: "AMPK activation and metabolic pathway optimization through well-studied insulin-sensitizing compounds.",
      category: "Metabolic Optimization",
      compounds: metaCompounds.map((n) => compoundMap.get(n)!),
      targetPathways: [...new Set(metaCompounds.flatMap((n) => [...(compoundPathways.get(n) ?? [])]))],
      biomarkerTargets: [...new Set(metaCompounds.flatMap((n) => compoundBiomarkers.get(n) ?? []))],
      evidence: "TAME trial (Metformin, ongoing), ITP data on AKG, Berberine meta-analyses for metabolic health",
      caution: "Metformin is prescription-only. Berberine may interact with medications. Monitor blood glucose.",
    })
  }

  return templates
}

export async function GET() {
  const [compounds, pathwayLinks, biomarkerEffects] = await Promise.all([
    db.compound.findMany({
      select: { id: true, name: true, category: true, mechanism: true },
    }),
    db.compoundPathway.findMany({
      include: { compound: { select: { name: true } }, pathway: { select: { name: true } } },
    }),
    db.compoundBiomarkerEffect.findMany({
      include: { compound: { select: { name: true } } },
    }),
  ])

  const templates = buildTemplates(compounds, pathwayLinks, biomarkerEffects)
  return NextResponse.json({ templates })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { templateId, templateName, templateDescription } = body as {
    templateId?: string
    templateName?: string
    templateDescription?: string
  }

  if (!templateId || !templateName) {
    return NextResponse.json({ error: "templateId and templateName required" }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, templateId }),
    execute: async () => {
      const protocol = await db.protocol.create({
        data: {
          userId: session.user.id,
          name: templateName,
          description: templateDescription ?? `Adopted from template: ${templateId}`,
          status: "active",
        },
      })

      return { status: 201, body: protocol }
    },
  })
}
