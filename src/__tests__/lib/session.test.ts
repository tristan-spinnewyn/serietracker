import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: mockAuth }));

import { requireSession } from '@/lib/session';

describe('requireSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the session of a signed-in user', async () => {
    const session = { user: { id: 'u1', email: 'a@b.c', name: 'A' } };
    mockAuth.mockResolvedValue(session);
    await expect(requireSession()).resolves.toBe(session);
  });

  it.each([
    ['there is no session', null],
    ['the session has no user id', { user: {} }],
  ])('throws when %s', async (_label, session) => {
    mockAuth.mockResolvedValue(session);
    await expect(requireSession()).rejects.toThrow('Non authentifié');
  });
});
