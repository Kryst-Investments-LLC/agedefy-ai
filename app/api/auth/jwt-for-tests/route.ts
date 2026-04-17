import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';

import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { isPasswordLoginAllowed } from '@/lib/auth-password';
import { loginSchema } from '@/lib/validators/auth';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export async function POST(req: NextRequest) {
  if (env.ENABLE_TEST_AUTH_ENDPOINT !== 'true') {
    return jsonNoStore({ error: 'Test auth endpoint is disabled' }, { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return jsonNoStore({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsedPayload = loginSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return jsonNoStore(
      {
        error: 'Invalid credentials payload',
        details: parsedPayload.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { email, password } = parsedPayload.data;
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    return jsonNoStore({ error: 'Invalid credentials' }, { status: 401 });
  }
  if (!isPasswordLoginAllowed(user.passwordHash)) {
    return jsonNoStore({ error: 'Invalid credentials' }, { status: 401 });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return jsonNoStore({ error: 'Invalid credentials' }, { status: 401 });
  }
  const token = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const jwt = await encode({ token, secret: authOptions.secret! });
  return jsonNoStore({ token: jwt });
}
