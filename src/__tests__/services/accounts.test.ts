import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { initialsFor } from '@/lib/services/accounts';

describe('initialsFor', () => {
  it.each([
    ['Jean Paul', 'JP'],
    ['  jean   paul  ', 'JP'],
    ['Léa', 'L'],
    ['Anne Marie Claire', 'AM'],
  ])('turns %j into %j', (name, initials) => {
    expect(initialsFor(name)).toBe(initials);
  });
});
