import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

beforeEach(() => {
  fetchMock.mockReset()
  delete process.env.OPENAI_API_KEY
  delete process.env.LAB_OCR_PROVIDER
  delete process.env.LAB_OCR_OPENAI_MODEL
  vi.resetModules()
})

afterEach(() => {
  delete process.env.OPENAI_API_KEY
  delete process.env.LAB_OCR_PROVIDER
})

describe('lab-report-ocr', () => {
  it('rejects unsupported MIME types', async () => {
    const { extractLabReportText, OcrError } = await import('@/lib/agents/lab-report-ocr')
    await expect(
      extractLabReportText({ bytes: PNG_BYTES, mimeType: 'application/zip' }),
    ).rejects.toBeInstanceOf(OcrError)
  })

  it('rejects empty payloads', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const { extractLabReportText, OcrError } = await import('@/lib/agents/lab-report-ocr')
    await expect(
      extractLabReportText({ bytes: new Uint8Array(), mimeType: 'image/png' }),
    ).rejects.toBeInstanceOf(OcrError)
  })

  it('returns noop error when no provider is configured', async () => {
    const { extractLabReportText } = await import('@/lib/agents/lab-report-ocr')
    await expect(
      extractLabReportText({ bytes: PNG_BYTES, mimeType: 'image/png' }),
    ).rejects.toThrow(/not configured/i)
  })

  it('rejects PDFs for the openai-vision provider with a clear hint', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const { extractLabReportText } = await import('@/lib/agents/lab-report-ocr')
    await expect(
      extractLabReportText({ bytes: PNG_BYTES, mimeType: 'application/pdf' }),
    ).rejects.toThrow(/Convert PDFs to PNG\/JPEG/i)
  })

  it('calls OpenAI vision and returns the transcribed text', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.LAB_OCR_OPENAI_MODEL = 'gpt-4o-mini'
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Glucose: 92 mg/dL\nHbA1c: 5.4 %' } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const { extractLabReportText } = await import('@/lib/agents/lab-report-ocr')
    const result = await extractLabReportText({ bytes: PNG_BYTES, mimeType: 'image/png' })

    expect(result.provider).toBe('openai-vision')
    expect(result.modelVersion).toBe('gpt-4o-mini')
    expect(result.text).toContain('Glucose')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string)
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.messages[0].content[1].type).toBe('image_url')
    expect(body.messages[0].content[1].image_url.url).toMatch(/^data:image\/png;base64,/)
  })

  it('wraps non-2xx OpenAI responses in OcrError', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }))
    const { extractLabReportText, OcrError } = await import('@/lib/agents/lab-report-ocr')
    await expect(
      extractLabReportText({ bytes: PNG_BYTES, mimeType: 'image/png' }),
    ).rejects.toBeInstanceOf(OcrError)
  })
})
