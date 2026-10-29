import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateMany, mockSendPush } = vi.hoisted(() => ({
  mockCreateMany: vi.fn(),
  mockSendPush: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: { notification: { createMany: mockCreateMany } } }));
vi.mock('@/lib/notifications/push', () => ({ sendPushToUser: mockSendPush }));

import { notifyUsers } from '@/lib/notifications/notify';

describe('notifyUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing without notifications', async () => {
    await notifyUsers([]);
    expect(mockCreateMany).not.toHaveBeenCalled();
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('stores every notification and sends one push per user, with their first notification', async () => {
    const notifs = [
      { userId: 'u1', type: 'NEW_SEASON' as const, title: 'Show', body: 'Saison 2', showId: 's1' },
      { userId: 'u1', type: 'SHOW_RETURNING' as const, title: 'Show', body: 'Reprise', showId: 's1' },
      { userId: 'u2', type: 'NEW_SEASON' as const, title: 'Show', body: 'Saison 2', showId: 's1' },
    ];

    await notifyUsers(notifs);

    expect(mockCreateMany).toHaveBeenCalledWith({ data: notifs });
    expect(mockSendPush).toHaveBeenCalledTimes(2);
    expect(mockSendPush).toHaveBeenCalledWith('u1', { title: 'Show', body: 'Saison 2' });
    expect(mockSendPush).toHaveBeenCalledWith('u2', { title: 'Show', body: 'Saison 2' });
  });

  it('does not fail when a push cannot be delivered', async () => {
    mockSendPush.mockRejectedValue(new Error('push down'));
    await expect(notifyUsers([
      { userId: 'u1', type: 'NEW_SEASON', title: 'Show', body: 'Saison 2', showId: 's1' },
    ])).resolves.toBeUndefined();
  });
});
