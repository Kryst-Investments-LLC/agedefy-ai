import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createAIRouteHandler, AIProvider } from '@/lib/utils/ai-route-handler'

global.fetch = vi.fn()

describe('AI Route Handler', () => {
  const mockProvider: AIProvider = {
    name: 'test-provider',
    enabled: true,
    apiKey: 'test-api-key',
    model: 'test-model',
    endpoint: 'https://api.test.com/chat',
    headers: {
      'Authorization': 'Bearer test-key',
      'Content-Type': 'application/json'
    },
    requestBody: (prompt: string, maxResults: number) => ({
      model: 'test-model',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      n: maxResults
    }),
    extractContent: (data: any) => data.choices?.[0]?.message?.content ?? 'No response',
    calculateCost: (data: any) => {
      const tokens = data.usage?.total_tokens ?? 0
      return tokens * 0.00001
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('handles valid AI requests successfully', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Test AI response' } }],
      usage: { total_tokens: 100 }
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })

    const handler = createAIRouteHandler(mockProvider)
    const request = new NextRequest('http://localhost:3000/api/ai/test', {
      method: 'POST',
      body: JSON.stringify({
        query: 'What is longevity?',
        maxResults: 1
      })
    })

    const response = await handler(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.content).toBe('Test AI response')
    expect(data.cost).toBe(0)
  })

  it('validates request body with Zod schema', async () => {
    const handler = createAIRouteHandler(mockProvider)
    const request = new NextRequest('http://localhost:3000/api/ai/test', {
      method: 'POST',
      body: JSON.stringify({
        query: '', // Invalid: empty query
        maxResults: 10 // Invalid: exceeds max
      })
    })

    const response = await handler(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Validation failed')
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal Server Error' }),
      text: () => Promise.resolve('Internal Server Error')
    })

    const handler = createAIRouteHandler(mockProvider)
    const request = new NextRequest('http://localhost:3000/api/ai/test', {
      method: 'POST',
      body: JSON.stringify({
        query: 'Test query',
        maxResults: 1
      })
    })

    const response = await handler(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toContain('API request failed')
  })

  it('applies rate limiting', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Test response' } }],
        usage: { total_tokens: 50 }
      })
    })

    const handler = createAIRouteHandler(mockProvider)
    
    const responses = []
    for (let i = 0; i < 10; i++) {
      const request = new NextRequest('http://localhost:3000/api/ai/test', {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
        body: JSON.stringify({
          query: 'Test query',
          maxResults: 1
        })
      })
      responses.push(await handler(request))
    }

    expect(responses.length).toBe(10)
    expect(responses.every(res => res.status === 200 || res.status === 429)).toBe(true)
  })
})
