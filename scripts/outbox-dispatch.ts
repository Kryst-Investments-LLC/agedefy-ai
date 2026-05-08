import { db } from '@/lib/db'
import { createBrokerRuntimeFromEnv, getSupportedBrokerKind } from '@/lib/events/broker-runtime'
import { CanonicalHealthEventOutboxDispatcher } from '@/lib/events/outbox-dispatcher'
import { logger } from '@/lib/logger'

function parseArgs(argv: string[]) {
  const args = new Map<string, string>()

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    const value = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[index + 1] : 'true'
    args.set(key, value)
    if (value !== 'true') {
      index += 1
    }
  }

  return args
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const broker = args.get('broker')
  const batchSize = parseNumber(args.get('batch-size'), 100)
  const maxAttempts = parseNumber(args.get('max-attempts'), 5)
  const retryDelayMs = parseNumber(args.get('retry-delay-ms'), 30_000)
  const tenantId = args.get('tenant')

  const runtime = await createBrokerRuntimeFromEnv(broker)

  try {
    const dispatcher = new CanonicalHealthEventOutboxDispatcher(runtime.publisher, db)
    const result = await dispatcher.dispatchAvailable({
      batchSize,
      maxAttempts,
      retryDelayMs,
      tenantId,
    })

    logger.info('Outbox batch dispatch completed', {
      broker: getSupportedBrokerKind(broker),
      batchSize,
      tenantId,
      ...result,
    })

    if (result.failed > 0) {
      process.exitCode = 1
    }
  } finally {
    await runtime.close()
    await db.$disconnect()
  }
}

main().catch(async (error) => {
  logger.error('Outbox batch dispatch failed', {
    error: error instanceof Error ? error.message : String(error),
  })
  await db.$disconnect()
  process.exitCode = 1
})