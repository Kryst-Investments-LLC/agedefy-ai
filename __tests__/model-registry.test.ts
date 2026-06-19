import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// model-registry — unit tests
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  sidecarConfigured: vi.fn(),
  sidecarHealth: vi.fn(),
  logAudit: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('@/lib/sidecars', () => ({
  mechanisticSidecar: {
    configured: mocks.sidecarConfigured,
    health: mocks.sidecarHealth,
  },
}))

vi.mock('@/lib/audit', () => ({
  logAudit: mocks.logAudit,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: vi.fn() },
}))

import {
  getCurrentModelVersion,
  invalidateModelVersionCache,
  isNewerVersion,
  recordModelVersionChange,
} from '@/lib/agents/model-registry'

describe('getCurrentModelVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateModelVersionCache()
  })

  it('returns fallback version when sidecar is not configured', async () => {
    mocks.sidecarConfigured.mockReturnValue(false)
    const version = await getCurrentModelVersion()
    expect(version).toContain('fallback-exponential')
    expect(version).toContain('priors-')
    expect(version).toContain('schema-')
  })

  it('includes sidecar version when sidecar is configured', async () => {
    mocks.sidecarConfigured.mockReturnValue(true)
    mocks.sidecarHealth.mockResolvedValue({ version: 'mechanistic-sidecar@1.2.3', status: 'ok' })
    const version = await getCurrentModelVersion()
    expect(version).toContain('mechanistic-sidecar@1.2.3')
  })

  it('uses "unreachable" when sidecar health check fails', async () => {
    mocks.sidecarConfigured.mockReturnValue(true)
    mocks.sidecarHealth.mockRejectedValue(new Error('timeout'))
    const version = await getCurrentModelVersion()
    expect(version).toContain('mechanistic@unreachable')
  })

  it('caches the version and does not re-query within TTL', async () => {
    mocks.sidecarConfigured.mockReturnValue(true)
    mocks.sidecarHealth.mockResolvedValue({ version: 'sidecar@v2', status: 'ok' })

    const v1 = await getCurrentModelVersion()
    const v2 = await getCurrentModelVersion()

    expect(v1).toBe(v2)
    expect(mocks.sidecarHealth).toHaveBeenCalledOnce()
  })

  it('re-queries after cache is invalidated', async () => {
    mocks.sidecarConfigured.mockReturnValue(true)
    mocks.sidecarHealth
      .mockResolvedValueOnce({ version: 'sidecar@v1', status: 'ok' })
      .mockResolvedValueOnce({ version: 'sidecar@v2', status: 'ok' })

    await getCurrentModelVersion()
    invalidateModelVersionCache()
    const v2 = await getCurrentModelVersion()

    expect(v2).toContain('sidecar@v2')
    expect(mocks.sidecarHealth).toHaveBeenCalledTimes(2)
  })
})

describe('isNewerVersion', () => {
  it('returns true when a is lexicographically after b', () => {
    expect(isNewerVersion('sidecar@v2+priors-2.0+schema-5.0', 'sidecar@v1+priors-2.0+schema-5.0')).toBe(true)
  })

  it('returns false when a is older than b', () => {
    expect(isNewerVersion('sidecar@v1+priors-1.0+schema-4.0', 'sidecar@v2+priors-2.0+schema-5.0')).toBe(false)
  })
})

describe('recordModelVersionChange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateModelVersionCache()
  })

  it('calls logAudit with the expected fields', async () => {
    mocks.sidecarConfigured.mockReturnValue(false)
    mocks.logAudit.mockResolvedValue(undefined)

    await recordModelVersionChange('old-version', 'prior_update', 'system')

    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'model.version.changed',
        entityType: 'ModelRegistry',
        details: expect.objectContaining({
          previousVersion: 'old-version',
          reason: 'prior_update',
        }),
      }),
    )
  })

  it('does not throw when logAudit fails', async () => {
    mocks.sidecarConfigured.mockReturnValue(false)
    mocks.logAudit.mockRejectedValue(new Error('audit DB down'))
    await expect(recordModelVersionChange('old', 'sidecar_upgrade')).resolves.toBeUndefined()
    expect(mocks.loggerWarn).toHaveBeenCalled()
  })
})
