import type { Session } from 'next-auth'
import { z } from 'zod'

import { enqueueOrchestrationJob } from '@/lib/jobs/queue'
import type { RequestContext } from '@/lib/observability/request-context'
import type { aiGovernanceAuditJobPayloadSchema } from '@/lib/validators/jobs'

type GovernedAIAuditPayload = z.infer<typeof aiGovernanceAuditJobPayloadSchema>

type EnqueueGovernedAIAuditJobInput = {
  requestContext: RequestContext
  sessionUser?: Session['user']
  outcome: 'success' | 'rejected' | 'error'
  payload: GovernedAIAuditPayload
}

export async function enqueueGovernedAIAuditJob(input: EnqueueGovernedAIAuditJobInput) {
  return enqueueOrchestrationJob({
    tenantId: input.requestContext.tenantId,
    organizationId: input.requestContext.organizationId,
    queue: 'AI',
    jobType: 'ai.governance.audit',
    createdByUserId: input.sessionUser?.id,
    requestId: input.requestContext.requestId,
    dedupeKey: `ai-audit:${input.requestContext.requestId}:${input.outcome}`,
    payload: input.payload,
  })
}