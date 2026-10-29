import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface DiffCoverageResult {
  file: string;
  totalExecutable: number;
  covered: number;
  uncoveredLines: number[];
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function parseLcov(lcovContent: string): Map<string, Map<number, number>> {
  const coverageByFile = new Map<string, Map<number, number>>();

  let currentFile: string | null = null;
  let currentFileMap: Map<number, number> | null = null;

  for (const line of lcovContent.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      const rawPath = line.substring(3).trim();
      currentFile = normalizePath(path.relative(process.cwd(), rawPath));
      currentFileMap = new Map<number, number>();
      coverageByFile.set(currentFile, currentFileMap);
    } else if (line.startsWith('DA:') && currentFileMap) {
      const parts = line.substring(3).split(',');
      const lineNum = parseInt(parts[0], 10);
      const hitCount = parseInt(parts[1], 10);
      currentFileMap.set(lineNum, hitCount);
    } else if (line === 'end_of_record') {
      currentFile = null;
      currentFileMap = null;
    }
  }

  return coverageByFile;
}

export function isExcluded(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  if (!normalized.startsWith('src/')) return true;
  if (normalized.includes('/__tests__/')) return true;
  if (normalized.startsWith('src/types/')) return true;
  if (normalized.endsWith('.d.ts')) return true;
  return false;
}

export function getDiffCommand(baseRef?: string): string {
  if (baseRef) {
    return `git diff ${baseRef} --unified=0 -- src/`;
  }

  // En CI GitHub Actions (pull_request event)
  if (process.env.GITHUB_BASE_REF) {
    const base = `origin/${process.env.GITHUB_BASE_REF}`;
    return `git diff ${base} --unified=0 -- src/`;
  }

  // En CI GitHub Actions (push event sur main)
  if (process.env.GITHUB_EVENT_NAME === 'push') {
    try {
      execSync('git rev-parse --verify HEAD~1', { stdio: 'ignore' });
      return `git diff HEAD~1 --unified=0 -- src/`;
    } catch { /* premier commit */ }
  }

  // En local : tester si on est sur une autre branche que main
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    if (currentBranch !== 'main') {
      try {
        execSync('git rev-parse --verify origin/main', { stdio: 'ignore' });
        return `git diff origin/main --unified=0 -- src/`;
      } catch {
        return `git diff main --unified=0 -- src/`;
      }
    }
  } catch { /* ignore */ }

  // Si on est sur main en local : diff contre HEAD (changements non-commités)
  return `git diff HEAD --unified=0 -- src/`;
}

export function parseDiff(diffText: string): Map<string, number[]> {
  const changedLinesByFile = new Map<string, number[]>();
  let currentFile: string | null = null;

  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      const rawPath = line.substring(6).trim();
      currentFile = normalizePath(rawPath);
    } else if (line.startsWith('@@') && currentFile) {
      if (isExcluded(currentFile)) continue;

      const match = line.match(/\+([0-9]+)(?:,([0-9]+))?/);
      if (match) {
        const start = parseInt(match[1], 10);
        const count = match[2] !== undefined ? parseInt(match[2], 10) : 1;
        if (count > 0) {
          let list = changedLinesByFile.get(currentFile);
          if (!list) {
            list = [];
            changedLinesByFile.set(currentFile, list);
          }
          for (let i = 0; i < count; i++) {
            list.push(start + i);
          }
        }
      }
    }
  }

  return changedLinesByFile;
}

