/**
 * Import resolution against the in-memory listing of files. Pure: it never calls the filesystem,
 * so a result depends only on what the scan saw (ignores included) and never on the host's
 * case sensitivity.
 */

/** @typedef {{ resolved: string | null, status: 'internal' | 'external' | 'unresolved' }} Resolution */

/** Extension probing order for extensionless specifiers. */
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/** JavaScript extensions that TypeScript sources are imported under. */
const TYPESCRIPT_COUNTERPART = Object.freeze({ '.js': '.ts', '.jsx': '.tsx', '.mjs': '.mts', '.cjs': '.cts' });

/** @type {Resolution} */
const UNRESOLVED = Object.freeze({ resolved: null, status: 'unresolved' });

/** @type {Resolution} */
const EXTERNAL = Object.freeze({ resolved: null, status: 'external' });

/** `https:`, `file:`, `data:` and Windows drive prefixes; `node:` is handled before this. */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Join and normalize POSIX segments. Returns null when the result climbs above the root,
 * and '' for the root itself.
 * @param {string} path
 */
function normalize(path) {
  /** @type {string[]} */
  const segments = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join('/');
}

/** @param {string} path */
function dirOf(path) {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

/**
 * Split `pkg/sub` and `@scope/pkg/sub` into the package name and the subpath ('' when none).
 * @param {string} specifier
 */
function splitPackage(specifier) {
  const segments = specifier.split('/');
  const nameLength = specifier.startsWith('@') ? 2 : 1;
  return { name: segments.slice(0, nameLength).join('/'), subpath: segments.slice(nameLength).join('/') };
}

/**
 * The `exports` value for the package root: a string, the `.` entry, or bare conditions.
 * @param {unknown} exportsField
 */
function rootExport(exportsField) {
  const map = asRecord(exportsField);
  if (map === null) return exportsField;
  if ('.' in map) return map['.'];
  return Object.keys(map).some((key) => key.startsWith('.')) ? undefined : map;
}

/**
 * Every string leaf of an `exports` value in priority order: the `import` condition first,
 * then `default`. A target that is not in the listing (for example under `dist`) falls through
 * to the next one.
 * @param {unknown} value
 * @returns {string[]}
 */
function exportsLeaves(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(exportsLeaves);
  const conditions = asRecord(value);
  return conditions === null ? [] : [...exportsLeaves(conditions['import']), ...exportsLeaves(conditions['default'])];
}

/**
 * tsconfig maps are keyed by directory with `.` for the root, while `dirOf` gives `''` there.
 * @param {string} dir
 */
function dirKey(dir) {
  return dir === '' ? '.' : dir;
}

/** @param {string} specifier */
function isRelative(specifier) {
  return specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../');
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : null;
}

/**
 * Join a repository directory (`.` or `''` for the root) and a relative path.
 * @param {string} dir
 * @param {string} relative
 */
function joinDir(dir, relative) {
  return normalize(`${dir === '.' ? '' : dir}/${relative}`);
}

/**
 * @typedef {{ dir: string, value: string }} Declared
 * @typedef {{ baseDir: string | null, paths: Record<string, string[]>, pathsDir: string }} Aliases
 */

/**
 * Match `specifier` against tsconfig `paths` patterns. The exact pattern wins, otherwise the
 * wildcard pattern with the longest prefix.
 * @param {Record<string, string[]>} paths
 * @param {string} specifier
 * @returns {{ targets: string[], capture: string } | null}
 */
function matchAlias(paths, specifier) {
  /** @type {{ targets: string[], capture: string } | null} */
  let best = null;
  let bestPrefix = -1;
  for (const [pattern, targets] of Object.entries(paths)) {
    const star = pattern.indexOf('*');
    if (star === -1) {
      if (pattern === specifier) return { targets, capture: '' };
      continue;
    }
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    const fits = specifier.length >= prefix.length + suffix.length;
    if (fits && specifier.startsWith(prefix) && specifier.endsWith(suffix) && prefix.length > bestPrefix) {
      best = { targets, capture: specifier.slice(prefix.length, specifier.length - suffix.length) };
      bestPrefix = prefix.length;
    }
  }
  return best;
}

/**
 * The parsed config at a normalized file path: `tsconfig.json` files are keyed by their
 * directory, any other config by its file path.
 * @param {Map<string, unknown>} tsconfigs
 * @param {string} path
 */
function configFile(tsconfigs, path) {
  return asRecord(
    tsconfigs.get(path === 'tsconfig.json' || path.endsWith('/tsconfig.json') ? dirKey(dirOf(path)) : path),
  );
}

/**
 * A `compilerOptions` value in effect for the tsconfig.json in `dir`: its own, else the one it
 * inherits from the config it extends (one level, relative paths only). `dir` is where the value
 * was declared, because relative values such as `baseUrl` and `paths` targets resolve against it.
 * The resolver and the conventions share this so both see the same effective config.
 * @param {Map<string, unknown>} tsconfigs
 * @param {string} dir
 * @param {string} key
 * @returns {{ dir: string, value: unknown } | null}
 */
export function compilerOption(tsconfigs, dir, key) {
  const own = asRecord(tsconfigs.get(dir));
  if (own === null) return null;
  const mine = asRecord(own['compilerOptions'])?.[key];
  if (mine !== undefined) return { dir, value: mine };
  const target = own['extends'];
  if (typeof target !== 'string' || !isRelative(target)) return null;
  const joined = joinDir(dir, target);
  if (joined === null) return null;
  const path = joined.endsWith('.json') ? joined : `${joined}.json`;
  const inherited = asRecord(configFile(tsconfigs, path)?.['compilerOptions'])?.[key];
  return inherited === undefined ? null : { dir: dirKey(dirOf(path)), value: inherited };
}

/**
 * @param {{
 *   files: Iterable<string>,
 *   tsconfigs?: Map<string, unknown>,
 *   workspaces?: { name: string | null, path: string }[],
 * }} context
 * @returns {(importer: string, specifier: string) => Resolution}
 */
export function createResolver(context) {
  const files = new Set(context.files);
  const tsconfigs = context.tsconfigs ?? new Map();
  const workspaces = context.workspaces ?? [];

  /**
   * Probe a normalized path: the exact file, its TypeScript counterpart, each extension, then
   * `<path>/index` with each extension. The first match wins.
   * @param {string} base
   * @returns {string | null}
   */
  const probe = (base) => {
    if (base !== '' && files.has(base)) return base;
    const extension = /\.(?:js|jsx|mjs|cjs)$/.exec(base)?.[0];
    if (extension !== undefined) {
      const counterpart = base.slice(0, -extension.length) + TYPESCRIPT_COUNTERPART[/** @type {'.js'} */ (extension)];
      if (files.has(counterpart)) return counterpart;
    }
    for (const candidate of EXTENSIONS) {
      if (base !== '' && files.has(base + candidate)) return base + candidate;
    }
    const prefix = base === '' ? '' : `${base}/`;
    for (const candidate of EXTENSIONS) {
      if (files.has(`${prefix}index${candidate}`)) return `${prefix}index${candidate}`;
    }
    return null;
  };

  /** @param {string | null} base */
  const internal = (base) => {
    const found = base === null ? null : probe(base);
    return found === null ? UNRESOLVED : { resolved: found, status: /** @type {const} */ ('internal') };
  };

  /** @type {Map<string, Aliases | null>} */
  const aliasCache = new Map();

  /**
   * `paths` and `baseUrl` in effect for the tsconfig in `dir`, or null when it declares none.
   * @param {string} dir
   * @returns {Aliases | null}
   */
  const aliasesIn = (dir) => {
    if (aliasCache.has(dir)) return aliasCache.get(dir) ?? null;
    const own = asRecord(tsconfigs.get(dir));
    /** @type {Aliases | null} */
    let aliases = null;
    if (own !== null) {
      /** @param {string} key */
      const option = (key) => compilerOption(tsconfigs, dir, key);
      const baseUrl = option('baseUrl');
      const pathsOption = option('paths');
      const baseDir =
        baseUrl !== null && typeof baseUrl.value === 'string' ? joinDir(baseUrl.dir, baseUrl.value) : null;
      /** @type {Record<string, string[]>} */
      const paths = {};
      for (const [pattern, targets] of Object.entries(asRecord(pathsOption?.value) ?? {})) {
        if (Array.isArray(targets)) paths[pattern] = targets.filter((target) => typeof target === 'string');
      }
      if (baseDir !== null || pathsOption !== null) {
        aliases = { baseDir, paths, pathsDir: pathsOption === null ? '' : (normalize(pathsOption.dir) ?? '') };
      }
    }
    aliasCache.set(dir, aliases);
    return aliases;
  };

  /**
   * Aliases of the nearest tsconfig among the importer's workspace directory and the root.
   * @param {string} importer
   */
  const aliasesFor = (importer) => {
    let workspace = null;
    for (const candidate of workspaces) {
      if (
        importer.startsWith(`${candidate.path}/`) &&
        (workspace === null || candidate.path.length > workspace.length)
      ) {
        workspace = candidate.path;
      }
    }
    for (const dir of workspace === null ? ['.'] : [workspace, '.']) {
      if (asRecord(tsconfigs.get(dir)) !== null) return aliasesIn(dir);
    }
    return null;
  };

  /**
   * @param {Aliases} aliases
   * @param {string} specifier
   * @returns {Resolution | null} null when the specifier is not an alias
   */
  const resolveAlias = (aliases, specifier) => {
    const match = matchAlias(aliases.paths, specifier);
    if (match !== null) {
      const base = aliases.baseDir ?? aliases.pathsDir;
      for (const target of match.targets) {
        const found = internal(joinDir(base, target.replace('*', match.capture)));
        if (found.status === 'internal') return found;
      }
      return UNRESOLVED;
    }
    if (aliases.baseDir === null) return null;
    const viaBase = internal(joinDir(aliases.baseDir, specifier));
    return viaBase.status === 'internal' ? viaBase : null;
  };

  const workspacePaths = new Map();
  for (const workspace of workspaces) {
    if (workspace.name !== null && !workspacePaths.has(workspace.name))
      workspacePaths.set(workspace.name, workspace.path);
  }
  const manifests = context.manifests ?? new Map();

  /**
   * Entry of a workspace package imported by name: the `exports` entry for `.`, then `module`,
   * `main`, `src/index.*` and `index.*`.
   * @param {string} path workspace directory
   */
  const workspaceEntry = (path) => {
    const manifest = asRecord(manifests.get(path));
    const declared =
      manifest === null
        ? []
        : [...exportsLeaves(rootExport(manifest['exports'])), manifest['module'], manifest['main']];
    for (const entry of declared) {
      const found = typeof entry === 'string' ? internal(joinDir(path, entry)) : UNRESOLVED;
      if (found.status === 'internal') return found;
    }
    const conventional = internal(joinDir(path, 'src/index'));
    return conventional.status === 'internal' ? conventional : internal(joinDir(path, 'index'));
  };

  /** @param {string} specifier */
  const resolveWorkspace = (specifier) => {
    const { name, subpath } = splitPackage(specifier);
    const path = workspacePaths.get(name);
    if (path === undefined) return null;
    return subpath === '' ? workspaceEntry(path) : internal(joinDir(path, subpath));
  };

  return (importer, specifier) => {
    if (isRelative(specifier)) {
      return internal(normalize(`${dirOf(importer)}/${specifier}`));
    }
    if (specifier.startsWith('node:')) return EXTERNAL;
    const aliases = aliasesFor(importer);
    const aliased = aliases === null ? null : resolveAlias(aliases, specifier);
    if (aliased !== null) return aliased;
    // Not an alias: subpath imports, absolute paths and URLs cannot be resolved here.
    if (/^[./#]/.test(specifier) || specifier === '' || URL_SCHEME.test(specifier)) return UNRESOLVED;
    return resolveWorkspace(specifier) ?? EXTERNAL;
  };
}
