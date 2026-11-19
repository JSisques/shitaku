/**
 * Pure core of repo-map: turns a scan snapshot into the `shitaku.catalog.repo-map/v1` document.
 * No IO. Every collection is sorted here with explicit code-unit comparators.
 */
import { extractorFor } from './extractors.mjs';
import { detectCommands, detectConventions, detectEntryPoints, detectStack, detectWorkspaces } from './project.mjs';
import { createResolver } from './resolve.mjs';

export const SCHEMA = 'shitaku.catalog.repo-map/v1';

/**
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

/**
 * Every directory that holds a file, directly or not, plus the root `.`.
 * @param {string[]} files
 */
function buildTree(files) {
  /** @type {Map<string, { files: number, totalFiles: number }>} */
  const dirs = new Map([['.', { files: 0, totalFiles: 0 }]]);
  /** @param {string} dir */
  const entry = (dir) => {
    let found = dirs.get(dir);
    if (!found) {
      found = { files: 0, totalFiles: 0 };
      dirs.set(dir, found);
    }
    return found;
  };
  for (const file of files) {
    const dir = dirOf(file);
    entry(dir).files += 1;
    // Count the file in its directory and in every ancestor up to the root.
    for (let current = dir; ; current = dirOf(current)) {
      entry(current).totalFiles += 1;
      if (current === '.') break;
    }
  }
  return [...dirs.keys()].sort(compare).map((path) => ({ path, ...entry(path) }));
}

/**
 * Extract one source. A file that makes the extractor throw is recorded with empty arrays so the
 * run never fails because of a single file.
 * @param {NonNullable<ReturnType<typeof extractorFor>>} extractor
 * @param {string} text
 */
function extractSource(extractor, text) {
  try {
    return extractor.extract(text);
  } catch {
    return { imports: [], exports: [] };
  }
}

/** @param {import('./scan.mjs').Snapshot} snapshot */
function buildModules(snapshot) {
  const resolve = createResolver({
    files: snapshot.files,
    tsconfigs: snapshot.tsconfigs,
    workspaces: detectWorkspaces(snapshot),
    manifests: snapshot.manifests,
  });
  const modules = [];
  for (const [path, text] of snapshot.sources) {
    const extractor = extractorFor(path);
    if (extractor === null) continue;
    const { imports, exports } = extractSource(extractor, text);
    modules.push({
      path,
      language: extractor.language,
      imports: imports.map(({ specifier, kind }) => ({ specifier, kind, ...resolve(path, specifier) })),
      exports,
    });
  }
  return modules.sort((a, b) => compare(a.path, b.path));
}

/**
 * Internal edges between modules, deduplicated and sorted, and the inbound count of every module.
 * @param {ReturnType<typeof buildModules>} modules
 */
function buildGraph(modules) {
  const importedByCount = Object.fromEntries(modules.map((module) => [module.path, 0]));
  /** @type {Map<string, { from: string, to: string }>} */
  const edges = new Map();
  for (const module of modules) {
    for (const { status, resolved } of module.imports) {
      if (status !== 'internal' || resolved === null || !Object.hasOwn(importedByCount, resolved)) continue;
      edges.set(`${module.path}\0${resolved}`, { from: module.path, to: resolved });
    }
  }
  const sorted = [...edges.values()].sort((a, b) => compare(a.from, b.from) || compare(a.to, b.to));
  for (const { to } of sorted) importedByCount[to] = (importedByCount[to] ?? 0) + 1;
  return { edges: sorted, importedByCount };
}

/** @param {import('./scan.mjs').Snapshot} snapshot */
function rootPackageName(snapshot) {
  const manifest = snapshot.manifests.get('.');
  const name = manifest === undefined || 'invalid' in manifest ? undefined : manifest['name'];
  return typeof name === 'string' ? name : null;
}

/**
 * @param {import('./scan.mjs').Snapshot} snapshot
 */
export function buildRepoMap(snapshot) {
  const modules = buildModules(snapshot);
  return {
    schema: SCHEMA,
    commit: snapshot.commit,
    root: { packageName: rootPackageName(snapshot) },
    stack: detectStack(snapshot),
    workspaces: detectWorkspaces(snapshot),
    commands: detectCommands(snapshot),
    entryPoints: detectEntryPoints(snapshot),
    tree: buildTree(snapshot.files),
    modules,
    graph: buildGraph(modules),
    conventions: detectConventions(snapshot, modules),
    skipped: [...snapshot.skipped].sort((a, b) => compare(a.path, b.path) || compare(a.reason, b.reason)),
  };
}
