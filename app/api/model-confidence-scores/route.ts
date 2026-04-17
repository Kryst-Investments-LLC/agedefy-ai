import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server';

import { getApiRequestUserId } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency';

// GET /api/model-confidence-scores?entityType=Hypothesis&entityId=abc
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const where: Prisma.ModelConfidenceScoreWhereInput = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  const scores = await db.modelConfidenceScore.findMany({
    where,
    include: { mechanisticModel: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(scores);
}

// POST /api/model-confidence-scores
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
    requestFingerprint: createIdempotencyFingerprint({ userId, ...data }),
    execute: async () => {
      const score = await db.modelConfidenceScore.create({
        data: {
          mechanisticModelId: data.mechanisticModelId,
          entityType: data.entityType,
          entityId: data.entityId,
          score: data.score,
          rationale: data.rationale,
          version: data.version,
        },
      });
      return { status: 200, body: score };
    },
  });
}
