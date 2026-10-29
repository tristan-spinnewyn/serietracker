import { describe, it, expect } from 'vitest';
import { ANILIST_RELATION_MAP, inverseRelationType } from '@/lib/shows/relations';

describe('inverseRelationType', () => {
  it.each([
    ['SEQUEL', 'PREQUEL'],
    ['PREQUEL', 'SEQUEL'],
    ['PARENT', 'SPINOFF'],
    // A spin-off's counterpart is its parent, not another spin-off
    ['SPINOFF', 'PARENT'],
    ['ALTERNATIVE', 'ALTERNATIVE'],
    ['RELATED', 'RELATED'],
  ] as const)('inverts %s into %s', (type, inverse) => {
    expect(inverseRelationType(type)).toBe(inverse);
  });

  it('is its own inverse for every relation type', () => {
    for (const type of ['SEQUEL', 'PREQUEL', 'PARENT', 'SPINOFF', 'ALTERNATIVE', 'RELATED'] as const) {
      expect(inverseRelationType(inverseRelationType(type))).toBe(type);
    }
  });
});

describe('ANILIST_RELATION_MAP', () => {
  it('maps AniList relation types onto ours', () => {
    expect(ANILIST_RELATION_MAP).toEqual({
      SEQUEL: 'SEQUEL',
      PREQUEL: 'PREQUEL',
      SIDE_STORY: 'SPINOFF',
      ALTERNATIVE: 'ALTERNATIVE',
      PARENT: 'PARENT',
      OTHER: 'RELATED',
    });
  });
});
