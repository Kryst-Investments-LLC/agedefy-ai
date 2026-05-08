import { PubSub } from '@google-cloud/pubsub'
import { Kafka, type SASLOptions } from 'kafkajs'

import {
  KafkaHealthEventBrokerPublisher,
  PubSubHealthEventBrokerPublisher,
  type HealthEventBrokerPublisher,
} from '@/lib/events/outbox-dispatcher'

export type SupportedBrokerKind = 'kafka' | 'pubsub'

export interface BrokerRuntime {
  kind: SupportedBrokerKind
  publisher: HealthEventBrokerPublisher
  close(): Promise<void>
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function parseBooleanEnv(value: string | undefined, defaultValue = false): boolean {
  if (!value) {
    return defaultValue
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

function resolveBrokerKind(explicitBroker?: string): SupportedBrokerKind {
  const broker = (explicitBroker ?? process.env.OUTBOX_BROKER ?? 'kafka').toLowerCase()
  if (broker !== 'kafka' && broker !== 'pubsub') {
    throw new Error(`Unsupported broker kind: ${broker}`)
  }

  return broker
}

async function createKafkaRuntime(): Promise<BrokerRuntime> {
  const brokers = requireEnv('KAFKA_BROKERS').split(',').map((broker) => broker.trim()).filter(Boolean)
  const clientId = process.env.KAFKA_CLIENT_ID?.trim() || 'biozephyra-outbox-worker'
  const ssl = parseBooleanEnv(process.env.KAFKA_SSL)
  let sasl: SASLOptions | undefined

  if (process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD) {
    sasl = {
      mechanism: parseKafkaSaslMechanism(process.env.KAFKA_SASL_MECHANISM),
      username: process.env.KAFKA_SASL_USERNAME,
      password: process.env.KAFKA_SASL_PASSWORD,
    }
  }

  const kafka = new Kafka({
    clientId,
    brokers,
    ssl,
    sasl,
  })
  const producer = kafka.producer({ allowAutoTopicCreation: false })
  await producer.connect()

  return {
    kind: 'kafka',
    publisher: new KafkaHealthEventBrokerPublisher(producer),
    close: () => producer.disconnect(),
  }
}

async function createPubSubRuntime(): Promise<BrokerRuntime> {
  const projectId = requireEnv('PUBSUB_PROJECT_ID')
  const apiEndpoint = process.env.PUBSUB_API_ENDPOINT?.trim() || undefined
  const pubsub = new PubSub({ projectId, apiEndpoint })

  return {
    kind: 'pubsub',
    publisher: new PubSubHealthEventBrokerPublisher((topic) => pubsub.topic(topic, { messageOrdering: true })),
    close: async () => {
      await Promise.resolve()
    },
  }
}

export async function createBrokerRuntimeFromEnv(explicitBroker?: string): Promise<BrokerRuntime> {
  const broker = resolveBrokerKind(explicitBroker)
  return broker === 'pubsub' ? createPubSubRuntime() : createKafkaRuntime()
}

export function getSupportedBrokerKind(explicitBroker?: string): SupportedBrokerKind {
  return resolveBrokerKind(explicitBroker)
}