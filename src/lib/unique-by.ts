/** Drops the items whose key was already seen, keeping the first one. */
export function uniqueBy<T, K>(items: T[], keyOf: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter(item => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
