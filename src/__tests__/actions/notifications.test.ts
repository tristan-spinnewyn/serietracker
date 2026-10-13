import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuth, mockUpdateMany, mockRevalidatePath } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    notification: {
      updateMany: mockUpdateMany,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }));

import { markAllNotificationsRead } from '@/lib/actions/notifications';

describe('markAllNotificationsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ne fait rien si non connecté', async () => {
    mockAuth.mockResolvedValue(null);
    await markAllNotificationsRead();
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('met à jour les notifications non lues et revalide /notifications', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u123' } });
    mockUpdateMany.mockResolvedValue({ count: 5 });

    await markAllNotificationsRead();

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u123', read: false },
      data: { read: true },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/notifications');
  });
});
