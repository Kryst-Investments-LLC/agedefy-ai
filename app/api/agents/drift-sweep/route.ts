import { NextRequest, NextResponse } from 'next/server'

import { runDriftSweepBatch } from '@/lib/agents/drift-sweep'
import { logger } from '@/lib/logger'

/**
 * POST /api/agents/drift-sweep
 *
 * Cron-triggered endpoint that runs the Biological Drift Monitor.
 * Secured via CRON_SECRET bearer token to prevent unauthorized invocations.
 *
 * Can be wired to Vercel Cron via vercel.json:
 *   { "crons": [{ "path": "/api/agents/drift-sweep", "schedule": "0 6 * * 1" }] }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    logger.error('CRON_SECRET environment variable is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { trigger?: string }
  const triggerType = body.trigger === 'manual' ? 'manual' as const : 'scheduled' as const

  try {
    const result = await runDriftSweepBatch(triggerType)

    logger.info('Drift sweep cron completed', result)

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Drift sweep cron failed', { error: message })
    return NextResponse.json({ error: 'Sweep failed', detail: message }, { status: 500 })
  }
}
