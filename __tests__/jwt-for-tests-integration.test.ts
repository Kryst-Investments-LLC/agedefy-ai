import bcrypt from 'bcryptjs'
import { describe, expect, it } from 'vitest'
import { request } from 'undici'

import { db } from '@/lib/db'

type JwtForTestsResponse = {
  token?: string
}
const testServerBaseUrl = process.env.TEST_SERVER_BASE_URL ?? 'http://127.0.0.1:3101'

describe('Live /api/auth/jwt-for-tests', () => {
  it.skip('returns no-store headers when enabled', async () => {
    const email = 'live-jwt-test@example.com'
    const password = 'TestPass123!'
    const passwordHash = await bcrypt.hash(password, 12)

    await db.user.upsert({
      where: { email },
      update: {
        name: 'Live JWT Test',
        passwordHash,
      },
      create: {
        email,
        name: 'Live JWT Test',
        passwordHash,
      },
    })

    const response = await request(`${testServerBaseUrl}/api/auth/jwt-for-tests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers.pragma).toBe('no-cache')

    const payload = await response.body.json() as JwtForTestsResponse
    expect(payload.token).toEqual(expect.any(String))
  }, 15000)
})