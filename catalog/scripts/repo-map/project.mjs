/**
 * Project detection from file presence and JSON manifests only: workspaces, commands, entry
 * points, stack and conventions. Pure functions over a scan snapshot; no content heuristics.
 */
import { extractorFor } from './extractors.mjs';
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

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null} the value when it is a plain object
 */
function asRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
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

/**
 * Repository-relative path of a manifest target, or null when it leaves the repository.
 * @param {string} dir package directory, `.` for the root
 * @param {string} target
 * @returns {string | null}
 */
function repoRelative(dir, target) {
  if (target.startsWith('/')) return null;
  /** @type {string[]} */
  const segments = [];
  for (const segment of [...(dir === '.' ? [] : dir.split('/')), ...target.split('/')]) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') segments.push(segment);
    else if (segments.pop() === undefined) return null;
  }
  return segments.length === 0 ? null : segments.join('/');
}

/**
 * Flatten an `exports` value into string leaves keyed by the subpath and condition names
 * joined with `>`.
 * @param {unknown} value
 * @param {string[]} keys
 * @returns {{ key: string, target: string }[]}
 */
function exportLeaves(value, keys) {
  if (typeof value === 'string') return [{ key: keys.length === 0 ? '.' : keys.join('>'), target: value }];
  if (Array.isArray(value)) return value.flatMap((item) => exportLeaves(item, keys));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([name, child]) => exportLeaves(child, [...keys, name]));
}

/** @param {unknown} name */
function unscoped(name) {
  return typeof name === 'string' ? name.slice(name.lastIndexOf('/') + 1) : null;
}

/**
 * @param {Record<string, unknown>} manifest
 * @returns {{ field: string, key: string | null, target: string }[]}
 */
function manifestTargets(manifest) {
  /** @type {{ field: string, key: string | null, target: string }[]} */
  const targets = [];
  for (const field of ['main', 'module', 'types']) {
    const value = manifest[field];
    if (typeof value === 'string') targets.push({ field, key: null, target: value });
  }
  const bin = manifest['bin'];
  if (typeof bin === 'string') targets.push({ field: 'bin', key: unscoped(manifest['name']), target: bin });
  else if (bin !== null && typeof bin === 'object') {
    for (const [key, target] of Object.entries(bin)) {
      if (typeof target === 'string') targets.push({ field: 'bin', key, target });
    }
  }
  for (const { key, target } of exportLeaves(manifest['exports'], [])) targets.push({ field: 'exports', key, target });
  return targets;
}

/**
 * Files named by main, module, types, bin and exports of the root and workspace manifests.
 * @param {Snapshot} snapshot
 * @returns {{ path: string, package: string | null, field: string, key: string | null, file: string }[]}
 *   sorted by (path, field, key)
 */
export function detectEntryPoints(snapshot) {
  /** @type {Map<string, { path: string, package: string | null, field: string, key: string | null, file: string }>} */
  const entries = new Map();
  for (const { path, manifest } of packageManifests(snapshot)) {
    const name = manifest['name'];
    for (const { field, key, target } of manifestTargets(manifest)) {
      const file = repoRelative(path, target);
      if (file === null) continue;
      const entry = { path, package: typeof name === 'string' ? name : null, field, key, file };
      entries.set(JSON.stringify([path, field, key, file]), entry);
    }
  }
  return [...entries.values()].sort(
    (a, b) =>
      compare(a.path, b.path) ||
      compare(a.field, b.field) ||
      compare(a.key ?? '', b.key ?? '') ||
      compare(a.file, b.file),
  );
}

/** Dependency name to label, per tool category. */
const FRAMEWORK_DEPENDENCIES = {
  '@angular/core': 'angular',
  '@nestjs/core': 'nestjs',
  '@remix-run/react': 'remix',
  astro: 'astro',
  express: 'express',
  fastify: 'fastify',
  hono: 'hono',
  koa: 'koa',
  next: 'next',
  nuxt: 'nuxt',
  react: 'react',
  'react-native': 'react-native',
  'solid-js': 'solid',
  svelte: 'svelte',
  vue: 'vue',
};
const TEST_RUNNER_DEPENDENCIES = {
  '@playwright/test': 'playwright',
  ava: 'ava',
  cypress: 'cypress',
  jasmine: 'jasmine',
  jest: 'jest',
  mocha: 'mocha',
  vitest: 'vitest',
};
const LINTER_DEPENDENCIES = {
  '@biomejs/biome': 'biome',
  eslint: 'eslint',
  oxlint: 'oxlint',
  stylelint: 'stylelint',
  tslint: 'tslint',
};
const FORMATTER_DEPENDENCIES = { '@biomejs/biome': 'biome', dprint: 'dprint', prettier: 'prettier' };
const BUNDLER_DEPENDENCIES = {
  '@swc/core': 'swc',
  esbuild: 'esbuild',
  parcel: 'parcel',
  rolldown: 'rolldown',
  rollup: 'rollup',
  tsdown: 'tsdown',
  tsup: 'tsup',
  vite: 'vite',
  webpack: 'webpack',
};

