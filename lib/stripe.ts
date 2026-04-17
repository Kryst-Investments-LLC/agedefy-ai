import Stripe from "stripe"

import { db } from "@/lib/db"
import { env } from "@/lib/env"

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
    })
  : null

export async function ensureStripeCustomer(params: {
  userId: string
  email: string
  name?: string | null
  stripeCustomerId?: string | null
}) {
  if (!stripe) {
    return null
  }

  if (params.stripeCustomerId) {
    return params.stripeCustomerId
  }

  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name ?? undefined,
    metadata: { userId: params.userId },
  })

  await db.user.update({
    where: { id: params.userId },
    data: { stripeCustomerId: customer.id },
  })

  return customer.id
}