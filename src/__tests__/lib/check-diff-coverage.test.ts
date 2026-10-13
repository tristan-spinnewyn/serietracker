import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  isExcluded,
  parseDiff,
  parseLcov,
  formatRanges,
  getDiffCommand,
} from '../../../scripts/check-diff-coverage';

describe('Diff Coverage Checker', () => {
  describe('normalizePath', () => {
    it('remplace les anti-slashs et retire ./', () => {
      expect(normalizePath('src\\lib\\foo.ts')).toBe('src/lib/foo.ts');
      expect(normalizePath('./src/lib/foo.ts')).toBe('src/lib/foo.ts');
    });
  });

  describe('isExcluded', () => {
    it('exclut les fichiers hors src, les tests, les types et les fichiers .d.ts', () => {
      expect(isExcluded('scripts/foo.ts')).toBe(true);
      expect(isExcluded('src/__tests__/lib/foo.test.ts')).toBe(true);
      expect(isExcluded('src/types/index.ts')).toBe(true);
      expect(isExcluded('src/global.d.ts')).toBe(true);
      expect(isExcluded('src/lib/foo.ts')).toBe(false);
      expect(isExcluded('src/components/button.tsx')).toBe(false);
    });
  });

  describe('formatRanges', () => {
    it('formate correctement les listes et plages de lignes', () => {
      expect(formatRanges([])).toBe('-');
      expect(formatRanges([5])).toBe('5');
      expect(formatRanges([1, 2, 3])).toBe('1-3');
      expect(formatRanges([1, 2, 3, 5, 7, 8, 9])).toBe('1-3, 5, 7-9');
    });
  });

  describe('parseDiff', () => {
    it('extrait les numéros de lignes ajoutées/modifiées par fichier', () => {
      const diff = `
diff --git a/src/lib/foo.ts b/src/lib/foo.ts
--- a/src/lib/foo.ts
+++ b/src/lib/foo.ts
@@ -10,0 +11,3 @@
+const a = 1;
+const b = 2;
+const c = 3;
@@ -20,2 +23 @@
+const d = 4;
diff --git a/src/__tests__/foo.test.ts b/src/__tests__/foo.test.ts
--- a/src/__tests__/foo.test.ts
+++ b/src/__tests__/foo.test.ts
@@ -1 +1 @@
+test
`;
      const result = parseDiff(diff);
      expect(result.has('src/lib/foo.ts')).toBe(true);
      expect(result.get('src/lib/foo.ts')).toEqual([11, 12, 13, 23]);
      // Fichiers de test exclus
      expect(result.has('src/__tests__/foo.test.ts')).toBe(false);
    });
  });

  describe('parseLcov', () => {
    it('analyse le contenu LCOV et extrait les lignes et hits', () => {
      const lcov = `
TN:
SF:src/lib/foo.ts
DA:11,1
DA:12,0
DA:13,5
end_of_record
`;
      const coverage = parseLcov(lcov);
      // Path resolution uses path.relative(process.cwd(), rawPath)
      const entry = Array.from(coverage.entries()).find(([k]) => k.includes('src/lib/foo.ts'));
      expect(entry).toBeDefined();
      const lineMap = entry![1];
      expect(lineMap.get(11)).toBe(1);
      expect(lineMap.get(12)).toBe(0);
      expect(lineMap.get(13)).toBe(5);
    });
  });

  describe('getDiffCommand', () => {
    it('renvoie la commande appropriée avec baseRef explicite', () => {
      expect(getDiffCommand('main')).toBe('git diff main --unified=0 -- src/');
    });
  });
});
