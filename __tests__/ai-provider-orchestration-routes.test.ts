import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getServerSessionMock,
  applyRateLimitMock,
  executeWithCircuitBreakerMock,
  enqueueGovernedAIAuditJobMock,
  getAIConfigMock,
  assertGovernedAIRequestMock,
  estimateAICreditCostMock,
  runWithReservedAICreditsMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  applyRateLimitMock: vi.fn(),
  executeWithCircuitBreakerMock: vi.fn(),
  enqueueGovernedAIAuditJobMock: vi.fn(),
  getAIConfigMock: vi.fn(),
  assertGovernedAIRequestMock: vi.fn(),
  estimateAICreditCostMock: vi.fn(),
  runWithReservedAICreditsMock: vi.fn(),
}))

vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/rate-limit', () => ({
  applyRateLimit: applyRateLimitMock,
}))

vi.mock('@/lib/circuit-breaker', () => ({
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {
    dependency = 'test'
  },
  executeWithCircuitBreaker: executeWithCircuitBreakerMock,
}))

vi.mock('@/lib/config/ai-config', () => ({
  getAIConfig: getAIConfigMock,
}))

vi.mock('@/lib/ai/governance', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/governance')>('@/lib/ai/governance')
  return {
    ...actual,
    assertGovernedAIRequest: assertGovernedAIRequestMock,
  }
})

vi.mock('@/lib/ai-credits', () => ({
  AICreditLimitError: class AICreditLimitError extends Error {
    status: number
    requestedCredits: number
    snapshot: Record<string, unknown>

    constructor(requestedCredits: number, snapshot: Record<string, unknown>) {
      super('Insufficient AI credits. Upgrade your subscription or purchase a top-up pack.')
      this.name = 'AICreditLimitError'
      this.status = 402
      this.requestedCredits = requestedCredits
      this.snapshot = snapshot
    }
  },
  estimateAICreditCost: estimateAICreditCostMock,
  runWithReservedAICredits: runWithReservedAICreditsMock,
  serializeAICreditLimitError: vi.fn((error: { message: string; requestedCredits: number }) => ({
    error: error.message,
    requestedCredits: error.requestedCredits,
  })),
}))

vi.mock('@/lib/jobs/ai-governance', () => ({
  enqueueGovernedAIAuditJob: enqueueGovernedAIAuditJobMock,
}))

vi.mock('@/lib/consent', () => ({
  requireGdprConsent: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/idempotency', async () => {
  const { NextResponse } = await import('next/server')

  return {
    createIdempotencyFingerprint: vi.fn(() => 'test-fingerprint'),
    executeRouteIdempotentJsonMutation: vi.fn(async ({ request, execute }: { request: Request; execute: () => Promise<{ status: number; body: unknown }> }) => {
      if (!request.headers.get('idempotency-key')) {
        return NextResponse.json(
          { error: 'Idempotency-Key header is required for this mutation route.' },
          { status: 400, headers: { 'Idempotency-Key-Required': 'true' } },
        )
      }

      const result = await execute()
      return NextResponse.json(result.body, { status: result.status })
    }),
  }
})

function mockJsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(payload),
  }
}

async function expectProviderEnvelope(response: Response, provider: string) {
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.provider).toBe(provider)
  expect(body.content).toEqual(expect.any(String))
  expect(body.disclaimer).toEqual(expect.any(String))
  expect(body.disclaimers).toEqual(expect.arrayContaining([expect.any(String)]))
  expect(Array.isArray(body.citations)).toBe(true)
}

