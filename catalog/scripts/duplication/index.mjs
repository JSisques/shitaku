#!/usr/bin/env node
/**
 * Catalog duplication script: resolve jscpd (cwd .bin then npx), spawn with temp JSON
 * --output, map to shitaku.catalog.duplication/v1, enforce --threshold, print JSON|text,
 * exit 0/1/2. No script-root npm bootstrap; never forwards shitaku --format to jscpd;
 * never exposes --baseline; cleans temp report (no cwd report/ residue).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCHEMA = 'shitaku.catalog.duplication/v1';
const TOOL = 'duplication';
const DEFAULT_THRESHOLD = 0;
const DEFAULT_IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/test/fixtures/**'];

/**
 * @typedef {{ firstFile: string, firstStart: number, firstEnd: number, secondFile: string, secondStart: number, secondEnd: number, lines: number, tokens: number }} Clone
 * @typedef {{ schema: string, tool: string, percentage: number, threshold: number, clones: Clone[] }} Envelope
 */

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  const err = new Error(message);
  err.exitCode = code;
  throw err;
}

/** Mirror of src/domain/scripts-run.ts localBinRelativePaths (script-local duplicate). */
function localBinRelativePaths(tool, platform) {
  const base = `node_modules/.bin/${tool}`;
  return platform === 'win32' ? [`${base}.cmd`, base] : [base];
}

/**
 * Prefer cwd .bin, else npx.
 * @param {string} cwd
 * @param {string} tool
 * @param {string} platform
 * @returns {{ kind: 'local-bin', command: string } | { kind: 'npx', command: string, prefixArgs: string[] }}
 */
function resolveJscpd(cwd, tool, platform) {
  for (const relativePath of localBinRelativePaths(tool, platform)) {
    const abs = join(cwd, relativePath);
    if (existsSync(abs)) return { kind: 'local-bin', command: abs };
  }
  return { kind: 'npx', command: 'npx', prefixArgs: [tool] };
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  let format = 'json';
  let threshold = DEFAULT_THRESHOLD;
  /** @type {number|undefined} */
  let minLines;
  /** @type {number|undefined} */
  let minTokens;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--baseline') {
      fail('duplication: --baseline is not supported');
    }
    if (arg === '--format') {
      format = String(argv[++i] ?? '');
      continue;
    }
    if (arg === '--threshold') {
      const raw = String(argv[++i] ?? '');
      const value = Number(raw);
      if (!raw || !Number.isFinite(value) || value < 0) {
        fail('duplication: --threshold requires a non-negative number');
      }
      threshold = value;
      continue;
    }
    if (arg === '--min-lines') {
      const raw = String(argv[++i] ?? '');
      const value = Number(raw);
      if (!raw || !Number.isFinite(value) || value < 0) {
        fail('duplication: --min-lines requires a non-negative number');
      }
      minLines = value;
      continue;
    }
    if (arg === '--min-tokens') {
      const raw = String(argv[++i] ?? '');
      const value = Number(raw);
      if (!raw || !Number.isFinite(value) || value < 0) {
        fail('duplication: --min-tokens requires a non-negative number');
      }
      minTokens = value;
      continue;
    }
    if (arg.startsWith('-')) {
      fail(`duplication: unsupported option ${arg}`);
    }
    fail(`duplication: unexpected argument ${arg}`);
  }

  if (format !== 'json' && format !== 'text') {
    fail(`duplication: unsupported --format ${format || '(missing)'}`);
  }

  return { format, threshold, minLines, minTokens };
}

/**
 * @param {string} cwd
 * @param {{ minLines?: number, minTokens?: number, threshold: number }} options
 * @returns {{ percentage: number, clones: Clone[] }}
 */
