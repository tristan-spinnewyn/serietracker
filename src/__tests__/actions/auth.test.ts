import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockFindUnique, mockCreate, mockHash } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
  mockHash: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}));

vi.mock('bcryptjs', () => ({
  hash: mockHash,
}));

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '198.51.100.1' }),
}));

import { registerAction } from '@/lib/actions/auth';
import { resetRateLimits } from '@/lib/rate-limit';

describe('registerAction', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    process.env = { ...originalEnv, ALLOW_REGISTRATION: 'true' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('bloque l\'inscription si fermée et email non autorisé', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    process.env.ALLOWED_EMAILS = 'vip@test.com,admin@test.com';

    const res = await registerAction({
      name: 'User',
      email: 'stranger@test.com',
      password: 'password123',
    });

    expect(res).toEqual({ error: 'Inscriptions fermées. Demande une invitation.' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('autorise l\'inscription si fermée mais email dans ALLOWED_EMAILS', async () => {
    process.env.ALLOW_REGISTRATION = 'false';
    process.env.ALLOWED_EMAILS = 'vip@test.com,admin@test.com';

    mockFindUnique.mockResolvedValue(null);
    mockHash.mockResolvedValue('hashed-pass');
    mockCreate.mockResolvedValue({ id: 'u1' });

    const res = await registerAction({
      name: 'Vip User',
      email: 'VIP@test.com',
      password: 'password123',
    });

    expect(res).toEqual({ success: true });
    expect(mockCreate).toHaveBeenCalled();
  });

  it('rejette les données invalides (mot de passe trop court)', async () => {
    const res = await registerAction({
      name: 'Test',
      email: 'test@example.com',
      password: '123',
    });

    expect(res).toEqual({ error: 'Données invalides.' });
  });

  it('retourne une erreur si l\'email existe déjà', async () => {
    mockFindUnique.mockResolvedValue({ id: 'existing' });

    const res = await registerAction({
      name: 'Test',
      email: 'existing@example.com',
      password: 'password123',
    });

    expect(res).toEqual({ error: 'Un compte existe déjà avec cet email.' });
  });

  it('enregistre l\'utilisateur avec hash et initiales quand tout est valide', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockHash.mockResolvedValue('hashed_pw');
    mockCreate.mockResolvedValue({ id: 'new-user' });

    const res = await registerAction({
      name: 'Jean Paul',
      email: 'jp@example.com',
      password: 'securePassword1',
    });

    expect(res).toEqual({ success: true });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Jean Paul',
        email: 'jp@example.com',
        passwordHash: 'hashed_pw',
        initials: 'JP',
      }),
    });
  });

  it('blocks a 6th registration attempt from the same IP within an hour', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockHash.mockResolvedValue('hashed_pw');
    mockCreate.mockResolvedValue({ id: 'new-user' });

    for (let i = 0; i < 5; i++) {
      await registerAction({ name: 'Bot', email: `bot${i}@example.com`, password: 'securePassword1' });
    }
    const res = await registerAction({ name: 'Bot', email: 'bot5@example.com', password: 'securePassword1' });

    expect(res).toEqual({ error: 'Trop de tentatives. Réessaie plus tard.' });
    expect(mockCreate).toHaveBeenCalledTimes(5);
  });
});
