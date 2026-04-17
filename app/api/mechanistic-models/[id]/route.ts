import { NextRequest, NextResponse } from 'next/server';

import { getApiRequestUserId } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/mechanistic-models/[id]
export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const model = await db.mechanisticModel.findUnique({
    where: { id },
    include: { confidenceScores: true, createdBy: true },
  });
  if (!model) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(model);
}

// PATCH /api/mechanistic-models/[id]
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
      const model = await db.mechanisticModel.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          version: data.version,
          source: data.source,
        },
      });
      return { status: 200, body: model };
    },
  });
}

// DELETE /api/mechanistic-models/[id]
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
      await db.mechanisticModel.delete({ where: { id } });
      return { status: 200, body: { success: true } };
    },
  });
}