/** Config file name patterns to label, matched against files at the root or in a workspace. */
const TEST_RUNNER_CONFIGS = [
  [/^vitest\.config\.[cm]?[jt]s$/, 'vitest'],
  [/^jest\.config\.(?:[cm]?[jt]s|json)$/, 'jest'],
];
const LINTER_CONFIGS = [
  [/^eslint\.config\.[cm]?[jt]s$/, 'eslint'],
  [/^\.eslintrc(?:\..+)?$/, 'eslint'],
  [/^biome\.jsonc?$/, 'biome'],
];
const FORMATTER_CONFIGS = [
  [/^\.prettierrc(?:\..+)?$/, 'prettier'],
  [/^prettier\.config\.[cm]?[jt]s$/, 'prettier'],
  [/^biome\.jsonc?$/, 'biome'],
];
const BUNDLER_CONFIGS = [
  [/^vite\.config\.[cm]?[jt]s$/, 'vite'],
  [/^webpack\.config\.[cm]?[jt]s$/, 'webpack'],
  [/^rollup\.config\.[cm]?[jt]s$/, 'rollup'],
  [/^tsup\.config\.[cm]?[jt]s$/, 'tsup'],
];

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'];

/**
 * Dependency name to its declared range across the root and workspace manifests; the first
 * declaration (root first, then workspaces by path) wins.
 * @param {Snapshot} snapshot
 * @returns {Map<string, string>}
 */
function collectDependencies(snapshot) {
  /** @type {Map<string, string>} */
  const dependencies = new Map();
  for (const { manifest } of packageManifests(snapshot)) {
    for (const field of DEPENDENCY_FIELDS) {
      const declared = manifest[field];
      if (declared === null || typeof declared !== 'object' || Array.isArray(declared)) continue;
      for (const [name, range] of Object.entries(declared)) {
        if (!dependencies.has(name)) dependencies.set(name, typeof range === 'string' ? range : '');
      }
    }
  }
  return dependencies;
}

/**
 * Labels for a tool category from dependency names and config files, sorted and unique.
 * @param {Map<string, string>} dependencies
 * @param {Record<string, string>} byDependency
 * @param {string[]} configFiles base names of files at the root and in workspaces
 * @param {[RegExp, string][]} byConfig
 * @returns {string[]}
 */
function toolLabels(dependencies, byDependency, configFiles, byConfig) {
  const labels = new Set();
  for (const name of dependencies.keys()) {
    if (Object.hasOwn(byDependency, name)) labels.add(byDependency[name]);
  }
  for (const [pattern, label] of byConfig) {
    if (configFiles.some((file) => pattern.test(file))) labels.add(label);
  }
  return [...labels].sort(compare);
}

/**
 * Base names of the files that sit directly in the root or in a workspace directory.
 * @param {Snapshot} snapshot
 * @returns {string[]}
 */
