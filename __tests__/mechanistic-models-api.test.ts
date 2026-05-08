import { describe, it, expect, beforeAll as vitestBeforeAll } from 'vitest';
import { db } from '@/lib/db';
import { getTestJwtToken } from './session-utils';

const testServerBaseUrl = process.env.TEST_SERVER_BASE_URL ?? 'http://127.0.0.1:3101';

let jwtToken: string;
const testUser = { email: 'testuser@example.com', password: 'TestPass123!', name: 'Test User' };

function getAuthHeaders() {
  return {
    Authorization: `Bearer ${jwtToken}`,
    Cookie: `next-auth.session-token=${jwtToken}`,
  };
}

vitestBeforeAll(async () => {
  jwtToken = await getTestJwtToken(testUser);
});
describe('MechanisticModel API', () => {
  let createdId: string;

  it('creates a mechanistic model', async () => {
    const res = await fetch(`${testServerBaseUrl}/api/mechanistic-models`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        name: 'Test Model',
        description: 'A test mechanistic model',
        version: 'v1.0.0',
        source: 'test',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('Test Model');
    createdId = data.id;
  });

  it('fetches the created model', async () => {
    const res = await fetch(`${testServerBaseUrl}/api/mechanistic-models/${createdId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(createdId);
  });

  it('updates the model', async () => {
    const res = await fetch(`${testServerBaseUrl}/api/mechanistic-models/${createdId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ description: 'Updated description' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.description).toBe('Updated description');
  });

  it('deletes the model', async () => {
    const res = await fetch(`${testServerBaseUrl}/api/mechanistic-models/${createdId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

describe('ModelConfidenceScore API', () => {
  let modelId: string;
  let scoreId: string;

  vitestBeforeAll(async () => {
    // Create a model for the score
    const uniqueModelName = `Score Model ${Date.now()}`;
    const model = await db.mechanisticModel.create({
      data: { name: uniqueModelName, version: 'v1.0.0' },
    });
    modelId = model.id;
  });

  it('creates a model confidence score', async () => {
    const res = await fetch(`${testServerBaseUrl}/api/model-confidence-scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        entityType: 'Hypothesis',
        entityId: 'hypothesis-test-1',
        score: 0.95,
        rationale: 'Test rationale',
        version: 'v1.0.0',
        mechanisticModelId: modelId,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(0.95);
    scoreId = data.id;
  });

  it('updates the confidence score', async () => {
    const res = await fetch(`${testServerBaseUrl}/api/model-confidence-scores/${scoreId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ score: 0.91 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(0.91);
  });

  it('deletes the confidence score', async () => {
    const res = await fetch(`${testServerBaseUrl}/api/model-confidence-scores/${scoreId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
