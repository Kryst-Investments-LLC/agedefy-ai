import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { parseLabReportText } from '@/lib/agents/lab-report-parser'
import {
  extractLabReportText,
  isOcrSupportedMimeType,
  OcrError,
  type OcrExtractResult,
} from '@/lib/agents/lab-report-ocr'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'
import {
  UnsafeLabUploadError,
  MAX_LAB_UPLOAD_BYTES,
  validateLabUploadBytes,
  validateTextLabUpload,
} from '@/lib/security/lab-upload'

const MAX_TEXT_LENGTH = 500_000
const ALLOWED_CONTENT_TYPES = new Set([
  'text/plain',
  'text/csv',
  'application/json',
])

export async function POST(request: NextRequest) {
  const blocked = await applyRateLimit(request, { maxRequests: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const consentBlocked = await requireGdprConsent(session.user.id, ['ai-health-info', 'data-processing'])
  if (consentBlocked) return consentBlocked

  const tenantContext = await deriveTenantContextWithValidation({
    sessionUser: session.user,
    request,
  })

  if (!tenantContext) {
    return NextResponse.json({ error: 'Invalid tenant context' }, { status: 403 })
  }

  try {
    const contentType = request.headers.get('content-type') ?? ''

    let reportText: string

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { text?: string }
      if (!body.text || typeof body.text !== 'string') {
        return NextResponse.json({ error: 'Missing "text" field in JSON body' }, { status: 400 })
      }
      reportText = body.text
    } else if (contentType.includes('text/')) {
      reportText = await request.text()
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      }

      const fileType = file.type || 'application/octet-stream'
      const isTextFile =
        ALLOWED_CONTENT_TYPES.has(fileType) ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.csv')

      if (isTextFile) {
        validateTextLabUpload(file)
        reportText = await file.text()
      } else if (isOcrSupportedMimeType(fileType)) {
        // PDF / image — route through OCR before parsing
        if (file.size > MAX_LAB_UPLOAD_BYTES) {
          return NextResponse.json({ error: `Upload exceeds ${MAX_LAB_UPLOAD_BYTES} bytes` }, { status: 413 })
        }
        const buf = new Uint8Array(await file.arrayBuffer())
        try {
          validateLabUploadBytes(buf, fileType)
          const ocr: OcrExtractResult = await extractLabReportText({
            bytes: buf,
            mimeType: fileType,
          })
          reportText = ocr.text
          logger.info('Lab report OCR succeeded', {
            userId: session.user.id,
            provider: ocr.provider,
            model: ocr.modelVersion,
            sizeBytes: buf.byteLength,
            mimeType: fileType,
          })
        } catch (err) {
          if (err instanceof OcrError || err instanceof UnsafeLabUploadError) {
            return NextResponse.json({ error: err.message }, { status: err.status })
          }
          throw err
        }
      } else {
        return NextResponse.json(
          {
            error:
              'Unsupported file type. Upload a text/CSV file, or a PNG/JPEG/WEBP image of the lab report.',
          },
          { status: 415 },
        )
      }
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
    }

    if (reportText.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Report text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` },
        { status: 400 },
      )
    }

    if (reportText.trim().length === 0) {
      return NextResponse.json({ error: 'Report text is empty' }, { status: 400 })
    }

    const parseResult = parseLabReportText(reportText)

    await logAudit({
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? undefined,
      tenantId: tenantContext.tenantId,
      action: 'agent.lab_report_parsed',
      entityType: 'LabReport',
      details: {
        valuesExtracted: parseResult.values.length,
        labName: parseResult.labName,
        reportDate: parseResult.reportDate,
        rawTextLength: parseResult.rawTextLength,
      },
    })

    logger.info('Lab report parsed', {
      userId: session.user.id,
      valuesExtracted: parseResult.values.length,
    })

    return NextResponse.json({
      parsed: parseResult,
      instructions: 'Include the "text" field content in your agent session goal, or the values will be injected automatically when starting a session with the "labReportText" field.',
    })
  } catch (err) {
    if (err instanceof UnsafeLabUploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('Lab report parse failed', {
      userId: session.user.id,
      error: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
