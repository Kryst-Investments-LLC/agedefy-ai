import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { logAudit } from "@/lib/audit"

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 })
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true, email: true },
  })

  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account linked. Purchase a plan first." }, { status: 400 })
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/account`,
  })

  await logAudit({
    actorUserId: session.user.id,
    actorEmail: user.email,
    action: "stripe.portal.opened",
    entityType: "stripe_portal",
  })

  return NextResponse.json({ url: portalSession.url })
}
