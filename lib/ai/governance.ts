import type { UserRole } from "@prisma/client"

import { logAudit } from "@/lib/audit"
import { env } from "@/lib/env"

export type GovernedAIProvider = "openai" | "anthropic" | "grok" | "aeonforge"

export class AIGovernanceError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "AIGovernanceError"
    this.status = status
  }
}

export type AIGovernanceActor = {
  userId?: string
  userEmail?: string | null
  role?: UserRole | string
  tenantId?: string
  organizationId?: string
}

export type GovernedAIRequest = {
  provider: GovernedAIProvider
  model: string
  route: string
  requestId: string
  queryLength: number
  maxResults?: number
  tenantId: string
  organizationId?: string
  actor: AIGovernanceActor
  promptVersion?: string
  modelVersion?: string
}

export function parseAllowedAIModels(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  )
}

export function getAIGovernanceSettings() {
  const allowedModels = parseAllowedAIModels(env.AI_ALLOWED_MODELS)

  return {
    aiRequireAuth: env.AI_REQUIRE_AUTH !== "false",
    governanceEnforced: env.AI_GOVERNANCE_ENFORCED !== "false",
    allowedModels,
    defaultTenantId: env.DEFAULT_TENANT_ID,
  }
}

export function assertGovernedAIRequest(request: GovernedAIRequest) {
  const settings = getAIGovernanceSettings()

  if (settings.aiRequireAuth && !request.actor.userId) {
    throw new AIGovernanceError("Authentication is required for AI requests.", 401)
  }

  if (settings.governanceEnforced && settings.allowedModels.length > 0 && !settings.allowedModels.includes(request.model)) {
    throw new AIGovernanceError(`Model ${request.model} is not approved for governed AI execution.`, 403)
  }
}

export async function auditGovernedAIRequest(request: GovernedAIRequest & { outcome: "success" | "rejected" | "error"; providerRequestCostUsd?: number }) {
  await logAudit({
    actorUserId: request.actor.userId,
    actorEmail: request.actor.userEmail ?? undefined,
    action: `ai.query.${request.outcome}`,
    entityType: "ai_request",
    entityId: request.requestId,
    details: {
      provider: request.provider,
      model: request.model,
      route: request.route,
      requestId: request.requestId,
      tenantId: request.tenantId,
      organizationId: request.organizationId,
      queryLength: request.queryLength,
      maxResults: request.maxResults,
      actorRole: request.actor.role,
      providerRequestCostUsd: request.providerRequestCostUsd,
      promptVersion: request.promptVersion,
      modelVersion: request.modelVersion,
    },
    tenantId: request.tenantId,
  })
}