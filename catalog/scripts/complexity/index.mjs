#!/usr/bin/env node
/**
 * Catalog complexity script: self-bootstrap tools into this install root, run local
 * eslint with a per-run shipped flat config, map messages to the D4A JSON envelope,
 * and enforce CLI thresholds (exit 0/1/2).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(SCRIPT_ROOT, 'eslint.rules.mjs');
const ESLINT_BIN = join(SCRIPT_ROOT, 'node_modules', '.bin', 'eslint');
const SCHEMA = 'shitaku.catalog.complexity/v1';
const CYCLOMATIC_NAMED_RE = /Function '([^']+)' has a complexity of (\d+)\b/;
const CYCLOMATIC_ANON_RE = /(?:Arrow )?function has a complexity of (\d+)\b/i;
const COGNITIVE_RE = /Cognitive Complexity from (\d+)\b/i;

/**
 * @typedef {{ file: string, name: string, line: number, cyclomatic: number, cognitive: number }} FnRow
 */

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  const err = new Error(message);
  err.exitCode = code;
  throw err;
}

function ensureDeps() {
  if (existsSync(ESLINT_BIN)) return;
  const lockfile = join(SCRIPT_ROOT, 'package-lock.json');
  const args = existsSync(lockfile) ? ['ci', '--omit=dev'] : ['install', '--omit=dev'];
  const result = spawnSync('npm', args, {
    cwd: SCRIPT_ROOT,
    shell: false,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0 || !existsSync(ESLINT_BIN)) {
    const detail = (result.stderr || result.stdout || 'npm install failed').trim();
    fail(`complexity: failed to install tools: ${detail}`);
  }
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  let maxCyclomatic = 10;
  let maxCognitive = 15;
  let format = 'json';
  /** @type {string[]} */
  const paths = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--max-cyclomatic') {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value)) fail('complexity: --max-cyclomatic requires a number');
      maxCyclomatic = value;
      continue;
    }
    if (arg === '--max-cognitive') {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value)) fail('complexity: --max-cognitive requires a number');
      maxCognitive = value;
      continue;
    }
    if (arg === '--format') {
      format = String(argv[++i] ?? '');
      continue;
    }
    if (arg.startsWith('-')) {
      fail(`complexity: unsupported option ${arg}`);
    }
    paths.push(arg);
  }
  if (format !== 'json' && format !== 'text') {
    fail(`complexity: unsupported --format ${format || '(missing)'}`);
  }
  return { maxCyclomatic, maxCognitive, format, paths: paths.length > 0 ? paths : ['.'] };
}

/**
 * Write a unique flat config per run so consumer `.gitignore` is not frozen by ESM cache.
 * Placed under SCRIPT_ROOT so `eslint/config` resolves from the install-root node_modules.
 * @param {string} cwd
 */
function writeRuntimeConfig(cwd) {
  const gitignorePath = join(cwd, '.gitignore');
  const configPath = join(SCRIPT_ROOT, `.eslint.runtime.${process.pid}.${Date.now()}.mjs`);
  const rulesHref = pathToFileURL(RULES_PATH).href;
  const hasGitignore = existsSync(gitignorePath);
  const body = `import { defineConfig, includeIgnoreFile } from 'eslint/config';
import rules from ${JSON.stringify(rulesHref)};

const configs = [];
${
  hasGitignore
    ? `configs.push(includeIgnoreFile(${JSON.stringify(gitignorePath)}, { gitignoreResolution: true }));`
    : ''
}
configs.push({ ignores: ['**/node_modules/**', '**/.git/**'] });
export default defineConfig([...configs, ...rules]);
`;
  writeFileSync(configPath, body, 'utf8');
  return configPath;
}

/**
 * Prefer cwd-relative targets so ESLint resolves files inside the analysis root.
 * Uses realpath so macOS `/var` vs `/private/var` does not break relative paths.
 * @param {string} cwd
 * @param {string[]} paths
 */
function normalizeTargets(cwd, paths) {
  let cwdReal = cwd;
  try {
    cwdReal = realpathSync(cwd);
  } catch {
    // keep resolve() result
  }
  return paths.map((p) => {
    const abs = resolve(cwdReal, p);
    let absReal = abs;
    try {
      absReal = realpathSync(abs);
    } catch {
      // path may not exist yet; keep resolved form
    }
    if (absReal === cwdReal) return '.';
    const rel = relative(cwdReal, absReal).split('\\').join('/');
    if (rel === '') return '.';
    if (!rel.startsWith('..') && !rel.startsWith('/')) return rel;
    return absReal;
  });
}

/**
 * @param {string} cwd
 * @param {string[]} targets
 * @param {string} configPath
 */
