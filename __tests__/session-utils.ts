
import bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encode } from 'next-auth/jwt';
import { request } from 'undici';

import { db } from '@/lib/db';

type GetTestJwtTokenInput = {
  email: string;
  password: string;
  name?: string;
};

type JwtForTestsResponse = {
  token?: string;
};

function loadNextAuthSecret() {
  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET;
  }

  const envCandidates = ['.env.local', '.env'];

  for (const envFile of envCandidates) {
    const envPath = join(process.cwd(), envFile);
    if (!existsSync(envPath)) {
      continue;
    }

    const envContent = readFileSync(envPath, 'utf8');
    for (const rawLine of envContent.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      if (key !== 'NEXTAUTH_SECRET') {
        continue;
      }

      const rawValue = line.slice(separatorIndex + 1).trim();
      const unquotedValue = rawValue.replace(/^['"]|['"]$/g, '');
      process.env.NEXTAUTH_SECRET = unquotedValue;
      return unquotedValue;
    }
  }

  return 'development-secret-change-me-before-production';
}

const nextAuthSecret = loadNextAuthSecret();
const testServerBaseUrl = process.env.TEST_SERVER_BASE_URL ?? 'http://127.0.0.1:3101';

// Returns a JWT for use in Authorization header
export async function getTestJwtToken({ email, password, name }: GetTestJwtTokenInput) {
  const normalizedEmail = email.toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name,
      passwordHash,
    },
    create: {
      email: normalizedEmail,
      name,
      passwordHash,
    },
  });

  const createLocalToken = async () =>
    encode({
      token: {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      secret: nextAuthSecret,
    });

  const jwtRes = await request(`${testServerBaseUrl}/api/auth/jwt-for-tests`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, password }),
  });

  if (jwtRes.statusCode === 403 || jwtRes.statusCode === 404) {
    return createLocalToken();
  }

  if (jwtRes.statusCode !== 200) {
    const failureBody = await jwtRes.body.text();
    throw new Error(
      `Could not retrieve JWT for test user: status=${jwtRes.statusCode} body=${failureBody}`,
    );
  }
  const { token } = await jwtRes.body.json() as JwtForTestsResponse;
  if (!token) throw new Error('No JWT returned from jwt-for-tests endpoint');
  return token;
}
