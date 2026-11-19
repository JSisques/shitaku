/**
 * Filesystem shell of repo-map: lists the files of a root, reads sources and manifests within
 * size guards and returns an in-memory snapshot. Together with index.mjs it is the only module
 * allowed to touch the filesystem.
 */
import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { extractorFor } from './extractors.mjs';
import { isIgnored } from './glob.mjs';
import { parseJsonc } from './jsonc.mjs';

export const MAX_FILE_BYTES = 1_048_576;
export const BUILTIN_IGNORES = ['node_modules', 'dist', 'build', 'coverage', '.git', '.hg', '.svn', '.shitaku'];

const TEXT_FILES = new Set(['pnpm-workspace.yaml']);
const OUTPUT_FILES = new Set(['repo-map.json', 'repo-map.md']);

/**
 * @typedef {'too-large' | 'unreadable' | 'symlink' | 'invalid-json'} SkipReason
 * @typedef {{ path: string, reason: SkipReason }} Skipped
 * @typedef {{
 *   commit: string | null,
 *   files: string[],
 *   sources: Map<string, string>,
 *   manifests: Map<string, Record<string, unknown> | { invalid: true }>,
 *   tsconfigs: Map<string, unknown>, keyed by directory for tsconfig.json, by file path for extended configs
 *   skipped: Skipped[],
 *   textFiles: Map<string, string>,
 * }} Snapshot
 */

/**
 * Code-unit order, never locale dependent.
 * @param {string} a
 * @param {string} b
 */
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** @param {string} path */
function dirOf(path) {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '.' : path.slice(0, slash);
}

