import { NextRequest, NextResponse } from 'next/server';

import { getApiRequestUserId } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/model-confidence-scores/[id]
export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const score = await db.modelConfidenceScore.findUnique({
    where: { id },
    include: { mechanisticModel: true },
  });
  if (!score) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(score);
}

// PATCH /api/model-confidence-scores/[id]
export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const userId = await getApiRequestUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const data = await req.json();
  return executeRouteIdempotentJsonMutation({
    request: req,
    tenantId: userId,
    actorUserId: userId,
    requestFingerprint: createIdempotencyFingerprint({ userId, id, ...data }),
    execute: async () => {
      const score = await db.modelConfidenceScore.update({
        where: { id },
        data: {
          score: data.score,
          rationale: data.rationale,
          version: data.version,
        },
      });
      return { status: 200, body: score };
    },
  });
}

// DELETE /api/model-confidence-scores/[id]
export async function DELETE(
  req: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const userId = await getApiRequestUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return executeRouteIdempotentJsonMutation({
    request: req,
    tenantId: userId,
    actorUserId: userId,
    requestFingerprint: createIdempotencyFingerprint({ userId, id, action: 'delete' }),
    execute: async () => {
      await db.modelConfidenceScore.delete({ where: { id } });
      return { status: 200, body: { success: true } };
    },
  });
}
