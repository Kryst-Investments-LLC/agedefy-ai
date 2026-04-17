import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getNonPasswordAuthHash } from '@/lib/auth-password'

const envMock = { ENABLE_TEST_AUTH_ENDPOINT: 'true' as 'true' | 'false' | undefined }
const findUniqueMock = vi.fn()
const compareMock = vi.fn()
const encodeMock = vi.fn()

vi.mock('@/lib/env', () => ({
  env: envMock,
}))

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: compareMock,
  },
}))

vi.mock('next-auth/jwt', () => ({
  encode: encodeMock,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {
    secret: 'test-secret-with-sufficient-length-12345',
  },
}))

function buildRequest(body: string) {
  return new NextRequest('http://localhost:3000/api/auth/jwt-for-tests', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body,
  })
}

function expectNoStoreHeaders(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('pragma')).toBe('no-cache')
}

describe('POST /api/auth/jwt-for-tests', () => {
  beforeEach(() => {
    envMock.ENABLE_TEST_AUTH_ENDPOINT = 'true'
    findUniqueMock.mockReset()
    compareMock.mockReset()
    encodeMock.mockReset()
  })

  it('returns 403 when the endpoint flag is disabled', async () => {
    envMock.ENABLE_TEST_AUTH_ENDPOINT = 'false'
    const { POST } = await import('@/app/api/auth/jwt-for-tests/route')

    const response = await POST(buildRequest(JSON.stringify({ email: 'user@example.com', password: 'securepassword1' })))

    expect(response.status).toBe(403)
    expectNoStoreHeaders(response)
    await expect(response.json()).resolves.toEqual({ error: 'Test auth endpoint is disabled' })
  })

  it('returns 400 when the request body is invalid JSON', async () => {
    const { POST } = await import('@/app/api/auth/jwt-for-tests/route')

    const response = await POST(buildRequest('{'))

    expect(response.status).toBe(400)
    expectNoStoreHeaders(response)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
  })

  it('returns 400 when the credentials payload is malformed', async () => {
    const { POST } = await import('@/app/api/auth/jwt-for-tests/route')

    const response = await POST(
      buildRequest(JSON.stringify({ email: 'not-an-email', password: '' })),
    )

    expect(response.status).toBe(400)
  expectNoStoreHeaders(response)
    const payload = await response.json()
    expect(payload.error).toBe('Invalid credentials payload')
    expect(payload.details.fieldErrors.email).toBeDefined()
    expect(payload.details.fieldErrors.password).toBeDefined()
  })

  it('returns 401 when the user does not exist', async () => {
    findUniqueMock.mockResolvedValue(null)
    const { POST } = await import('@/app/api/auth/jwt-for-tests/route')

    const response = await POST(
      buildRequest(JSON.stringify({ email: 'missing@example.com', password: 'securepassword1' })),
    )

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { email: 'missing@example.com' } })
    expect(response.status).toBe(401)
    expectNoStoreHeaders(response)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid credentials' })
  })

  it('returns 401 when the password is invalid', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'user_1',
      email: 'user@example.com',
      name: 'User',
      role: 'MEMBER',
      passwordHash: 'stored-hash',
    })
    compareMock.mockResolvedValue(false)
    const { POST } = await import('@/app/api/auth/jwt-for-tests/route')

    const response = await POST(
      buildRequest(JSON.stringify({ email: 'user@example.com', password: 'securepassword1' })),
    )

    expect(compareMock).toHaveBeenCalledWith('securepassword1', 'stored-hash')
    expect(response.status).toBe(401)
    expectNoStoreHeaders(response)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid credentials' })
  })

  it('returns 401 without invoking bcrypt for non-password auth accounts', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'user_1',
      email: 'user@example.com',
      name: 'User',
      role: 'MEMBER',
      passwordHash: getNonPasswordAuthHash('OIDC'),
    })
    const { POST } = await import('@/app/api/auth/jwt-for-tests/route')

    const response = await POST(
      buildRequest(JSON.stringify({ email: 'user@example.com', password: 'securepassword1' })),
    )

    expect(compareMock).not.toHaveBeenCalled()
    expect(response.status).toBe(401)
    expectNoStoreHeaders(response)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid credentials' })
  })

  it('returns a signed JWT for valid credentials', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'user_1',
      email: 'user@example.com',
      name: 'User',
      role: 'MEMBER',
      passwordHash: 'stored-hash',
    })
    compareMock.mockResolvedValue(true)
    encodeMock.mockResolvedValue('signed-jwt-token')
    const { POST } = await import('@/app/api/auth/jwt-for-tests/route')

    const response = await POST(
      buildRequest(JSON.stringify({ email: 'USER@example.com', password: 'securepassword1' })),
    )

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { email: 'user@example.com' } })
    expect(encodeMock).toHaveBeenCalledWith({
      token: {
        sub: 'user_1',
        email: 'user@example.com',
        name: 'User',
        role: 'MEMBER',
      },
      secret: 'test-secret-with-sufficient-length-12345',
    })
    expect(response.status).toBe(200)
    expectNoStoreHeaders(response)
    await expect(response.json()).resolves.toEqual({ token: 'signed-jwt-token' })
  })
})