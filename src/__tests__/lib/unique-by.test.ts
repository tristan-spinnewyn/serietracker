import { describe, it, expect } from 'vitest';
import { uniqueBy } from '@/lib/unique-by';

describe('uniqueBy', () => {
  it('keeps the first item for each key, in order', () => {
    const items = [{ id: 1, n: 'a' }, { id: 2, n: 'b' }, { id: 1, n: 'c' }];
    expect(uniqueBy(items, i => i.id)).toEqual([{ id: 1, n: 'a' }, { id: 2, n: 'b' }]);
  });

  it('returns an empty list for an empty input', () => {
    expect(uniqueBy([], (i: number) => i)).toEqual([]);
  });
});