function runEslint(cwd, targets, configPath) {
  const args = ['-c', configPath, '--format', 'json', '--no-error-on-unmatched-pattern', ...targets];
  const result = spawnSync(ESLINT_BIN, args, {
    cwd,
    shell: false,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_PATH: [join(SCRIPT_ROOT, 'node_modules'), process.env.NODE_PATH]
        .filter(Boolean)
        .join(process.platform === 'win32' ? ';' : ':'),
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    fail(`complexity: failed to spawn eslint: ${result.error.message}`);
  }
  // ESLint: 0 clean, 1 lint findings, 2 fatal.
  if (result.status === 2 || result.status === null) {
    const detail = (result.stderr || result.stdout || 'eslint failed').trim();
    fail(`complexity: eslint failed: ${detail}`);
  }
  const raw = (result.stdout || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    fail('complexity: eslint returned non-JSON output');
  }
}

/**
 * @param {string} cwd
 * @param {unknown[]} eslintResults
 * @returns {FnRow[]}
 */
function mapResults(cwd, eslintResults) {
  /** @type {Map<string, FnRow>} */
  const byKey = new Map();

  for (const fileResult of eslintResults) {
    if (!fileResult || typeof fileResult !== 'object') continue;
    const filePath = /** @type {{ filePath?: unknown, messages?: unknown }} */ (fileResult).filePath;
    const messages = /** @type {{ filePath?: unknown, messages?: unknown }} */ (fileResult).messages;
    if (typeof filePath !== 'string' || !Array.isArray(messages)) continue;
    const file = relative(cwd, filePath).split('\\').join('/') || filePath;

    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') continue;
      const ruleId = /** @type {{ ruleId?: unknown, message?: unknown, line?: unknown }} */ (msg).ruleId;
      const message = /** @type {{ ruleId?: unknown, message?: unknown, line?: unknown }} */ (msg).message;
      const lineRaw = /** @type {{ ruleId?: unknown, message?: unknown, line?: unknown }} */ (msg).line;
      if (typeof message !== 'string') continue;
      const line = typeof lineRaw === 'number' && Number.isFinite(lineRaw) ? lineRaw : 1;
      const key = `${file}\0${line}`;

      if (ruleId === 'complexity') {
        const named = CYCLOMATIC_NAMED_RE.exec(message);
        const anon = named ? null : CYCLOMATIC_ANON_RE.exec(message);
        const name = named?.[1]?.trim() || '<anonymous>';
        const cyclomatic = Number(named?.[2] ?? anon?.[1] ?? 0);
        const existing = byKey.get(key);
        if (existing) {
          existing.name = existing.name === '<anonymous>' ? name : existing.name;
          existing.cyclomatic = Math.max(existing.cyclomatic, cyclomatic);
        } else {
          byKey.set(key, { file, name, line, cyclomatic, cognitive: 0 });
        }
        continue;
      }

      if (ruleId === 'sonarjs/cognitive-complexity') {
        const match = COGNITIVE_RE.exec(message);
        const cognitive = Number(match?.[1] ?? 0);
        const existing = byKey.get(key);
        if (existing) {
          existing.cognitive = Math.max(existing.cognitive, cognitive);
        } else {
          byKey.set(key, { file, name: '<anonymous>', line, cyclomatic: 0, cognitive });
        }
      }
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const score = (row) => Math.max(row.cyclomatic, row.cognitive);
    const byScore = score(b) - score(a);
    if (byScore !== 0) return byScore;
    const byFile = a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
    if (byFile !== 0) return byFile;
    return a.line - b.line;
  });
}

/**
 * @param {FnRow[]} functions
 */
function printText(functions) {
  const header = ['file', 'name', 'line', 'cyclomatic', 'cognitive'];
  process.stdout.write(`${header.join('\t')}\n`);
  for (const row of functions) {
    process.stdout.write(`${row.file}\t${row.name}\t${row.line}\t${row.cyclomatic}\t${row.cognitive}\n`);
  }
}

function main() {
  const { maxCyclomatic, maxCognitive, format, paths } = parseArgs(process.argv.slice(2));
  ensureDeps();
  const cwd = (() => {
    const resolved = resolve(process.cwd());
    try {
      return realpathSync(resolved);
    } catch {
      return resolved;
    }
  })();
  const configPath = writeRuntimeConfig(cwd);
  let exitCode = 0;
  try {
    const targets = normalizeTargets(cwd, paths);
    const eslintResults = runEslint(cwd, targets, configPath);
    const functions = mapResults(cwd, eslintResults);
    const envelope = { schema: SCHEMA, tool: 'complexity', functions };

    if (format === 'text') {
      printText(functions);
    } else {
      process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
    }

    if (functions.some((f) => f.cyclomatic > maxCyclomatic || f.cognitive > maxCognitive)) {
      exitCode = 1;
    }
  } finally {
    try {
      unlinkSync(configPath);
    } catch {
      // best-effort cleanup
    }
  }
  process.exit(exitCode);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (!(err instanceof Error && typeof err.exitCode === 'number')) {
    process.stderr.write(`complexity: ${message}\n`);
  }
  process.exit(err instanceof Error && typeof err.exitCode === 'number' ? err.exitCode : 2);
}