describe('AI provider orchestration routes', () => {
  beforeEach(() => {
    getServerSessionMock.mockReset()
    applyRateLimitMock.mockReset()
    executeWithCircuitBreakerMock.mockReset()
    enqueueGovernedAIAuditJobMock.mockReset()
    getAIConfigMock.mockReset()
    assertGovernedAIRequestMock.mockReset()
    estimateAICreditCostMock.mockReset()
    runWithReservedAICreditsMock.mockReset()

    getServerSessionMock.mockResolvedValue({ user: { id: 'user_1', email: 'user@example.com', role: 'ADMIN', tenantId: 'tenant_1' } })
    applyRateLimitMock.mockResolvedValue(null)
    assertGovernedAIRequestMock.mockReturnValue(undefined)
    estimateAICreditCostMock.mockReturnValue(5)
    runWithReservedAICreditsMock.mockImplementation(async ({ execute }: { execute: () => Promise<unknown> }) => execute())
    getAIConfigMock.mockReturnValue({
      providers: {
        anthropic: { enabled: true, apiKey: 'anthropic-key', model: 'claude-3-sonnet-20240229' },
        grok: { enabled: true, apiKey: 'grok-key', model: 'grok-2-latest' },
        openai: { enabled: true, apiKey: 'openai-key', model: 'gpt-4o-mini' },
      },
    })
  })

  it('queues Anthropic audit follow-up on success', async () => {
    executeWithCircuitBreakerMock.mockResolvedValue(mockJsonResponse({
      content: [{ text: JSON.stringify({
        answer: 'Anthropic response',
        disclaimer: 'Informational only. Review the cited evidence.',
        citations: [
          {
            title: 'Longevity trial review',
            source: 'Cell',
            url: 'https://example.com/longevity-trial-review',
          },
        ],
      }) }],
      usage: { input_tokens: 10, output_tokens: 20 },
    }))

    const { POST } = await import('@/app/api/ai/anthropic/route')
    const response = await POST(new NextRequest('http://localhost:3000/api/ai/anthropic', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'anthropic-success-1',
      },
      body: JSON.stringify({ query: 'longevity science', maxResults: 1 }),
    }))

    await expectProviderEnvelope(response, 'Anthropic')
    expect(enqueueGovernedAIAuditJobMock).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'success',
      payload: expect.objectContaining({ provider: 'anthropic' }),
    }))
  })

  it('queues Grok audit follow-up on success', async () => {
    executeWithCircuitBreakerMock.mockResolvedValue(mockJsonResponse({
      choices: [{ message: { content: JSON.stringify({
        answer: 'Grok response',
        disclaimer: 'Informational only. Verify against primary literature.',
        citations: [],
      }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    }))

    const { POST } = await import('@/app/api/ai/grok/route')
    const response = await POST(new NextRequest('http://localhost:3000/api/ai/grok', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'grok-success-1',
      },
      body: JSON.stringify({ query: 'longevity science', maxResults: 1 }),
    }))

    await expectProviderEnvelope(response, 'Grok')
    expect(enqueueGovernedAIAuditJobMock).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'success',
      payload: expect.objectContaining({ provider: 'grok' }),
    }))
  })

  it('returns the structured provider envelope for OpenAI success', async () => {
    executeWithCircuitBreakerMock.mockResolvedValue(mockJsonResponse({
      choices: [{ message: { content: JSON.stringify({
        answer: 'OpenAI response',
        disclaimer: 'Informational only. This is not medical advice.',
        citations: [
          {
            title: 'mTOR inhibition improves immune function in the elderly',
            source: 'Science Translational Medicine',
            url: 'https://example.com/mtor-study',
          },
        ],
      }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    }))

    const { POST } = await import('@/app/api/ai/openai/route')
    const response = await POST(new NextRequest('http://localhost:3000/api/ai/openai', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'openai-success-1',
      },
      body: JSON.stringify({ query: 'longevity science', maxResults: 1 }),
    }))

    await expectProviderEnvelope(response, 'OpenAI')
  })

  it('queues Anthropic audit follow-up on governance rejection', async () => {
    const { AIGovernanceError } = await import('@/lib/ai/governance')
    assertGovernedAIRequestMock.mockImplementation(() => {
      throw new AIGovernanceError('Anthropic request rejected', 403)
    })

    const { POST } = await import('@/app/api/ai/anthropic/route')
    const response = await POST(new NextRequest('http://localhost:3000/api/ai/anthropic', {
      method: 'POST',
      body: JSON.stringify({ query: 'longevity science', maxResults: 1 }),
    }))

    expect(response.status).toBe(403)
    expect(executeWithCircuitBreakerMock).not.toHaveBeenCalled()
    expect(enqueueGovernedAIAuditJobMock).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'rejected',
      payload: expect.objectContaining({ provider: 'anthropic', outcome: 'rejected' }),
    }))
  })

  it('queues Grok audit follow-up on governance rejection', async () => {
    const { AIGovernanceError } = await import('@/lib/ai/governance')
    assertGovernedAIRequestMock.mockImplementation(() => {
      throw new AIGovernanceError('Grok request rejected', 403)
    })

    const { POST } = await import('@/app/api/ai/grok/route')
    const response = await POST(new NextRequest('http://localhost:3000/api/ai/grok', {
      method: 'POST',
      body: JSON.stringify({ query: 'longevity science', maxResults: 1 }),
    }))

    expect(response.status).toBe(403)
    expect(executeWithCircuitBreakerMock).not.toHaveBeenCalled()
    expect(enqueueGovernedAIAuditJobMock).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'rejected',
      payload: expect.objectContaining({ provider: 'grok', outcome: 'rejected' }),
    }))
  })

  it('returns 402 when the caller has insufficient AI credits', async () => {
    const { AICreditLimitError } = await import('@/lib/ai-credits')
    runWithReservedAICreditsMock.mockRejectedValue(new AICreditLimitError(5, {
      activeSubscriptionPlan: 'core',
      activeSubscriptionStatus: 'ACTIVE',
      includedCreditsTotal: 250,
      includedCreditsConsumed: 250,
      includedCreditsRemaining: 0,
      purchasedCreditsPurchased: 0,
      purchasedCreditsConsumed: 0,
      purchasedCreditsRemaining: 0,
      pendingReservedCredits: 0,
      enterprisePoolEnabled: false,
      totalCreditsAvailable: 0,
      monthStart: '2026-04-01T00:00:00.000Z',
      nextResetAt: '2026-05-01T00:00:00.000Z',
    }))

    const { POST } = await import('@/app/api/ai/openai/route')
    const response = await POST(new NextRequest('http://localhost:3000/api/ai/openai', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'openai-no-credits-1',
      },
      body: JSON.stringify({ query: 'longevity science', maxResults: 1 }),
    }))

    expect(response.status).toBe(402)
    expect(executeWithCircuitBreakerMock).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ requestedCredits: 5 })
  })
})