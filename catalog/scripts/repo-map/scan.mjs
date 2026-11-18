/**
 * Filesystem shell of repo-map: lists the files of a root, reads sources and manifests within
 * size guards and returns an in-memory snapshot. Together with index.mjs it is the only module
 * allowed to touch the filesystem.
 */
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { isIgnored } from './glob.mjs';
import { parseJsonc } from './jsonc.mjs';

export const MAX_FILE_BYTES = 1_048_576;
export const BUILTIN_IGNORES = ['node_modules', 'dist', 'build', 'coverage', '.git', '.hg', '.svn', '.shitaku'];

const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx', '.js', '.mjs', '.cjs', '.jsx']);
const TEXT_FILES = new Set(['pnpm-workspace.yaml']);

/**
 * @typedef {'too-large' | 'unreadable' | 'symlink' | 'invalid-json'} SkipReason
 * @typedef {{ path: string, reason: SkipReason }} Skipped
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
 *   directory relative to `root`, or null when it lies outside of it
 */
export function scan(root, { ignore, outRel }) {
  /** @type {Skipped[]} */
  const skipped = [];
  const patterns = [...BUILTIN_IGNORES, ...ignore];
  /** @param {string} path */
  const excluded = (path) =>
    (outRel !== null && (path === outRel || path.startsWith(`${outRel}/`))) || isIgnored(path, patterns);

  const files = walk(root, excluded, skipped).sort(compare);

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
    const isSource = SOURCE_EXTENSIONS.has(extname(base));
    if (!isSource && base !== 'package.json' && base !== 'tsconfig.json' && !TEXT_FILES.has(base)) continue;
    const text = readGuarded(root, path, skipped);
    if (text === null) continue;

    if (base === 'package.json') {
      let parsed;
      try {
        parsed = JSON.parse(text);
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

  skipped.sort((a, b) => compare(a.path, b.path) || compare(a.reason, b.reason));
  return { commit: null, files, sources, manifests, tsconfigs, skipped, textFiles };
}
