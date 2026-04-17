import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { applyRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

function getCandidateCount(value: Prisma.JsonValue): number {
  if (Array.isArray(value)) {
    return value.length
  }

  if (value && typeof value === 'object' && 'count' in value) {
    const count = value.count
    return typeof count === 'number' ? count : 0
  }

  return 0
}

/**
 * GET /api/aeonforge/candidates
 * List all discovery candidates for authenticated user
 * Paginated, ordered by creation date (newest first)
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const blocked = await applyRateLimit(request, { maxRequests: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Parse pagination query params
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '10', 10))
    const status = searchParams.get('status')

    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.AeonForgeCandidateWhereInput = { userId: session.user.id }
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status
    }

    // Fetch candidates and total count
    const [candidates, total] = await Promise.all([
      db.aeonForgeCandidate.findMany({
        where,
        select: {
          id: true,
          prompt: true,
          candidates: true,
          simulationScore: true,
          safetyScore: true,
          healthspanDelta: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              simulationResults: true,
              virtualTwinRuns: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.aeonForgeCandidate.count({ where }),
    ])

    // Format response
    const formattedCandidates = candidates.map((candidate) => ({
      id: candidate.id,
      prompt: candidate.prompt,
      candidateCount: getCandidateCount(candidate.candidates),
      simulationScore: candidate.simulationScore,
      safetyScore: candidate.safetyScore,
      healthspanDelta: candidate.healthspanDelta,
      status: candidate.status,
      simulations: candidate._count.simulationResults,
      virtualTwins: candidate._count.virtualTwinRuns,
      createdAt: candidate.createdAt,
    }))

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      candidates: formattedCandidates,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
      },
    })
  } catch (error) {
    logger.error('ÆonForge candidates listing error', { error })
    return NextResponse.json(
      { error: 'Failed to retrieve candidates' },
      { status: 500 }
    )
  }
}
