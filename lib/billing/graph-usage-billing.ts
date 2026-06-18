/**
 * Graph Data Product — usage billing hook (STUB)
 *
 * The graph outcomes API is metered per query (see lib/api-keys/metering.ts,
 * which records every call into APIUsageRecord). This hook is where those
 * metered units would be reported to Stripe as metered-usage records against
 * the graph product's Price.
 *
 * It is intentionally a STUB:
 *   - It NEVER fabricates a successful charge.
 *   - When STRIPE_GRAPH_PRICE_ID / STRIPE_SECRET_KEY are not configured, it is a
 *     no-op and returns reported:false with a reason.
 *   - When they ARE configured, it currently logs intent and returns
 *     reported:false (reason "stub") — the actual Stripe usage-record call is a
 *     deliberate follow-up so that no live billing path ships untested.
 *
 * @module lib/billing/graph-usage-billing
 */

import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

export interface GraphUsageBillingInput {
  /** The API key the usage is attributed to. */
  keyId: string
  /** Billable units for this request (default 1 query = 1 unit). */
  units?: number
}

export type GraphUsageBillingResult =
  | { reported: false; reason: "not_configured" | "stub" }
  | { reported: true; priceId: string; units: number }

/**
 * Report metered graph-query usage for billing.
 *
 * Currently a stub gated behind STRIPE_GRAPH_PRICE_ID — see module docs.
 */
export async function reportGraphQueryUsage(
  input: GraphUsageBillingInput,
): Promise<GraphUsageBillingResult> {
  const priceId = env.STRIPE_GRAPH_PRICE_ID
  const units = input.units ?? 1

  if (!priceId || !env.STRIPE_SECRET_KEY) {
    return { reported: false, reason: "not_configured" }
  }

  // TODO(billing): create a Stripe metered-usage record against `priceId` for
  // this key's subscription item. Kept as a stub so no live billing path ships
  // without its own test + idempotency handling.
  logger.info("Graph usage billing (stub) — would report metered usage", {
    keyId: input.keyId,
    priceId,
    units,
  })
  return { reported: false, reason: "stub" }
}
