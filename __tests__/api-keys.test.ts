import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// API Key Manager — unit tests
// ---------------------------------------------------------------------------

// We test the exportable functions at the module boundary.
// DB calls are mocked since these are unit tests.

describe('API Key Manager exports', () => {
  it('exports generateAPIKey function', async () => {
    const mod = await import('@/lib/api-keys/manager')
    expect(typeof mod.generateAPIKey).toBe('function')
  })

  it('exports validateAPIKey function', async () => {
    const mod = await import('@/lib/api-keys/manager')
    expect(typeof mod.validateAPIKey).toBe('function')
  })

  it('exports revokeAPIKey function', async () => {
    const mod = await import('@/lib/api-keys/manager')
    expect(typeof mod.revokeAPIKey).toBe('function')
  })

  it('exports rotateAPIKey function', async () => {
    const mod = await import('@/lib/api-keys/manager')
    expect(typeof mod.rotateAPIKey).toBe('function')
  })

  it('exports listAPIKeys function', async () => {
    const mod = await import('@/lib/api-keys/manager')
    expect(typeof mod.listAPIKeys).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// API Key Middleware — unit tests
// ---------------------------------------------------------------------------

describe('API Key Middleware exports', () => {
  it('exports authenticateAPIKey function', async () => {
    const mod = await import('@/lib/api-keys/middleware')
    expect(typeof mod.authenticateAPIKey).toBe('function')
  })

  it('exports requireScope function', async () => {
    const mod = await import('@/lib/api-keys/middleware')
    expect(typeof mod.requireScope).toBe('function')
  })
})

describe('requireScope', () => {
  it('returns null when scope is present', async () => {
    const { requireScope } = await import('@/lib/api-keys/middleware')
    const ctx = {
      key: {
        id: 'key-1',
        userId: 'user-1',
        tenantId: 'default',
        scopes: ['discover', 'simulate'],
        rateLimitPerMin: 60,
        sandbox: false,
      },
    }
    expect(requireScope(ctx, 'discover')).toBeNull()
  })

  it('returns 403 response when scope is missing', async () => {
    const { requireScope } = await import('@/lib/api-keys/middleware')
    const ctx = {
      key: {
        id: 'key-1',
        userId: 'user-1',
        tenantId: 'default',
        scopes: ['discover'],
        rateLimitPerMin: 60,
        sandbox: false,
      },
    }
    const result = requireScope(ctx, 'virtual-twin')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// Usage Metering — unit tests
// ---------------------------------------------------------------------------

describe('Usage Metering exports', () => {
  it('exports recordUsage function', async () => {
    const mod = await import('@/lib/api-keys/metering')
    expect(typeof mod.recordUsage).toBe('function')
  })

  it('exports getUsageSummary function', async () => {
    const mod = await import('@/lib/api-keys/metering')
    expect(typeof mod.getUsageSummary).toBe('function')
  })

  it('exports getUserUsageSummary function', async () => {
    const mod = await import('@/lib/api-keys/metering')
    expect(typeof mod.getUserUsageSummary).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Sandbox — unit tests
// ---------------------------------------------------------------------------

describe('Sandbox responses', () => {
  it('returns sandbox discover response with warning', async () => {
    const { sandboxDiscoverResponse } = await import('@/lib/api-keys/sandbox')
    const result = sandboxDiscoverResponse('test prompt')
    expect(result.status).toBe('success')
    expect(result.modelVersion).toBe('sandbox-v1')
    expect(result.candidates).toHaveLength(1)
    expect(result.warnings).toBeDefined()
    expect(result.warnings!.some((w) => w.includes('sandbox'))).toBe(true)
    expect(result.disclaimers).toBeDefined()
    expect(result.disclaimers.length).toBeGreaterThan(0)
  })

  it('returns sandbox simulate response', async () => {
    const { sandboxSimulateResponse } = await import('@/lib/api-keys/sandbox')
    const result = sandboxSimulateResponse()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].type).toBe('virtual_cell')
    expect(typeof result[0].confidence).toBe('number')
  })

  it('returns sandbox virtual-twin response with all 9 hallmarks', async () => {
    const { sandboxVirtualTwinResponse } = await import('@/lib/api-keys/sandbox')
    const result = sandboxVirtualTwinResponse()
    expect(typeof result.biologicalAge).toBe('number')
    const hallmarks = result.hallmarkResponsePredictions
    expect(Object.keys(hallmarks)).toHaveLength(9)
    for (const value of Object.values(hallmarks)) {
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

// ---------------------------------------------------------------------------
// OpenAPI spec — structure test
// ---------------------------------------------------------------------------

describe('OpenAPI spec structure', () => {
  it('serves a valid OpenAPI 3.1 spec', async () => {
    // Import the route handler and call GET
    const mod = await import('@/app/api/v1/openapi.json/route')
    const response = await mod.GET()
    expect(response.status).toBe(200)

    const spec = await response.json()
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toContain('ÆonForge')
    expect(spec.paths).toBeDefined()
    expect(spec.paths['/api/v1/aeonforge/discover']).toBeDefined()
    expect(spec.paths['/api/v1/aeonforge/simulate']).toBeDefined()
    expect(spec.paths['/api/v1/aeonforge/virtual-twin']).toBeDefined()
    expect(spec.paths['/api/v1/auth/keys']).toBeDefined()
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined()
  })
})
