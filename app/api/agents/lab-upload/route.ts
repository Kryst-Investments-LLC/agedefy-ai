import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'

import { parseLabReportText } from '@/lib/agents/lab-report-parser'
import { logAudit } from '@/lib/audit'
import { authOptions } from '@/lib/auth'
import { requireGdprConsent } from '@/lib/consent'
import { logger } from '@/lib/logger'
import { applyRateLimit } from '@/lib/rate-limit'
import { deriveTenantContextWithValidation } from '@/lib/tenancy'

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
      if (!ALLOWED_CONTENT_TYPES.has(fileType) && !file.name.endsWith('.txt') && !file.name.endsWith('.csv')) {
        return NextResponse.json(
          { error: 'Unsupported file type. Upload a text or CSV file with lab results.' },
          { status: 400 },
        )
      }

      reportText = await file.text()
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
    const message = err instanceof Error ? err.message : 'Internal server error'
    logger.error('Lab report parse failed', {
      userId: session.user.id,
      error: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
