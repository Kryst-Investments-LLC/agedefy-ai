import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { buildLongitudinalGraph, type GraphNodeDomain } from '@/lib/graph/longitudinal-graph'
import { getProvenanceSnapshots, type ProvenanceDomain } from '@/lib/graph/provenance'
import { applyRateLimit } from '@/lib/rate-limit'

const VALID_GRAPH_DOMAINS: GraphNodeDomain[] = [
  'biomarker', 'protocol', 'outcome', 'lab-result', 'consultation',
  'evidence', 'hypothesis', 'discovery', 'marketplace-order', 'adverse-event',
]

const VALID_PROVENANCE_DOMAINS: ProvenanceDomain[] = [
  'evidence', 'hypothesis', 'aeonforge-candidate', 'mechanistic-model', 'intervention-outcome',
]

/**
 * GET /api/graph/timeline
 *
 * Returns the unified longitudinal timeline for the authenticated user.
 *
 * Query params:
 *   domains  – comma-separated list of domains to include
 *   limit    – max nodes per domain (default 50)
 *   provenance – if "true", include provenance snapshots alongside timeline
 *   highImpactOnly – if "true", provenance returns only high-impact items
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  const rawDomains = searchParams.get('domains')
  const domainFilter = rawDomains
    ? rawDomains.split(',').filter((d): d is GraphNodeDomain => VALID_GRAPH_DOMAINS.includes(d as GraphNodeDomain))
    : undefined

  const limitParam = searchParams.get('limit')
  const limitPerDomain = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50

  const includeProvenance = searchParams.get('provenance') === 'true'
  const highImpactOnly = searchParams.get('highImpactOnly') === 'true'

  const graph = await buildLongitudinalGraph(session.user.id, {
    limitPerDomain,
    domains: domainFilter,
  })

  if (includeProvenance) {
    const provenanceDomainFilter = rawDomains
      ? rawDomains.split(',').filter((d): d is ProvenanceDomain => VALID_PROVENANCE_DOMAINS.includes(d as ProvenanceDomain))
      : undefined

    const provenance = await getProvenanceSnapshots(session.user.id, {
      domains: provenanceDomainFilter,
      highImpactOnly,
    })

    return NextResponse.json({ graph, provenance })
  }

  return NextResponse.json({ graph })
}
