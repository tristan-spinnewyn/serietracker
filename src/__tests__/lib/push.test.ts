import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();
const mockDelete = vi.fn();
const mockSendNotification = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    pushSubscription: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

import { sendPushToUser } from '@/lib/notifications/push';

describe('sendPushToUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envoie une notification push pour chaque abonnement trouvé', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://push1.com', p256dh: 'k1', auth: 'a1' },
      { id: 'sub-2', endpoint: 'https://push2.com', p256dh: 'k2', auth: 'a2' },
    ]);
    mockSendNotification.mockResolvedValue({});

    await sendPushToUser('user-1', { title: 'Titre', body: 'Message' });

    expect(mockFindMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('supprime l\'abonnement de la base de données si le code HTTP est 410 (expiré)', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'sub-expired', endpoint: 'https://push-exp.com', p256dh: 'k1', auth: 'a1' },
    ]);
    const err410 = new Error('Gone') as Error & { statusCode: number };
    err410.statusCode = 410;
    mockSendNotification.mockRejectedValue(err410);

    await sendPushToUser('user-1', { title: 'Titre', body: 'Message' });

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'sub-expired' } });
  });

  it('ignore les erreurs autres que 410 sans supprimer l\'abonnement', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'sub-other', endpoint: 'https://push-other.com', p256dh: 'k1', auth: 'a1' },
    ]);
    const err500 = new Error('Server Error') as Error & { statusCode: number };
    err500.statusCode = 500;
    mockSendNotification.mockRejectedValue(err500);

    await sendPushToUser('user-1', { title: 'Titre', body: 'Message' });

    expect(mockDelete).not.toHaveBeenCalled();
  });
});
