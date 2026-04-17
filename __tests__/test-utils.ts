import { vi } from 'vitest';

// Mocks getServerSession to always return a fake user session
export function mockAuthSession(userId = 'test-user-id') {
  vi.mock('next-auth', async () => {
    const actual = await vi.importActual('next-auth');
    return {
      ...actual,
      getServerSession: vi.fn().mockResolvedValue({ user: { id: userId } }),
    };
  });
}
