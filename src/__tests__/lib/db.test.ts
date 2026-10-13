import { describe, it, expect, vi } from 'vitest';

vi.mock('pg', () => {
  return {
    Pool: class MockPool {},
  };
});

vi.mock('@prisma/adapter-pg', () => {
  return {
    PrismaPg: class MockPrismaPg {},
  };
});

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: class MockPrismaClient {},
  };
});

describe('db client initialization', () => {
  it('instancie ou réutilise le client Prisma', async () => {
    const { db } = await import('@/lib/db');
    expect(db).toBeDefined();
  });
});
