import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ClinicianTaskStatus } from "@prisma/client"

import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildApiCanonicalEventContext } from "@/lib/events/api-context"
import { clinicianTaskRecordToEvent } from "@/lib/events/ingestion"
import { PrismaTransactionalHealthEventIngestionService } from "@/lib/events/transactional-ingestion-service"
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from "@/lib/idempotency"
import { logAudit } from "@/lib/audit"
import { deriveTenantContextWithValidation } from "@/lib/tenancy"
import { clinicianTaskSchema, clinicianTaskUpdateSchema } from "@/lib/validators/enterprise"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tasks = await db.clinicianTask.findMany({
    where: { userId: session.user.id },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    take: 50,
  })

  return NextResponse.json(
    tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
    })),
  )
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = clinicianTaskSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, ...parsed.data }),
    execute: async () => {
      const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
      const eventContext = buildApiCanonicalEventContext(session, request)

      const { result: task } = await ingestionService.ingestMutation(async (tx) => {
        const task = await tx.clinicianTask.create({
          data: {
            userId: session.user.id,
            title: parsed.data.title,
            description: parsed.data.description,
            priority: parsed.data.priority,
            dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
          },
        })

        return {
          result: task,
          event: clinicianTaskRecordToEvent(task, eventContext),
        }
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        action: "clinician_task.created",
        entityType: "clinician_task",
        entityId: task.id,
      })

      return { status: 201, body: { id: task.id, title: task.title, status: task.status } }
    },
  })
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const id = body?.id

  if (typeof id !== "string") {
    return NextResponse.json({ error: "Missing task id" }, { status: 400 })
  }

  const parsed = clinicianTaskUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tenantContext = await deriveTenantContextWithValidation({ sessionUser: session.user, request })
  if (!tenantContext) return NextResponse.json({ error: "Forbidden: invalid tenant" }, { status: 403 })

  return executeRouteIdempotentJsonMutation({
    request,
    tenantId: tenantContext.tenantId,
    actorUserId: session.user.id,
    requestFingerprint: createIdempotencyFingerprint({ userId: session.user.id, id, ...parsed.data }),
    execute: async () => {
      const existing = await db.clinicianTask.findFirst({
        where: { id, userId: session.user.id },
      })

      if (!existing) {
        return { status: 404, body: { error: "Not found" } }
      }

      const data: Record<string, unknown> = { ...parsed.data }

      if (parsed.data.status === "COMPLETED") {
        data.completedAt = new Date()
        data.status = ClinicianTaskStatus.COMPLETED
      } else if (parsed.data.status) {
        data.status = ClinicianTaskStatus[parsed.data.status]
      }

      const ingestionService = new PrismaTransactionalHealthEventIngestionService(db)
      const eventContext = buildApiCanonicalEventContext(session, request)

      const { result: updated } = await ingestionService.ingestMutation(async (tx) => {
        const updated = await tx.clinicianTask.update({ where: { id }, data })

        return {
          result: updated,
          event: clinicianTaskRecordToEvent(updated, eventContext),
        }
      })

      await logAudit({
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? undefined,
        action: "clinician_task.updated",
        entityType: "clinician_task",
        entityId: id,
        details: parsed.data,
      })

      return { status: 200, body: { id: updated.id, status: updated.status } }
    },
  })
}
