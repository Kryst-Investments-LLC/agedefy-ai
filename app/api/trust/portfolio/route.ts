import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { applyRateLimit } from '@/lib/rate-limit'

/**
 * GET /api/trust/portfolio
 *
 * Portfolio & capital-allocation view for sponsors.
 * Shows funded discoveries, total capital deployed, pipeline status,
 * and evidence-milestone progress per investment.
 */
export async function GET(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sponsor = await db.marketplaceSponsor.findUnique({
    where: { userId: session.user.id },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        include: {
          dealRoom: {
            include: {
              discovery: {
                select: { id: true, title: true, status: true, category: true },
              },
            },
          },
        },
      },
      dealRooms: {
        orderBy: { createdAt: 'desc' },
        include: {
          discovery: {
            select: {
              id: true,
              title: true,
              status: true,
              category: true,
              fundingRequest: {
                select: { id: true, status: true, requestedAmountCents: true },
              },
            },
          },
        },
      },
    },
  })

  if (!sponsor) {
    return NextResponse.json({ error: 'Not a registered sponsor' }, { status: 404 })
  }

  // Compute portfolio metrics
  const totalDeployedCents = sponsor.transactions
    .filter((t) => t.status === 'SETTLED' || t.status === 'RELEASED')
    .reduce((sum, t) => sum + t.amountCents, 0)

  const pipelineByStatus = sponsor.dealRooms.reduce<Record<string, number>>((acc, dr) => {
    const status = dr.status
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})

  const investments = sponsor.dealRooms.map((dr) => {
    const txForDeal = sponsor.transactions.filter((t) => t.dealRoomId === dr.id)
    const investedCents = txForDeal
      .filter((t) => t.status === 'SETTLED' || t.status === 'RELEASED')
      .reduce((sum, t) => sum + t.amountCents, 0)

    const fundingRequest = dr.discovery?.fundingRequest
    const milestonesCompleted = fundingRequest && (fundingRequest.status === 'COMMITTED' || fundingRequest.status === 'CLOSED') ? 1 : 0
    const milestonesTotal = fundingRequest ? 1 : 0

    return {
      dealRoomId: dr.id,
      dealRoomStatus: dr.status,
      discovery: dr.discovery ? {
        id: dr.discovery.id,
        title: dr.discovery.title,
        status: dr.discovery.status,
        category: dr.discovery.category,
      } : null,
      investedCents,
      milestonesCompleted,
      milestonesTotal,
      milestoneProgress: milestonesTotal > 0 ? milestonesCompleted / milestonesTotal : 0,
    }
  })

  return NextResponse.json({
    portfolio: {
      sponsorId: sponsor.id,
      organizationName: sponsor.organizationName,
      capitalAvailableCents: sponsor.capitalAvailableCents,
      totalDeployedCents,
      utilizationRate: sponsor.capitalAvailableCents > 0 ? totalDeployedCents / sponsor.capitalAvailableCents : 0,
      activeDealRooms: sponsor.dealRooms.filter((d) => d.status === 'OPEN' || d.status === 'NEGOTIATING').length,
      pipelineByStatus,
      investments,
    },
  })
}
