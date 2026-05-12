import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
  process.env.VC_SIGNER_URL = 'http://vc.test'
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('vcSigner revocation client', () => {
  it('status() GETs /v1/status/:id and returns parsed body', async () => {
    const { vcSigner } = await import('@/lib/sidecars')
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'urn:uuid:abc', revoked: false }))

    const result = await vcSigner.status('urn:uuid:abc')

    expect(result).toEqual({ id: 'urn:uuid:abc', revoked: false })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://vc.test/v1/status/urn%3Auuid%3Aabc')
    expect(init?.method ?? 'GET').toBe('GET')
  })

  it('revoke() POSTs the id', async () => {
    const { vcSigner } = await import('@/lib/sidecars')
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'urn:uuid:xyz', status: 'revoked' }))

    const result = await vcSigner.revoke('urn:uuid:xyz', '00-tp-1')

    expect(result.status).toBe('revoked')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://vc.test/v1/revoke')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ id: 'urn:uuid:xyz' })
    expect((init?.headers as Record<string, string>).traceparent).toBe('00-tp-1')
  })

  it('revocations() GETs /v1/revocations and returns the list', async () => {
    const { vcSigner } = await import('@/lib/sidecars')
    fetchMock.mockResolvedValueOnce(jsonResponse({ revoked: ['urn:uuid:a', 'urn:uuid:b'] }))

    const result = await vcSigner.revocations()

    expect(result.revoked).toEqual(['urn:uuid:a', 'urn:uuid:b'])
  })

  it('status() throws SidecarError on non-2xx', async () => {
    const { vcSigner, SidecarError } = await import('@/lib/sidecars')
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))

    await expect(vcSigner.status('urn:uuid:bad')).rejects.toBeInstanceOf(SidecarError)
  })
})
