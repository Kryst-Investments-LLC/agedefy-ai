import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { AIGovernanceError, assertGovernedAIRequest } from '@/lib/ai/governance'
import { AICreditLimitError, estimateAICreditCost, runWithReservedAICredits, serializeAICreditLimitError } from '@/lib/ai-credits'
import { buildProviderAIResponseEnvelope, providerAILongevitySystemPrompt, providerAIResponseFormatInstructions } from '@/lib/ai/provider-response'
import { authOptions } from '@/lib/auth'
import { CircuitBreakerOpenError, executeWithCircuitBreaker } from '@/lib/circuit-breaker'
import { getAIConfig } from '@/lib/config/ai-config'
import { requireGdprConsent } from '@/lib/consent'
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency'
import { enqueueGovernedAIAuditJob } from '@/lib/jobs/ai-governance'
import { createRequestContext, logRequestEvent, withRequestContextHeaders } from '@/lib/observability/request-context'
import { aiRequestCounter, aiRequestCostHistogram, aiRequestLatencyHistogram, withSpan } from '@/lib/observability/telemetry'
import { withHttpMetrics } from '@/lib/observability/with-http-metrics'
import { applyRateLimit } from '@/lib/rate-limit'
import { aiQuerySchema } from '@/lib/validators/ai'
import { buildUserClinicalContext, renderClinicalContextPrompt } from '@/lib/ai/clinical-context'