function runJscpd(cwd, options) {
  const invocation = resolveJscpd(cwd, 'jscpd', process.platform);
  const tempDir = mkdtempSync(join(tmpdir(), 'shitaku-duplication-'));

  try {
    /** @type {string[]} */
    const args = [];
    if (invocation.kind === 'npx') args.push(...invocation.prefixArgs);
    args.push('--reporters', 'json', '--output', tempDir, '--gitignore');
    args.push('--ignore', DEFAULT_IGNORE.join(','));
    // Forward threshold so jscpd can compute percentage; script still owns exit mapping.
    args.push('--threshold', String(options.threshold));
    if (options.minLines != null) args.push('--min-lines', String(options.minLines));
    if (options.minTokens != null) args.push('--min-tokens', String(options.minTokens));

    const result = spawnSync(invocation.command, args, {
      cwd,
      shell: false,
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
    });

    if (result.error) {
      fail(`duplication: failed to spawn jscpd: ${result.error.message}`);
    }
    if (result.status === null) {
      fail('duplication: jscpd terminated without an exit status');
    }

    const reportPath = join(tempDir, 'jscpd-report.json');
    if (!existsSync(reportPath)) {
      const detail = (result.stderr || 'jscpd produced no JSON report').trim();
      fail(`duplication: jscpd failed: ${detail}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(readFileSync(reportPath, 'utf8'));
    } catch {
      fail('duplication: jscpd returned non-JSON report');
    }

    return mapReport(parsed);
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

/**
 * @param {unknown} parsed
 * @returns {{ percentage: number, clones: Clone[] }}
 */
function mapReport(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    fail('duplication: jscpd returned unexpected JSON shape');
  }
  const stats = /** @type {{ statistics?: { total?: { percentage?: unknown } } }} */ (parsed).statistics;
  const percentageRaw = stats?.total?.percentage;
  if (typeof percentageRaw !== 'number' || !Number.isFinite(percentageRaw)) {
    fail('duplication: jscpd report missing statistics.total.percentage');
  }

  const duplicates = /** @type {{ duplicates?: unknown }} */ (parsed).duplicates;
  /** @type {Clone[]} */
  const clones = [];
  if (Array.isArray(duplicates)) {
    for (const dup of duplicates) {
      if (!dup || typeof dup !== 'object') continue;
      const first = /** @type {{ firstFile?: { name?: unknown, start?: unknown, end?: unknown } }} */ (dup).firstFile;
      const second = /** @type {{ secondFile?: { name?: unknown, start?: unknown, end?: unknown } }} */ (dup)
        .secondFile;
      const lines = /** @type {{ lines?: unknown }} */ (dup).lines;
      const tokens = /** @type {{ tokens?: unknown }} */ (dup).tokens;
      if (!first || !second) continue;
      if (typeof first.name !== 'string' || typeof second.name !== 'string') continue;
      if (typeof first.start !== 'number' || typeof first.end !== 'number') continue;
      if (typeof second.start !== 'number' || typeof second.end !== 'number') continue;
      if (typeof lines !== 'number' || typeof tokens !== 'number') continue;
      clones.push({
        firstFile: first.name,
        firstStart: first.start,
        firstEnd: first.end,
        secondFile: second.name,
        secondStart: second.start,
        secondEnd: second.end,
        lines,
        tokens,
      });
    }
  }

  return { percentage: percentageRaw, clones };
}

/**
 * @param {Envelope} envelope
 */
function printText(envelope) {
  process.stdout.write(`Duplication: ${envelope.percentage}% (threshold ${envelope.threshold}%)\n`);
  if (envelope.clones.length === 0) {
    process.stdout.write('No clones found.\n');
    return;
  }
  for (const clone of envelope.clones) {
    process.stdout.write(
      `${clone.firstFile}:${clone.firstStart}-${clone.firstEnd} ↔ ${clone.secondFile}:${clone.secondStart}-${clone.secondEnd} (${clone.lines} lines, ${clone.tokens} tokens)\n`,
    );
  }
}

function main() {
  const { format, threshold, minLines, minTokens } = parseArgs(process.argv.slice(2));
  const cwd = (() => {
    const resolved = resolve(process.cwd());
    try {
      return realpathSync(resolved);
    } catch {
      return resolved;
    }
  })();

  const { percentage, clones } = runJscpd(cwd, { threshold, minLines, minTokens });
  /** @type {Envelope} */
  const envelope = { schema: SCHEMA, tool: TOOL, percentage, threshold, clones };

  if (format === 'text') {
    printText(envelope);
  } else {
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  }

  process.exit(percentage > threshold ? 1 : 0);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (!(err instanceof Error && typeof err.exitCode === 'number')) {
    process.stderr.write(`duplication: ${message}\n`);
  }
  process.exit(err instanceof Error && typeof err.exitCode === 'number' ? err.exitCode : 2);
}
