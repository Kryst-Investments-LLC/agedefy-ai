import type { NextRequest } from "next/server"

import { deleteEntity, getEntity, updateEntity } from "@/scientist-sponsor-marketplace/backend/controllers/entityController"

export async function GET(request: NextRequest, context: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await context.params
  return getEntity(request, entity, id)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await context.params
  return updateEntity(request, entity, id)
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await context.params
  return deleteEntity(request, entity, id)
}
