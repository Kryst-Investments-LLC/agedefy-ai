import type { NextRequest } from "next/server"

import { createEntity, listEntity } from "@/scientist-sponsor-marketplace/backend/controllers/entityController"

export async function GET(request: NextRequest, context: { params: Promise<{ entity: string }> }) {
  const { entity } = await context.params
  return listEntity(request, entity)
}

export async function POST(request: NextRequest, context: { params: Promise<{ entity: string }> }) {
  const { entity } = await context.params
  return createEntity(request, entity)
}