function packageLevelFiles(snapshot) {
  const dirs = new Set(['.', ...detectWorkspaces(snapshot).map((workspace) => workspace.path)]);
  return snapshot.files
    .filter((file) => dirs.has(file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.'))
    .map((file) => file.slice(file.lastIndexOf('/') + 1));
}

/**
 * @param {Snapshot} snapshot
 */
export function detectStack(snapshot) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const path of snapshot.sources.keys()) {
    const language = extractorFor(path)?.language;
    if (language !== undefined) counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  const languages = [...counts].map(([name, files]) => ({ name, files })).sort((a, b) => compare(a.name, b.name));

  const dependencies = collectDependencies(snapshot);
  const configFiles = packageLevelFiles(snapshot);
  const nodeRange = asRecord(manifestAt(snapshot, '.')?.['engines'])?.['node'];
  const node = typeof nodeRange === 'string' ? nodeRange : null;

  return {
    languages,
    packageManager: detectPackageManager(snapshot),
    node,
    typescript: { config: snapshot.tsconfigs.size > 0, version: dependencies.get('typescript') || null },
    frameworks: toolLabels(dependencies, FRAMEWORK_DEPENDENCIES, configFiles, []),
    testRunners: toolLabels(dependencies, TEST_RUNNER_DEPENDENCIES, configFiles, TEST_RUNNER_CONFIGS),
    linters: toolLabels(dependencies, LINTER_DEPENDENCIES, configFiles, LINTER_CONFIGS),
    formatters: toolLabels(dependencies, FORMATTER_DEPENDENCIES, configFiles, FORMATTER_CONFIGS),
    bundlers: toolLabels(dependencies, BUNDLER_DEPENDENCIES, configFiles, BUNDLER_CONFIGS),
  };
}

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const TEST_DIRECTORIES = new Set(['test', 'tests', '__tests__', 'spec', 'specs']);

/**
 * `esm`, `commonjs` or `mixed`, the way Node reads file extensions: `.mjs` and `.mts` are
 * ES modules, `.cjs` and `.cts` are CommonJS, and the other extensions follow the root `type`.
 * @param {Snapshot} snapshot
 */
function moduleSystem(snapshot) {
  const followsType = manifestAt(snapshot, '.')?.['type'] === 'module' ? 'esm' : 'commonjs';
  const systems = new Set();
  for (const path of snapshot.sources.keys()) {
    const extension = path.slice(path.lastIndexOf('.'));
    if (extension === '.mjs' || extension === '.mts') systems.add('esm');
    else if (extension === '.cjs' || extension === '.cts') systems.add('commonjs');
    else systems.add(followsType);
  }
  if (systems.size > 1) return 'mixed';
  return [...systems][0] ?? followsType;
}

/**
 * @param {Snapshot} snapshot
 * @returns {{ pattern: 'test' | 'spec' | 'mixed' | null, dirs: string[] }}
 */
function testFiles(snapshot) {
  const kinds = new Set();
  const dirs = new Set();
  for (const path of snapshot.files) {
    const kind = TEST_FILE.exec(path.slice(path.lastIndexOf('/') + 1))?.[1];
    if (kind === undefined) continue;
    kinds.add(kind);
    const segments = path.split('/').slice(0, -1);
    const marker = segments.findIndex((segment) => TEST_DIRECTORIES.has(segment));
    dirs.add(segments.slice(0, marker === -1 ? segments.length : marker + 1).join('/') || '.');
  }
  const pattern = kinds.size > 1 ? 'mixed' : kinds.has('test') ? 'test' : kinds.has('spec') ? 'spec' : null;
  return { pattern, dirs: [...dirs].sort(compare) };
}

/**
 * Keys of `compilerOptions.paths` over the root and workspace tsconfigs.
 * @param {Snapshot} snapshot
 */
function pathAliases(snapshot) {
  const aliases = new Set();
  for (const dir of ['.', ...detectWorkspaces(snapshot).map((workspace) => workspace.path)]) {
    const paths = asRecord(asRecord(asRecord(snapshot.tsconfigs.get(dir))?.['compilerOptions'])?.['paths']);
    for (const alias of Object.keys(paths ?? {})) aliases.add(alias);
  }
  return [...aliases].sort(compare);
}

/** Share of the countable relative specifiers one style needs to be reported alone. */
const EXTENSION_MAJORITY = 0.8;

/**
 * Whether TypeScript modules import their relative files with a JavaScript extension
 * (`./a.js`), without one (`./a`), or both. A style needs at least 80% of the countable
 * specifiers; directory specifiers and other dotted names such as `./data.json` are skipped.
 * @param {{ language: string, imports: { specifier: string }[] }[]} modules
 * @returns {'js' | 'none' | 'mixed' | null}
 */
function relativeImportExtensions(modules) {
  let js = 0;
  let none = 0;
  for (const module of modules) {
    if (module.language !== 'typescript' && module.language !== 'tsx') continue;
    for (const { specifier } of module.imports) {
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) continue;
      const last = specifier.slice(specifier.lastIndexOf('/') + 1);
      if (/\.(?:js|jsx|mjs|cjs)$/.test(last)) js++;
      else if (last !== '' && !last.includes('.')) none++;
    }
  }
  const total = js + none;
  if (total === 0) return null;
  if (js / total >= EXTENSION_MAJORITY) return 'js';
  return none / total >= EXTENSION_MAJORITY ? 'none' : 'mixed';
}

/**
 * Conventions read from manifests, tsconfig, file names and, when given, the extracted modules.
 * @param {Snapshot} snapshot
 * @param {{ language: string, imports: { specifier: string }[] }[]} [modules]
 */
export function detectConventions(snapshot, modules = []) {
  const strict = asRecord(asRecord(snapshot.tsconfigs.get('.'))?.['compilerOptions'])?.['strict'];
  return {
    moduleSystem: moduleSystem(snapshot),
    testFiles: testFiles(snapshot),
    relativeImportExtensions: relativeImportExtensions(modules),
    pathAliases: pathAliases(snapshot),
    tsStrict: typeof strict === 'boolean' ? strict : null,
  };
}
