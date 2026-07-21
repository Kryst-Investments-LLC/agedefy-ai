import { setTimeout as delay } from 'node:timers/promises'

import { db } from '@/lib/db'
import { createBrokerRuntimeFromEnv, getSupportedBrokerKind } from '@/lib/events/broker-runtime'
import { CanonicalHealthEventOutboxDispatcher } from '@/lib/events/outbox-dispatcher'
import { logger } from '@/lib/logger'

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function main() {
  const broker = process.env.OUTBOX_BROKER
  const pollIntervalMs = parseNumber(process.env.OUTBOX_POLL_INTERVAL_MS, 5_000)
  const batchSize = parseNumber(process.env.OUTBOX_BATCH_SIZE, 100)
  const maxAttempts = parseNumber(process.env.OUTBOX_MAX_ATTEMPTS, 5)
  const retryDelayMs = parseNumber(process.env.OUTBOX_RETRY_DELAY_MS, 30_000)
  const tenantId = process.env.OUTBOX_TENANT_ID?.trim() || undefined

  const runtime = await createBrokerRuntimeFromEnv(broker)
  const dispatcher = new CanonicalHealthEventOutboxDispatcher(runtime.publisher, db)
  let stopping = false

  const requestStop = (signal: string) => {
    // Second signal forces an immediate exit if a dispatch cycle hangs past the
    // orchestrator's SIGTERM grace period; the first drains after the current
    // batch. In-flight events are marked in the outbox and reclaimed on lease
    // expiry, so an interrupted batch is recovered by any surviving worker.
    if (stopping) {
      logger.warn('Outbox worker received second signal, forcing exit', { signal })
      process.exit(1)
    }
    stopping = true
    logger.info('Outbox worker draining before shutdown', { signal })
  }

  process.on('SIGINT', requestStop)
  process.on('SIGTERM', requestStop)

  try {
    logger.info('Outbox worker started', {
      broker: getSupportedBrokerKind(broker),
      pollIntervalMs,
      batchSize,
      tenantId,
    })

    while (!stopping) {
      const result = await dispatcher.dispatchAvailable({
        batchSize,
        maxAttempts,
        retryDelayMs,
        tenantId,
      })

      logger.info('Outbox worker cycle completed', { ...result })

      if (!stopping && result.processed === 0) {
        await delay(pollIntervalMs)
      }
    }

    logger.info('Outbox worker stopped cleanly')
  } finally {
    await runtime.close()
    await db.$disconnect()
  }
}

main().catch(async (error) => {
  logger.error('Outbox worker crashed', {
    error: error instanceof Error ? error.message : String(error),
  })
  await db.$disconnect()
  process.exitCode = 1
})