export const POST = withHttpMetrics('/api/ai/anthropic', async (request: NextRequest) => {
  const session = await getServerSession(authOptions)
  const requestContext = createRequestContext(request, { session })
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return withRequestContextHeaders(blocked, requestContext)

  if (!session?.user?.id) {
    return withRequestContextHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), requestContext)
  }

  const consentBlocked = await requireGdprConsent(session.user.id, ['ai-health-info'])
  if (consentBlocked) return withRequestContextHeaders(consentBlocked, requestContext)

  try {
    const config = getAIConfig()
    
    if (!config.providers.anthropic.enabled) {
      return withRequestContextHeaders(NextResponse.json(
        { error: 'Anthropic is not enabled' },
        { status: 400 }
      ), requestContext)
    }

    if (!config.providers.anthropic.apiKey) {
      return withRequestContextHeaders(NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      ), requestContext)
    }

    const payload = await request.json()
    const parsedPayload = aiQuerySchema.safeParse(payload)

    if (!parsedPayload.success) {
      return withRequestContextHeaders(NextResponse.json({ error: 'Invalid AI request payload' }, { status: 400 }), requestContext)
    }

    const { query, context, maxResults } = parsedPayload.data
  const requestedCredits = estimateAICreditCost({ operation: 'anthropic-query', maxResults })

    assertGovernedAIRequest({
      provider: 'anthropic',
      model: config.providers.anthropic.model,
      route: requestContext.path,
      requestId: requestContext.requestId,
      queryLength: query.length,
      maxResults,
      tenantId: requestContext.tenantId,
      organizationId: requestContext.organizationId,
      actor: {
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        role: session?.user?.role,
        tenantId: requestContext.tenantId,
        organizationId: requestContext.organizationId,
      },
    })

    const clinicalContext = await buildUserClinicalContext(session.user.id)
    const clinicalContextBlock = renderClinicalContextPrompt(clinicalContext)

    const contextParts = [clinicalContextBlock, context].filter(Boolean).join('\n\n')
    const prompt = contextParts
      ? `Context: ${contextParts}\n\nQuery: ${query}\n\nProvide an informational, evidence-aware response focused on longevity and health research.\n\n${providerAIResponseFormatInstructions}`
      : `Query: ${query}\n\nProvide an informational, evidence-aware response focused on longevity and health research.\n\n${providerAIResponseFormatInstructions}`

    logRequestEvent('info', 'Governed Anthropic request started', requestContext, {
      actorUserId: session?.user?.id,
      model: config.providers.anthropic.model,
    })

    return await executeRouteIdempotentJsonMutation({
      request,
      tenantId: requestContext.tenantId,
      actorUserId: session.user.id,
      requestFingerprint: createIdempotencyFingerprint({ provider: 'anthropic', userId: session.user.id, payload: parsedPayload.data }),
      execute: async () => {
        return runWithReservedAICredits({
          userId: session.user.id,
          tenantId: requestContext.tenantId,
          requestedCredits,
          operation: 'anthropic-query',
          route: requestContext.path,
          provider: 'anthropic',
          model: config.providers.anthropic.model,
          description: 'Anthropic governed query',
          metadata: {
            requestId: requestContext.requestId,
            maxResults,
          },
          shouldFinalize: (result) => result.status < 400,
          execute: async () => {
            const startTime = Date.now()
            aiRequestCounter.add(1, { provider: 'anthropic', model: config.providers.anthropic.model })

            return withSpan('ai.provider.anthropic', { 'ai.provider': 'anthropic', 'ai.model': config.providers.anthropic.model }, async () => {
              const response = await executeWithCircuitBreaker({
                dependency: 'anthropic-api',
                execute: async () => {
                  const controller = new AbortController()
                  const timeoutId = setTimeout(() => controller.abort(), 30_000)
                  const providerResponse = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${config.providers.anthropic.apiKey}`,
                      'Content-Type': 'application/json',
                      'anthropic-version': '2023-06-01',
                      'X-Request-ID': requestContext.requestId,
                    },
                    body: JSON.stringify({
                      model: config.providers.anthropic.model,
                      max_tokens: 1000,
                      messages: [
                        {
                          role: 'user',
                          content: prompt,
                        },
                      ],
                      system: providerAILongevitySystemPrompt,
                    }),
                    signal: controller.signal,
                  })
                  clearTimeout(timeoutId)

                  if (!providerResponse.ok && (providerResponse.status === 429 || providerResponse.status >= 500)) {
                    throw new Error(`Anthropic upstream request failed with status ${providerResponse.status}`)
                  }

                  return providerResponse
                },
              })

              if (!response.ok) {
                const error = await response.json()
                logRequestEvent('error', 'Anthropic API error', requestContext, { status: response.status, error })
                return { status: response.status, body: { error: 'Anthropic API request failed' } }
              }

              const data = await response.json()
              const rawContent = data.content[0]?.text || 'No response generated'

              const inputTokens = data.usage?.input_tokens || 0
              const outputTokens = data.usage?.output_tokens || 0
              const cost = (inputTokens * 0.000003) + (outputTokens * 0.000015)

              aiRequestLatencyHistogram.record(Date.now() - startTime, { provider: 'anthropic' })
              aiRequestCostHistogram.record(cost, { provider: 'anthropic' })

              await enqueueGovernedAIAuditJob({
                requestContext,
                sessionUser: session.user,
                outcome: 'success',
                payload: {
                  provider: 'anthropic',
                  model: config.providers.anthropic.model,
                  route: requestContext.path,
                  requestId: requestContext.requestId,
                  queryLength: query.length,
                  maxResults,
                  tenantId: requestContext.tenantId,
                  organizationId: requestContext.organizationId,
                  outcome: 'success',
                  providerRequestCostUsd: Math.round(cost * 10000) / 10000,
                  actor: {
                    userId: session.user.id,
                    userEmail: session.user.email,
                    role: session.user.role,
                    tenantId: requestContext.tenantId,
                    organizationId: requestContext.organizationId,
                  },
                },
              })

              return {
                status: 200,
                body: buildProviderAIResponseEnvelope({
                  rawContent,
                  provider: 'Anthropic',
                  model: config.providers.anthropic.model,
                  cost,
                  usage: data.usage,
                }),
              }
            })
          },
        })
      },
    }).then((response) => withRequestContextHeaders(response, requestContext))

  } catch (error) {
    if (error instanceof AICreditLimitError) {
      return withRequestContextHeaders(NextResponse.json(
        serializeAICreditLimitError(error),
        { status: error.status }
      ), requestContext)
    }

    if (error instanceof CircuitBreakerOpenError) {
      logRequestEvent('warn', 'Anthropic circuit breaker open', requestContext, {
        dependency: error.dependency,
        retryAt: error.retryAt?.toISOString(),
      })
      return withRequestContextHeaders(NextResponse.json(
        { error: 'Anthropic is temporarily unavailable. Please retry shortly.' },
        {
          status: 503,
          headers: error.retryAt
            ? { 'Retry-After': String(Math.max(1, Math.ceil((error.retryAt.getTime() - Date.now()) / 1000))) }
            : undefined,
        }
      ), requestContext)
    }

    if (error instanceof AIGovernanceError) {
      await enqueueGovernedAIAuditJob({
        requestContext,
        sessionUser: session?.user,
        outcome: 'rejected',
        payload: {
          provider: 'anthropic',
          model: getAIConfig().providers.anthropic.model,
          route: requestContext.path,
          requestId: requestContext.requestId,
          queryLength: 0,
          tenantId: requestContext.tenantId,
          organizationId: requestContext.organizationId,
          outcome: 'rejected',
          actor: {
            userId: session?.user?.id,
            userEmail: session?.user?.email,
            role: session?.user?.role,
            tenantId: requestContext.tenantId,
            organizationId: requestContext.organizationId,
          },
        },
      })

      return withRequestContextHeaders(NextResponse.json(
        { error: error.message },
        { status: error.status }
      ), requestContext)
    }

    logRequestEvent('error', 'Anthropic route error', requestContext, {
      error: error instanceof Error ? error.message : String(error),
    })
    return withRequestContextHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ), requestContext)
  }
})
