/**
 * Pure core of repo-map: turns a scan snapshot into the `shitaku.catalog.repo-map/v1` document.
 * No IO. Every collection is sorted here with explicit code-unit comparators.
 */
import { extractorFor } from './extractors.mjs';
import { detectCommands, detectConventions, detectEntryPoints, detectStack, detectWorkspaces } from './project.mjs';

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

/** @param {import('./scan.mjs').Snapshot} snapshot */
function buildModules(snapshot) {
  const modules = [];
  for (const path of snapshot.sources.keys()) {
    const extractor = extractorFor(path);
    if (extractor === null) continue;
    modules.push({ path, language: extractor.language, imports: [], exports: [] });
  }
  return modules.sort((a, b) => compare(a.path, b.path));
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
    graph: {
      edges: [],
      importedByCount: Object.fromEntries(modules.map((module) => [module.path, 0])),
    },
    conventions: detectConventions(snapshot),
    skipped: [...snapshot.skipped].sort((a, b) => compare(a.path, b.path) || compare(a.reason, b.reason)),
  };
}
