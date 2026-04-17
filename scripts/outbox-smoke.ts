import { Kafka, type SASLOptions } from 'kafkajs'

import { db } from '@/lib/db'
import { createBrokerRuntimeFromEnv, getSupportedBrokerKind } from '@/lib/events/broker-runtime'
import { CanonicalHealthEventOutboxDispatcher } from '@/lib/events/outbox-dispatcher'
import { seedOutboxBiomarker } from '@/scripts/seed-outbox-biomarker'

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

function parseBooleanEnv(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function parseKafkaSaslMechanism(value: string | undefined): 'plain' | 'scram-sha-256' | 'scram-sha-512' {
  switch (value?.trim().toLowerCase()) {
    case 'scram-sha-256':
      return 'scram-sha-256'
    case 'scram-sha-512':
      return 'scram-sha-512'
    case 'plain':
    default:
      return 'plain'
  }
}

async function ensureKafkaTopic(topic: string) {
  const brokers = (process.env.KAFKA_BROKERS ?? '').split(',').map((broker) => broker.trim()).filter(Boolean)
  if (brokers.length === 0) {
    throw new Error('Missing required environment variable: KAFKA_BROKERS')
  }

  let sasl: SASLOptions | undefined
  if (process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD) {
    sasl = {
      mechanism: parseKafkaSaslMechanism(process.env.KAFKA_SASL_MECHANISM),
      username: process.env.KAFKA_SASL_USERNAME,
      password: process.env.KAFKA_SASL_PASSWORD,
    }
  }

  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID?.trim() || 'biozephyra-outbox-smoke',
    brokers,
    ssl: parseBooleanEnv(process.env.KAFKA_SSL),
    sasl,
  })

  const admin = kafka.admin()
  await admin.connect()

  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [
        {
          topic,
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
    })
  } finally {
    await admin.disconnect()
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const broker = args.get('broker')
  const batchSize = parseNumber(args.get('batch-size'), 100)
  const maxAttempts = parseNumber(args.get('max-attempts'), 5)
  const retryDelayMs = parseNumber(args.get('retry-delay-ms'), 0)
  const tenantId = args.get('tenant')

  const seeded = await seedOutboxBiomarker()
  const brokerKind = getSupportedBrokerKind(broker)

  if (brokerKind === 'kafka') {
    await ensureKafkaTopic(seeded.topic)
  }

  const runtime = await createBrokerRuntimeFromEnv(broker)

  try {
    const dispatcher = new CanonicalHealthEventOutboxDispatcher(runtime.publisher, db)
    const result = await dispatcher.dispatchAvailable({
      batchSize,
      maxAttempts,
      retryDelayMs,
      tenantId,
    })

    const outboxRecord = await db.canonicalHealthEventOutboxRecord.findUnique({
      where: { id: seeded.outboxId },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        attemptCount: true,
        lastError: true,
      },
    })

    console.log(JSON.stringify({
      action: 'outbox-smoke-completed',
      broker: brokerKind,
      seed: {
        eventId: seeded.event.id,
        outboxId: seeded.outboxId,
        topic: seeded.topic,
      },
      dispatch: result,
      outboxRecord,
    }))

    if (!outboxRecord || outboxRecord.status !== 'published' || !outboxRecord.publishedAt) {
      throw new Error(`Smoke dispatch did not publish seeded outbox record ${seeded.outboxId}`)
    }
  } finally {
    await runtime.close()
    await db.$disconnect()
  }
}

main().catch(async (error) => {
  console.error(JSON.stringify({
    action: 'outbox-smoke-failed',
    error: error instanceof Error ? error.message : String(error),
  }))
  await db.$disconnect()
  process.exitCode = 1
})