export function formatRanges(lines: number[]): string {
  if (lines.length === 0) return '-';
  const ranges: string[] = [];
  let start = lines[0];
  let prev = lines[0];

  for (let i = 1; i < lines.length; i++) {
    const curr = lines[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = curr;
      prev = curr;
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(', ');
}

export function runDiffCoverageCheck(options?: {
  minThreshold?: number;
  baseRef?: string;
  lcovPath?: string;
}) {
  const minThreshold = options?.minThreshold ?? 80;
  const lcovPath = path.resolve(process.cwd(), options?.lcovPath ?? 'coverage/lcov.info');

  if (!fs.existsSync(lcovPath)) {
    console.error(`❌ Erreur: Fichier LCOV introuvable à "${lcovPath}".`);
    console.error(`Lancez d'abord "npm run test:coverage" pour générer le rapport.`);
    process.exit(1);
  }

  const coverageByFile = parseLcov(fs.readFileSync(lcovPath, 'utf-8'));

  let diffText = '';
  const diffCmd = getDiffCommand(options?.baseRef);
  try {
    diffText = execSync(diffCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  } catch {
    // Si le diff échoue (ex: shallow clone sans origin/main), essayer git diff HEAD
    try {
      diffText = execSync('git diff HEAD --unified=0 -- src/', {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      diffText = '';
    }
  }

  const changedLinesByFile = parseDiff(diffText);

  if (changedLinesByFile.size === 0) {
    console.log('ℹ️  Aucune ligne de code exécutable modifiée dans le diff.');
    console.log(`✅ Couverture du nouveau code : 100% (seuil requis : ${minThreshold}%).`);
    return;
  }

  const results: DiffCoverageResult[] = [];
  let totalExecutableInDiff = 0;
  let totalCoveredInDiff = 0;

  for (const [file, changedLines] of changedLinesByFile.entries()) {
    const fileCoverage = coverageByFile.get(file);
    let fileExecutable = 0;
    let fileCovered = 0;
    const uncoveredLines: number[] = [];

    for (const lineNum of changedLines) {
      if (!fileCoverage || !fileCoverage.has(lineNum)) {
        // Ligne non-exécutable (commentaire, blanc, type TS)
        continue;
      }

      fileExecutable++;
      const hits = fileCoverage.get(lineNum) ?? 0;
      if (hits > 0) {
        fileCovered++;
      } else {
        uncoveredLines.push(lineNum);
      }
    }

    if (fileExecutable > 0) {
      results.push({
        file,
        totalExecutable: fileExecutable,
        covered: fileCovered,
        uncoveredLines,
      });
      totalExecutableInDiff += fileExecutable;
      totalCoveredInDiff += fileCovered;
    }
  }

  if (totalExecutableInDiff === 0) {
    console.log('ℹ️  Aucune ligne exécutable impactée dans le diff (uniquement types/commentaires).');
    console.log(`✅ Couverture du nouveau code : 100% (seuil requis : ${minThreshold}%).`);
    return;
  }

  const diffCoveragePct = (totalCoveredInDiff / totalExecutableInDiff) * 100;

  console.log('\n======================== RAPPORT DE COUVERTURE DU NOUVEAU CODE ========================');
  console.log(`Commande diff : ${diffCmd}`);
  console.log(`Seuil requis  : ${minThreshold.toFixed(1)}%\n`);

  console.log(
    'Fichier'.padEnd(50) +
    'Lignes'.padStart(8) +
    'Couvertes'.padStart(12) +
    'Couv. %'.padStart(10) +
    '   Lignes non couvertes'
  );
  console.log('-'.repeat(96));

  for (const r of results) {
    const pct = ((r.covered / r.totalExecutable) * 100).toFixed(1) + '%';
    const uncovered = formatRanges(r.uncoveredLines);
    console.log(
      r.file.padEnd(50) +
      String(r.totalExecutable).padStart(8) +
      String(r.covered).padStart(12) +
      pct.padStart(10) +
      '   ' + uncovered
    );
  }

  console.log('-'.repeat(96));
  console.log(
    `TOTAL NOUVEAU CODE: ${totalCoveredInDiff}/${totalExecutableInDiff} lignes exécutables couvertes (${diffCoveragePct.toFixed(2)}%)`
  );
  console.log('========================================================================================\n');

  if (diffCoveragePct < minThreshold) {
    console.error(
      `❌ ÉCHEC: La couverture du nouveau code (${diffCoveragePct.toFixed(2)}%) est inférieure au seuil de ${minThreshold}%.`
    );
    console.error(`Veuillez ajouter des tests unitaires pour couvrir les lignes signalées ci-dessus.\n`);
    process.exit(1);
  } else {
    console.log(
      `✅ SUCCÈS: La couverture du nouveau code (${diffCoveragePct.toFixed(2)}%) respecte le seuil de ${minThreshold}%!\n`
    );
  }
}

// Exécution directe via CLI
if (require.main === module || process.argv[1]?.endsWith('check-diff-coverage.ts')) {
  const args = process.argv.slice(2);
  let min = 80;
  let base: string | undefined = undefined;
  let lcov: string | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--min' && args[i + 1]) {
      min = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--base' && args[i + 1]) {
      base = args[i + 1];
      i++;
    } else if (args[i] === '--lcov' && args[i + 1]) {
      lcov = args[i + 1];
      i++;
    }
  }

  runDiffCoverageCheck({ minThreshold: min, baseRef: base, lcovPath: lcov });
}
