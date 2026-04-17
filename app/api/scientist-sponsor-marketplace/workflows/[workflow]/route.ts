import type { NextRequest } from "next/server"

import { handleWorkflow } from "@/scientist-sponsor-marketplace/backend/controllers/workflowController"

export async function POST(request: NextRequest, context: { params: Promise<{ workflow: string }> }) {
  const { workflow } = await context.params
  return handleWorkflow(request, workflow)
}
