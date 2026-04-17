import { NextRequest, NextResponse } from 'next/server';

import { getApiRequestUserId } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { createIdempotencyFingerprint, executeRouteIdempotentJsonMutation } from '@/lib/idempotency';
import { applyRateLimit } from '@/lib/rate-limit';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

// GET /api/mechanistic-models
export async function GET(req: NextRequest) {
  const blocked = await applyRateLimit(req);
  if (blocked) return blocked;

  const userId = await getApiRequestUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const take = Math.min(
    Math.max(Number.parseInt(searchParams.get('limit') ?? '', 10) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  const cursor = searchParams.get('cursor') ?? undefined;

  const models = await db.mechanisticModel.findMany({
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      confidenceScores: true,
      // Do not include the full createdBy user record (PII).
      // Expose only the id; clients can resolve display name via a scoped endpoint.
    },
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = models.length > take;
  const items = hasMore ? models.slice(0, take) : models;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return NextResponse.json({ items, nextCursor });
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
