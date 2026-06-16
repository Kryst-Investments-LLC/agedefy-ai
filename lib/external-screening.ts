/**
 * Dispatcher for user-registered external screening adapters.
 *
 * Calls the external endpoint, captures timing + HTTP status, normalizes the
 * response against our ScreenResult-compatible contract schema, and returns
 * everything the caller needs to persist an ExternalScreeningRun row.
 */

import type { ExternalScreeningAdapter } from '@prisma/client'

import { externalScreenResponseSchema } from '@/lib/validators/external-screening'

export interface ExternalScreeningRequest {
  smiles: string
  candidateId?: string
  include_pains?: boolean
}

export interface ExternalScreeningOutcome {
  success: boolean
  statusCode: number | null
  durationMs: number
  rawResponse: unknown
  normalized: unknown           // ExternalScreenResponse shape if parseable; null otherwise
  errorMessage: string | null
}

export async function callAdapter(
  adapter: Pick<
    ExternalScreeningAdapter,
    'endpointUrl' | 'authHeader' | 'authScheme' | 'secret' | 'timeoutMs'
  >,
  req: ExternalScreeningRequest,
): Promise<ExternalScreeningOutcome> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), adapter.timeoutMs)
  const start = Date.now()

  const body = JSON.stringify({
    smiles: req.smiles,
    candidate_id: req.candidateId ?? null,
    platform_version: '1.0',
    include_pains: req.include_pains ?? false,
  })

  let statusCode: number | null = null
  let rawResponse: unknown = null

  try {
    const res = await fetch(adapter.endpointUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        [adapter.authHeader]: `${adapter.authScheme} ${adapter.secret}`,
      },
      body,
      signal: controller.signal,
    })

    statusCode = res.status
    const text = await res.text()
    rawResponse = safeJson(text)

    if (!res.ok) {
      return {
        success: false,
        statusCode,
        durationMs: Date.now() - start,
        rawResponse,
        normalized: null,
        errorMessage: `External adapter returned HTTP ${res.status}`,
      }
    }

    const parsed = externalScreenResponseSchema.safeParse(rawResponse)
    const normalized = parsed.success ? parsed.data : null

    return {
      success: true,
      statusCode,
      durationMs: Date.now() - start,
      rawResponse,
      normalized,
      errorMessage: parsed.success
        ? null
        : `Response missing required fields: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    }
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))

    return {
      success: false,
      statusCode,
      durationMs: Date.now() - start,
      rawResponse,
      normalized: null,
      errorMessage: isTimeout
        ? `External adapter timed out after ${adapter.timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : 'Unknown error calling external adapter',
    }
  } finally {
    clearTimeout(timer)
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
