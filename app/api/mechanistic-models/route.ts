import { NextRequest, NextResponse } from 'next/server';

import { getApiRequestUserId } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency';

// GET /api/mechanistic-models
export async function GET() {
  const models = await db.mechanisticModel.findMany({
    include: { confidenceScores: true, createdBy: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(models);
}

// POST /api/mechanistic-models
export async function POST(req: NextRequest) {
  const userId = await getApiRequestUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = await req.json();
  return executeRouteIdempotentJsonMutation({
    request: req,
    tenantId: userId,
    actorUserId: userId,
    requestFingerprint: createIdempotencyFingerprint({ userId, name: data.name, version: data.version }),
    execute: async () => {
      const model = await db.mechanisticModel.create({
        data: {
          name: data.name,
          description: data.description,
          version: data.version,
          source: data.source,
          createdById: userId,
        },
      });
      return { status: 200, body: model };
    },
  });
}
