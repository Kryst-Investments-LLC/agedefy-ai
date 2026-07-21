/**
 * Lab Report OCR (T1.15)
 *
 * Pluggable OCR layer that turns an uploaded PDF/image into raw text suitable
 * for `parseLabReportText`. Providers are selected by env so we can swap
 * implementations without touching the upload route.
 *
 * Current providers:
 *  - "openai-vision" (default when OPENAI_API_KEY is set): sends the image
 *    bytes inline to gpt-4o-mini's vision endpoint with a strict transcription
 *    prompt. Works for PNG/JPEG/WEBP/GIF. PDFs are forwarded natively via the
 *    chat-completions `type: "file"` content block (supported by gpt-4o-mini
 *    and gpt-4o), so single- and multi-page PDFs can be transcribed without a
 *    separate rasterisation step.
 *  - "noop": disabled stub that throws a clear error. Used in tests and when
 *    no provider is configured.
 *
 * No new dependencies are added; we keep the surface dependency-free so
 * adding AWS Textract / Tesseract later is a single new file.
 */

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB hard cap on the OCR payload

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

const SUPPORTED_MIME_TYPES = new Set<string>([
  ...IMAGE_MIME_TYPES,
  'application/pdf',
])

export type OcrProviderName = 'openai-vision' | 'noop'

export interface OcrExtractInput {
  bytes: Uint8Array
  mimeType: string
}

export interface OcrExtractResult {
  text: string
  provider: OcrProviderName
  modelVersion?: string
}

export class OcrError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message)
    this.name = 'OcrError'
  }
}

export function isOcrSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase())
}

export function getConfiguredOcrProvider(): OcrProviderName {
  const override = (process.env.LAB_OCR_PROVIDER ?? '').toLowerCase()
  if (override === 'openai-vision' || override === 'noop') return override
  if (process.env.OPENAI_API_KEY) return 'openai-vision'
  return 'noop'
}

const OPENAI_VISION_PROMPT = [
  'You are an OCR engine for clinical lab reports.',
  'Transcribe ALL text visible in this lab report verbatim, preserving line breaks.',
  'Include biomarker names, numeric values, units, reference ranges, flags (H/L/HIGH/LOW), lab name, and collection date.',
  'Do not summarise, do not paraphrase, do not invent values. If a token is illegible, write "[illegible]".',
  'Output ONLY the transcribed text, no preamble.',
].join(' ')

async function extractWithOpenAiVision(input: OcrExtractInput): Promise<OcrExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new OcrError('OPENAI_API_KEY is not configured', 503)
  }

  const mimeType = input.mimeType.toLowerCase()
  const isPdf = mimeType === 'application/pdf'
  if (!IMAGE_MIME_TYPES.has(mimeType) && !isPdf) {
    throw new OcrError(`openai-vision provider does not support ${input.mimeType}`, 415)
  }

  const model = process.env.LAB_OCR_OPENAI_MODEL ?? 'gpt-4o-mini'
  const base64 = Buffer.from(input.bytes).toString('base64')

  // PDFs use the chat-completions `type: "file"` content block, which gpt-4o
  // and gpt-4o-mini transcribe natively (all pages in a single request).
  // Images keep the established `image_url` data-URL path.
  const contentPart = isPdf
    ? {
        type: 'file' as const,
        file: {
          filename: 'lab-report.pdf',
          file_data: `data:application/pdf;base64,${base64}`,
        },
      }
    : {
        type: 'image_url' as const,
        image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' as const },
      }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: OPENAI_VISION_PROMPT }, contentPart],
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new OcrError(`openai-vision OCR failed: ${res.status} ${body.slice(0, 200)}`, 502)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content?.trim() ?? ''
  if (!text) {
    throw new OcrError('openai-vision returned empty transcription', 502)
  }

  return { text, provider: 'openai-vision', modelVersion: model }
}

/**
 * Extract raw text from a PDF or image upload. Throws `OcrError` with an
 * appropriate HTTP status on misconfiguration or provider failure.
 */
export async function extractLabReportText(input: OcrExtractInput): Promise<OcrExtractResult> {
  if (!isOcrSupportedMimeType(input.mimeType)) {
    throw new OcrError(`Unsupported MIME type: ${input.mimeType}`, 415)
  }
  if (input.bytes.byteLength === 0) {
    throw new OcrError('Empty upload', 400)
  }
  if (input.bytes.byteLength > MAX_BYTES) {
    throw new OcrError(`Upload exceeds ${MAX_BYTES} bytes`, 413)
  }

  const provider = getConfiguredOcrProvider()
  if (provider === 'noop') {
    throw new OcrError(
      'OCR is not configured on this deployment. Set OPENAI_API_KEY or LAB_OCR_PROVIDER.',
      503,
    )
  }
  return extractWithOpenAiVision(input)
}
