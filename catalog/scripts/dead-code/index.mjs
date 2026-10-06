#!/usr/bin/env node
/**
 * Catalog dead-code script: resolve knip (cwd .bin then npx), spawn --reporter json,
 * map issues to shitaku.catalog.dead-code/v1, apply --include, print JSON|text, exit 0/1/2.
 * No script-root npm bootstrap; never passes --fix; never mutates the consumer project.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SCHEMA = 'shitaku.catalog.dead-code/v1';
const TOOL = 'dead-code';
const FINDING_KINDS = /** @type {const} */ ([
  'files',
  'exports',
  'types',
  'dependencies',
  'devDependencies',
  'unlisted',
]);

/**
 * @typedef {'files'|'exports'|'types'|'dependencies'|'devDependencies'|'unlisted'} FindingKind
 * @typedef {{ file: string, name: string, line?: number, col?: number }} Finding
 * @typedef {Record<FindingKind, Finding[]>} Findings
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
 * Mirror of resolveToolInvocation — prefer cwd .bin, else npx.
 * @param {string} cwd
 * @param {string} tool
 * @param {string} platform
 * @returns {{ kind: 'local-bin', command: string } | { kind: 'npx', command: string, prefixArgs: string[] }}
 */
function resolveKnip(cwd, tool, platform) {
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
  /** @type {FindingKind[]|null} */
  let include = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--fix') {
      fail('dead-code: --fix is not supported');
    }
    if (arg === '--format') {
      format = String(argv[++i] ?? '');
      continue;
    }
    if (arg === '--include') {
      const raw = String(argv[++i] ?? '');
      if (!raw) fail('dead-code: --include requires a value');
      const tokens = raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      include = include ?? [];
      for (const token of tokens) {
        if (!FINDING_KINDS.includes(/** @type {FindingKind} */ (token))) {
          fail(`dead-code: unknown --include kind ${token}`);
        }
        if (!include.includes(/** @type {FindingKind} */ (token))) {
          include.push(/** @type {FindingKind} */ (token));
        }
      }
      continue;
    }
    if (arg.startsWith('-')) {
      fail(`dead-code: unsupported option ${arg}`);
    }
    fail(`dead-code: unexpected argument ${arg}`);
  }
  if (format !== 'json' && format !== 'text') {
    fail(`dead-code: unsupported --format ${format || '(missing)'}`);
  }
  return { format, include };
}

/**
 * @param {string} cwd
 */
function readPackageJson(cwd) {
  const path = join(cwd, 'package.json');
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    fail('dead-code: failed to read package.json');
  }
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} pkg
 * @returns {'dependencies'|'devDependencies'}
 */
function classifyDependency(name, pkg) {
  const deps = /** @type {Record<string, unknown>|undefined} */ (pkg.dependencies);
  const peer = /** @type {Record<string, unknown>|undefined} */ (pkg.peerDependencies);
  const optional = /** @type {Record<string, unknown>|undefined} */ (pkg.optionalDependencies);
  const dev = /** @type {Record<string, unknown>|undefined} */ (pkg.devDependencies);
  if (
    (deps && Object.hasOwn(deps, name)) ||
    (peer && Object.hasOwn(peer, name)) ||
    (optional && Object.hasOwn(optional, name))
  ) {
    return 'dependencies';
  }
  if (dev && Object.hasOwn(dev, name)) return 'devDependencies';
  return 'dependencies';
}

/**
 * @param {FindingKind[]|null} include
 * @returns {string[]|undefined} knip --include tokens (devDependencies → dependencies)
 */
function knipIncludeArgs(include) {
  if (!include || include.length === 0) return undefined;
  /** @type {Set<string>} */
  const knipKinds = new Set();
  for (const kind of include) {
    if (kind === 'devDependencies') knipKinds.add('dependencies');
    else knipKinds.add(kind);
  }
  return [...knipKinds];
}

/**
 * @param {string} cwd
 * @param {FindingKind[]|null} include
 */
function runKnip(cwd, include) {
  const invocation = resolveKnip(cwd, 'knip', process.platform);
  /** @type {string[]} */
  const args = [];
  if (invocation.kind === 'npx') args.push(...invocation.prefixArgs);
  args.push('--reporter', 'json');
  const knipInclude = knipIncludeArgs(include);
  if (knipInclude) {
    args.push('--include', knipInclude.join(','));
  }

  const result = spawnSync(invocation.command, args, {
    cwd,
    shell: false,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) {
    fail(`dead-code: failed to spawn knip: ${result.error.message}`);
  }
  if (result.status === null) {
    fail('dead-code: knip terminated without an exit status');
  }

  const raw = (result.stdout || '').trim();
  if (!raw) {
    const detail = (result.stderr || 'knip produced no JSON output').trim();
    fail(`dead-code: knip failed: ${detail}`);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.issues)) {
      fail('dead-code: knip returned unexpected JSON shape');
    }
    return /** @type {{ issues: Record<string, unknown>[] }} */ (parsed);
  } catch (err) {
    if (err instanceof Error && typeof err.exitCode === 'number') throw err;
    fail('dead-code: knip returned non-JSON output');
  }
}

