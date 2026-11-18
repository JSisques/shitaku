/**
 * Project detection from file presence and JSON manifests only: workspaces, commands, entry
 * points, stack and conventions. Pure functions over a scan snapshot; no content heuristics.
 */
import { matchAny } from './glob.mjs';

/** @typedef {import('./scan.mjs').Snapshot} Snapshot */

/**
 * @param {string} a
 * @param {string} b
 */
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * A parsed manifest, or null when it is absent or invalid.
 * @param {Snapshot} snapshot
 * @param {string} dir
 * @returns {Record<string, unknown> | null}
 */
function manifestAt(snapshot, dir) {
  const manifest = snapshot.manifests.get(dir);
  return manifest === undefined || 'invalid' in manifest ? null : manifest;
}

/** @param {unknown} value */
function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

/**
 * One list item of a YAML sequence: quoted or bare, with a trailing comment removed.
 * @param {string} raw text after the leading dash
 */
function yamlScalar(raw) {
  const text = raw.trim();
  const quote = text.charAt(0);
  if (quote === "'" || quote === '"') {
    const end = text.indexOf(quote, 1);
    return end === -1 ? text.slice(1) : text.slice(1, end);
  }
  return text.replace(/\s+#.*$/, '').trim();
}

/**
 * Minimal reader for the `packages:` list of pnpm-workspace.yaml. Nothing else is parsed.
 * @param {string} text
 * @returns {string[]}
 */
function pnpmPackages(text) {
  /** @type {string[]} */
  const patterns = [];
  let inPackages = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (/^\S/.test(line) && !line.startsWith('-')) {
      inPackages = /^packages\s*:\s*(?:#.*)?$/.test(line);
      continue;
    }
    if (!inPackages) continue;
    const item = /^\s*-\s*(.*)$/.exec(line);
    if (item !== null) {
      const scalar = yamlScalar(item[1] ?? '');
      if (scalar !== '') patterns.push(scalar);
    }
  }
  return patterns;
}

/**
 * Workspace globs from pnpm-workspace.yaml and the root package.json `workspaces` field.
 * @param {Snapshot} snapshot
 */
function workspacePatterns(snapshot) {
  const patterns = pnpmPackages(snapshot.textFiles.get('pnpm-workspace.yaml') ?? '');
  const declared = manifestAt(snapshot, '.')?.['workspaces'];
  if (Array.isArray(declared)) patterns.push(...stringList(declared));
  else if (declared !== null && typeof declared === 'object') {
    patterns.push(...stringList(/** @type {Record<string, unknown>} */ (declared)['packages']));
  }
  return patterns;
}

/**
 * @param {Snapshot} snapshot
 * @returns {{ name: string | null, path: string }[]} sorted by path
 */
export function detectWorkspaces(snapshot) {
  const patterns = workspacePatterns(snapshot);
  if (patterns.length === 0) return [];
  const workspaces = [];
  for (const dir of snapshot.manifests.keys()) {
    const manifest = manifestAt(snapshot, dir);
    if (dir === '.' || manifest === null || !matchAny(dir, patterns)) continue;
    const name = manifest['name'];
    workspaces.push({ name: typeof name === 'string' ? name : null, path: dir });
  }
  return workspaces.sort((a, b) => compare(a.path, b.path));
}

/** Lockfile to package manager, in the order they are checked. */
const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
];

/**
 * The `packageManager` field wins; otherwise the first lockfile found at the root.
 * @param {Snapshot} snapshot
 * @returns {string | null}
 */
export function detectPackageManager(snapshot) {
  const field = manifestAt(snapshot, '.')?.['packageManager'];
  if (typeof field === 'string') {
    const name = field.split('@')[0] ?? '';
    if (name !== '') return name;
  }
  const files = new Set(snapshot.files);
  for (const [lockfile, manager] of LOCKFILES) {
    if (files.has(lockfile)) return manager ?? null;
  }
  return null;
}

/**
 * Package directories that carry commands and entry points: the root plus every workspace.
 * @param {Snapshot} snapshot
 * @returns {{ path: string, manifest: Record<string, unknown> }[]} sorted by path
 */
function packageManifests(snapshot) {
  const dirs = ['.', ...detectWorkspaces(snapshot).map((workspace) => workspace.path)];
  /** @type {{ path: string, manifest: Record<string, unknown> }[]} */
  const packages = [];
  for (const path of dirs) {
    const manifest = manifestAt(snapshot, path);
    if (manifest !== null) packages.push({ path, manifest });
  }
  return packages.sort((a, b) => compare(a.path, b.path));
}

/**
 * @param {Snapshot} snapshot
 * @returns {{ packageManager: string | null, scripts: { path: string, name: string, command: string }[] }}
 */
export function detectCommands(snapshot) {
  const scripts = [];
  for (const { path, manifest } of packageManifests(snapshot)) {
    const declared = manifest['scripts'];
    if (declared === null || typeof declared !== 'object' || Array.isArray(declared)) continue;
    for (const [name, command] of Object.entries(declared)) {
      if (typeof command === 'string') scripts.push({ path, name, command });
    }
  }
  scripts.sort((a, b) => compare(a.path, b.path) || compare(a.name, b.name));
  return { packageManager: detectPackageManager(snapshot), scripts };
}