/** @param {string} path */
function baseOf(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * Repository-relative path of the config that a tsconfig extends, for relative `extends` values
 * that stay inside the root; null otherwise. A missing `.json` extension is added.
 * @param {string} dir directory of the extending tsconfig.json
 * @param {unknown} config parsed tsconfig
 */
function extendedConfigPath(dir, config) {
  const target =
    config !== null && typeof config === 'object' ? /** @type {{ extends?: unknown }} */ (config).extends : null;
  if (typeof target !== 'string' || !(target.startsWith('./') || target.startsWith('../'))) return null;
  const joined = posix.normalize(posix.join(dir, target));
  if (joined === '..' || joined.startsWith('../')) return null;
  return joined.endsWith('.json') ? joined : `${joined}.json`;
}

/**
 * @param {string} root absolute
 * @param {(path: string) => boolean} excluded
 * @param {Skipped[]} skipped
 * @returns {string[]} regular files, repository relative
 */
function walk(root, excluded, skipped) {
  /** @type {string[]} */
  const files = [];
  /** @param {string} relDir */
  const visit = (relDir) => {
    let entries;
    try {
      entries = readdirSync(join(root, relDir), { withFileTypes: true });
    } catch (err) {
      if (relDir === '') throw err;
      skipped.push({ path: relDir, reason: 'unreadable' });
      return;
    }
    entries.sort((a, b) => compare(a.name, b.name));
    for (const entry of entries) {
      const rel = relDir === '' ? entry.name : `${relDir}/${entry.name}`;
      if (excluded(rel)) continue;
      if (entry.isSymbolicLink()) skipped.push({ path: rel, reason: 'symlink' });
      else if (entry.isDirectory()) visit(rel);
      else if (entry.isFile()) files.push(rel);
    }
  };
  visit('');
  return files;
}

/** Variables that would redirect git away from the directory it is spawned in. */
const GIT_REDIRECT_VARS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_PREFIX'];
const GIT_MAX_BUFFER = 256 * 1024 * 1024;

/**
 * Run git read-only with a fixed argument array: no shell, `cwd` is the root, never `-C`.
 * @param {string} root absolute, real path
 * @param {string[]} args
 * @returns {string | null} stdout, or null on any failure (missing git, not a repository, ...)
 */
function runGit(root, args) {
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  for (const name of GIT_REDIRECT_VARS) delete env[name];
  const result = spawnSync('git', args, { cwd: root, shell: false, encoding: 'utf8', env, maxBuffer: GIT_MAX_BUFFER });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}

/**
 * Tracked plus untracked-not-ignored paths relative to `root`, or null when git is unusable.
 * Paths that leave the root (any `..` segment) or are absolute are dropped.
 * @param {string} root
 * @returns {string[] | null}
 */
function gitListing(root) {
  const out = runGit(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  if (out === null) return null;
  const paths = out
    .split('\0')
    .filter((path) => path !== '' && !path.startsWith('/') && !path.split('/').includes('..'));
  return [...new Set(paths)];
}

/**
 * @param {string} root
 * @returns {string | null} HEAD hash, or null (no git, no commits)
 */
function gitHead(root) {
  const out = runGit(root, ['rev-parse', 'HEAD']);
  const hash = out === null ? '' : out.trim();
  return /^[0-9a-f]{40,64}$/.test(hash) ? hash : null;
}

/**
 * Keep regular files only: tracked-but-deleted paths and submodule gitlinks fail or are
 * directories, and symlinks are recorded as skipped.
 * @param {string} root
 * @param {string[]} paths
 * @param {(path: string) => boolean} excluded
 * @param {Skipped[]} skipped
 */
function regularFiles(root, paths, excluded, skipped) {
  /** @type {string[]} */
  const files = [];
  for (const path of paths) {
    if (excluded(path)) continue;
    let stats;
    try {
      stats = lstatSync(join(root, path));
    } catch {
      continue;
    }
    if (stats.isSymbolicLink()) skipped.push({ path, reason: 'symlink' });
    else if (stats.isFile()) files.push(path);
  }
  return files;
}

/**
 * @param {string} root absolute
 * @param {string} path
 * @param {Skipped[]} skipped
 * @returns {string | null} the text, or null when it was skipped
 */
function readGuarded(root, path, skipped) {
  try {
    const abs = join(root, path);
    if (lstatSync(abs).size > MAX_FILE_BYTES) {
      skipped.push({ path, reason: 'too-large' });
      return null;
    }
    return readFileSync(abs, 'utf8');
  } catch {
    skipped.push({ path, reason: 'unreadable' });
    return null;
  }
}

/**
 * @param {string} root absolute, real path
 * @param {{ ignore: string[], outRel: string | null }} options `outRel` is the POSIX output
 *   directory relative to `root` (`''` when it is the root itself), or null when it lies
 *   outside of it
 */
export function scan(root, { ignore, outRel }) {
  /** @type {Skipped[]} */
  const skipped = [];
  const patterns = [...BUILTIN_IGNORES, ...ignore];
  /** @param {string} path */
  const inOutput = (path) => {
    if (outRel === null) return false;
    // An output directory that is the root itself only excludes the output files.
    if (outRel === '') return OUTPUT_FILES.has(path);
    return path === outRel || path.startsWith(`${outRel}/`);
  };
  /** @param {string} path */
  const excluded = (path) => inOutput(path) || isIgnored(path, patterns);

  const listed = gitListing(root);
  const commit = listed === null ? null : gitHead(root);
  const files = (listed === null ? walk(root, excluded, skipped) : regularFiles(root, listed, excluded, skipped)).sort(
    compare,
  );

  /** @type {Map<string, string>} */
  const sources = new Map();
  /** @type {Map<string, Record<string, unknown> | { invalid: true }>} */
  const manifests = new Map();
  /** @type {Map<string, unknown>} */
  const tsconfigs = new Map();
  /** @type {Map<string, string>} */
  const textFiles = new Map();

  for (const path of files) {
    const base = baseOf(path);
    const isSource = extractorFor(base) !== null;
    if (!isSource && base !== 'package.json' && base !== 'tsconfig.json' && !TEXT_FILES.has(base)) continue;
    const text = readGuarded(root, path, skipped);
    if (text === null) continue;

    if (base === 'package.json') {
      let parsed;
      try {
        parsed = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
      } catch {
        parsed = null;
      }
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        manifests.set(dirOf(path), parsed);
      } else {
        manifests.set(dirOf(path), { invalid: true });
        skipped.push({ path, reason: 'invalid-json' });
      }
    } else if (base === 'tsconfig.json') {
      try {
        tsconfigs.set(dirOf(path), parseJsonc(text));
      } catch {
        tsconfigs.set(dirOf(path), null);
      }
    } else if (TEXT_FILES.has(base)) {
      textFiles.set(path, text);
    } else {
      sources.set(path, text);
    }
  }

  // Read the relative configs that a tsconfig.json extends (one level), keyed by file path.
  const fileSet = new Set(files);
  for (const [dir, config] of [...tsconfigs]) {
    const target = extendedConfigPath(dir, config);
    if (target === null || baseOf(target) === 'tsconfig.json' || tsconfigs.has(target) || !fileSet.has(target))
      continue;
    const text = readGuarded(root, target, skipped);
    if (text === null) continue;
    try {
      tsconfigs.set(target, parseJsonc(text));
    } catch {
      tsconfigs.set(target, null);
    }
  }

  skipped.sort((a, b) => compare(a.path, b.path) || compare(a.reason, b.reason));
  return { commit, files, sources, manifests, tsconfigs, skipped, textFiles };
}
