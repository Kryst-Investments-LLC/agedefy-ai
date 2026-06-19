/**
 * Graph Data Product — usage billing.
 *
 * Reports each metered graph-query to Stripe Billing Meter Events
 * (stripe.billing.meterEvents.create). The meter must be configured in the
 * Stripe dashboard with event_name = "biozephyra_graph_query".
 *
 * Required Stripe objects:
 *   1. A Billing Meter   — event_name: "biozephyra_graph_query"
 *   2. A Price           — recurring.meter = <meter.id>, set via STRIPE_GRAPH_PRICE_ID
 *   3. The price must be attached to each customer's subscription before queries are
 *      reported (done at checkout / subscription creation).
 *
 * This function is best-effort: billing failures are logged but never bubble up
 * to the caller — a Stripe outage must not block a legitimate API query.
 */

import { db } from "@/lib/db"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { stripe } from "@/lib/stripe"

export interface GraphUsageBillingInput {
  /** The API key the usage is attributed to. */
  keyId: string
  /** Billable units for this request (1 query = 1 unit by default). */
  units?: number
}

export type GraphUsageBillingResult =
  | { reported: false; reason: "not_configured" | "key_not_found" | "no_stripe_customer" | "error" }
  | { reported: true; units: number; eventId: string }

/**
 * Report metered graph-query usage to Stripe Billing Meter Events.
 *
 * Idempotent within a 1-minute window per key (identifier bucket).
 * Never throws — returns { reported: false, reason: "error" } on Stripe failures.
 */
export async function reportGraphQueryUsage(
  input: GraphUsageBillingInput,
): Promise<GraphUsageBillingResult> {
  if (!env.STRIPE_GRAPH_PRICE_ID || !stripe) {
    return { reported: false, reason: "not_configured" }
  }

  try {
    // Resolve the Stripe customer ID from the API key owner
    const row = await db.aPIKey.findUnique({
      where: { id: input.keyId },
      select: { user: { select: { stripeCustomerId: true } } },
    })

    if (!row) {
      logger.warn("Graph usage billing: API key not found", { keyId: input.keyId })
      return { reported: false, reason: "key_not_found" }
    }

    const stripeCustomerId = row.user?.stripeCustomerId
    if (!stripeCustomerId) {
      logger.warn("Graph usage billing: user has no Stripe customer ID", { keyId: input.keyId })
      return { reported: false, reason: "no_stripe_customer" }
    }

    const units = input.units ?? 1
    // 1-minute idempotency window — prevents double-billing on retries within the same minute
    const identifier = `graph-${input.keyId}-${Math.floor(Date.now() / 60_000)}`

    const event = await stripe.billing.meterEvents.create({
      event_name: "biozephyra_graph_query",
      payload: {
        value: String(units),
        stripe_customer_id: stripeCustomerId,
      },
      identifier,
    })

    logger.info("Graph usage reported to Stripe", {
      keyId: input.keyId,
      units,
      eventId: event.identifier,
      stripeCustomerId,
    })

    return { reported: true, units, eventId: event.identifier }
  } catch (err) {
    logger.warn("Graph usage billing failed — query still served", {
      keyId: input.keyId,
      error: String(err),
    })
    return { reported: false, reason: "error" }
  }
}