/**
 * @param {unknown} items
 * @param {string} file
 * @returns {Finding[]}
 */
function mapIssueItems(items, file) {
  if (!Array.isArray(items)) return [];
  /** @type {Finding[]} */
  const out = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const name = /** @type {{ name?: unknown }} */ (item).name;
    if (typeof name !== 'string' || !name) continue;
    /** @type {Finding} */
    const finding = { file, name };
    const line = /** @type {{ line?: unknown }} */ (item).line;
    const col = /** @type {{ col?: unknown }} */ (item).col;
    if (typeof line === 'number' && Number.isFinite(line)) finding.line = line;
    if (typeof col === 'number' && Number.isFinite(col)) finding.col = col;
    out.push(finding);
  }
  return out;
}

/**
 * @param {Finding} a
 * @param {Finding} b
 */
function compareFindings(a, b) {
  if (a.file < b.file) return -1;
  if (a.file > b.file) return 1;
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  const al = a.line ?? 0;
  const bl = b.line ?? 0;
  return al - bl;
}

/**
 * @param {{ issues: Record<string, unknown>[] }} knipJson
 * @param {Record<string, unknown>} pkg
 * @returns {Findings}
 */
function mapToFindings(knipJson, pkg) {
  /** @type {Findings} */
  const findings = {
    files: [],
    exports: [],
    types: [],
    dependencies: [],
    devDependencies: [],
    unlisted: [],
  };

  for (const issue of knipJson.issues) {
    if (!issue || typeof issue !== 'object') continue;
    const file = typeof issue.file === 'string' ? issue.file : '';
    if (!file) continue;

    findings.files.push(...mapIssueItems(issue.files, file));
    findings.exports.push(...mapIssueItems(issue.exports, file));
    findings.types.push(...mapIssueItems(issue.types, file));
    findings.unlisted.push(...mapIssueItems(issue.unlisted, file));

    for (const dep of mapIssueItems(issue.dependencies, file)) {
      const bucket = classifyDependency(dep.name, pkg);
      findings[bucket].push(dep);
    }
  }

  for (const kind of FINDING_KINDS) {
    findings[kind].sort(compareFindings);
  }
  return findings;
}

/**
 * @param {Findings} findings
 * @param {FindingKind[]|null} include
 * @returns {Findings}
 */
function filterInclude(findings, include) {
  if (!include || include.length === 0) return findings;
  /** @type {Findings} */
  const filtered = {
    files: [],
    exports: [],
    types: [],
    dependencies: [],
    devDependencies: [],
    unlisted: [],
  };
  for (const kind of include) {
    filtered[kind] = findings[kind];
  }
  return filtered;
}

/**
 * @param {Findings} findings
 */
function hasAnyFinding(findings) {
  return FINDING_KINDS.some((kind) => findings[kind].length > 0);
}

/**
 * @param {Findings} findings
 */
function printText(findings) {
  for (const kind of FINDING_KINDS) {
    for (const row of findings[kind]) {
      const parts = [kind, row.file, row.name];
      if (row.line != null) parts.push(String(row.line));
      if (row.col != null) parts.push(String(row.col));
      process.stdout.write(`${parts.join('\t')}\n`);
    }
  }
}

function main() {
  const { format, include } = parseArgs(process.argv.slice(2));
  const cwd = (() => {
    const resolved = resolve(process.cwd());
    try {
      return realpathSync(resolved);
    } catch {
      return resolved;
    }
  })();

  const pkg = readPackageJson(cwd);
  const knipJson = runKnip(cwd, include);
  const findings = filterInclude(mapToFindings(knipJson, pkg), include);
  const envelope = { schema: SCHEMA, tool: TOOL, findings };

  if (format === 'text') {
    printText(findings);
  } else {
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  }

  process.exit(hasAnyFinding(findings) ? 1 : 0);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (!(err instanceof Error && typeof err.exitCode === 'number')) {
    process.stderr.write(`dead-code: ${message}\n`);
  }
  process.exit(err instanceof Error && typeof err.exitCode === 'number' ? err.exitCode : 2);
}
