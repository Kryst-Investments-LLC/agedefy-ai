/**
 * Vercel Cron: Nightly Outcome Aggregation
 *
 * GET /api/cron/aggregate — Triggered nightly by Vercel Cron.
 * Secured via CRON_SECRET header check.
 *
 * @module app/api/cron/aggregate/route
 */

import { NextRequest, NextResponse } from 'next/server'

import { runOutcomeAggregation } from '@/lib/flywheel/outcome-aggregator'
import { logger } from '@/lib/logger'
import { requireCronAuthorization } from '@/lib/security/cron-auth'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes max

export async function GET(request: NextRequest) {
  const unauthorized = requireCronAuthorization(request)
  if (unauthorized) return unauthorized

  try {
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const result = await runOutcomeAggregation({ period })

    logger.info('Cron aggregation complete', { ...result })

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    logger.error('Cron aggregation failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: 'Aggregation failed' },
      { status: 500 },
    )
  }
}
