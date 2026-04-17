import { UserRole } from '@prisma/client'
import type { Session } from 'next-auth'

import type { CanonicalEventContext } from '@/lib/events/ingestion'
import { deriveTenantContext } from '@/lib/tenancy'

function createCorrelationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function resolveActorType(role: UserRole | undefined): CanonicalEventContext['actor']['type'] {
  if (role === 'CLINICIAN') {
    return 'clinician'
  }

  return 'user'
}

export function buildApiCanonicalEventContext(
  session: Session,
  request: Request,
  overrides: Partial<CanonicalEventContext> = {}
): CanonicalEventContext {
  const tenantContext = deriveTenantContext({ sessionUser: session.user, request })

  return {
    tenantId: overrides.tenantId ?? tenantContext.tenantId,
    actor: overrides.actor ?? {
      id: session.user.id,
      type: resolveActorType(session.user.role),
      displayName: session.user.name ?? undefined,
      role: session.user.role,
    },
    provenance: overrides.provenance ?? {
      sourceSystem: 'api',
    },
    trace: overrides.trace ?? {
      correlationId: request.headers.get('x-correlation-id') ?? createCorrelationId(),
    },
    privacyLevel: overrides.privacyLevel,
    tags: overrides.tags,
  }
}