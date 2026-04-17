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
import { applyRateLimit } from '@/lib/rate-limit'
import { aiQuerySchema } from '@/lib/validators/ai'
import { buildUserClinicalContext, renderClinicalContextPrompt } from '@/lib/ai/clinical-context'

export async function POST(request: NextRequest) {
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
    
    if (!config.providers.grok.enabled) {
      return withRequestContextHeaders(NextResponse.json(
        { error: 'Grok is not enabled' },
        { status: 400 }
      ), requestContext)
    }

    if (!config.providers.grok.apiKey) {
      return withRequestContextHeaders(NextResponse.json(
        { error: 'Grok API key not configured' },
        { status: 500 }
      ), requestContext)
    }

    const payload = await request.json()
    const parsedPayload = aiQuerySchema.safeParse(payload)

    if (!parsedPayload.success) {
      return withRequestContextHeaders(NextResponse.json({ error: 'Invalid AI request payload' }, { status: 400 }), requestContext)
    }

    const { query, context, maxResults } = parsedPayload.data
  const requestedCredits = estimateAICreditCost({ operation: 'grok-query', maxResults })

    assertGovernedAIRequest({
      provider: 'grok',
      model: config.providers.grok.model,
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

    logRequestEvent('info', 'Governed Grok request started', requestContext, {
      actorUserId: session?.user?.id,
      model: config.providers.grok.model,
      maxResults,
    })

    return await executeRouteIdempotentJsonMutation({
      request,
      tenantId: requestContext.tenantId,
      actorUserId: session.user.id,
      requestFingerprint: createIdempotencyFingerprint({ provider: 'grok', userId: session.user.id, payload: parsedPayload.data }),
      execute: async () => {
        return runWithReservedAICredits({
          userId: session.user.id,
          tenantId: requestContext.tenantId,
          requestedCredits,
          operation: 'grok-query',
          route: requestContext.path,
          provider: 'grok',
          model: config.providers.grok.model,
          description: 'Grok governed query',
          metadata: {
            requestId: requestContext.requestId,
            maxResults,
          },
          shouldFinalize: (result) => result.status < 400,
          execute: async () => {
            const startTime = Date.now()
            aiRequestCounter.add(1, { provider: 'grok', model: config.providers.grok.model })

            return withSpan('ai.provider.grok', { 'ai.provider': 'grok', 'ai.model': config.providers.grok.model }, async () => {
              const response = await executeWithCircuitBreaker({
                dependency: 'grok-api',
                execute: async () => {
                  const controller = new AbortController()
                  const timeoutId = setTimeout(() => controller.abort(), 30_000)
                  const providerResponse = await fetch('https://api.x.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${config.providers.grok.apiKey}`,
                      'Content-Type': 'application/json',
                      'X-Request-ID': requestContext.requestId,
                    },
                    body: JSON.stringify({
                      model: config.providers.grok.model,
                      messages: [
                        {
                          role: 'system',
                          content: providerAILongevitySystemPrompt,
                        },
                        {
                          role: 'user',
                          content: prompt,
                        },
                      ],
                      max_tokens: 1000,
                      temperature: 0.7,
                      n: maxResults,
                    }),
                    signal: controller.signal,
                  })
                  clearTimeout(timeoutId)

                  if (!providerResponse.ok && (providerResponse.status === 429 || providerResponse.status >= 500)) {
                    throw new Error(`Grok upstream request failed with status ${providerResponse.status}`)
                  }

                  return providerResponse
                },
              })

              if (!response.ok) {
                const error = await response.json()
                logRequestEvent('error', 'Grok API error', requestContext, { status: response.status, error })
                return { status: response.status, body: { error: 'Grok API request failed' } }
              }

              const data = await response.json()
              const rawContent = data.choices[0]?.message?.content || 'No response generated'

              const inputTokens = data.usage?.prompt_tokens || 0
              const outputTokens = data.usage?.completion_tokens || 0
              const cost = (inputTokens * 0.00001) + (outputTokens * 0.00003)

              aiRequestLatencyHistogram.record(Date.now() - startTime, { provider: 'grok' })
              aiRequestCostHistogram.record(cost, { provider: 'grok' })

              await enqueueGovernedAIAuditJob({
                requestContext,
                sessionUser: session.user,
                outcome: 'success',
                payload: {
                  provider: 'grok',
                  model: config.providers.grok.model,
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
                  provider: 'Grok',
                  model: config.providers.grok.model,
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
      logRequestEvent('warn', 'Grok circuit breaker open', requestContext, {
        dependency: error.dependency,
        retryAt: error.retryAt?.toISOString(),
      })
      return withRequestContextHeaders(NextResponse.json(
        { error: 'Grok is temporarily unavailable. Please retry shortly.' },
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
          provider: 'grok',
          model: getAIConfig().providers.grok.model,
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

    logRequestEvent('error', 'Grok route error', requestContext, {
      error: error instanceof Error ? error.message : String(error),
    })
    return withRequestContextHeaders(NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    ), requestContext)
  }
}