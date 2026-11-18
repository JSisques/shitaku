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

/** @param {string} specifier */
function isRelative(specifier) {
  return specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../');
}

/**
 * @param {{ files: Iterable<string> }} context
 * @returns {(importer: string, specifier: string) => Resolution}
 */
export function createResolver(context) {
  const files = new Set(context.files);

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

  return (importer, specifier) => {
    if (isRelative(specifier)) {
      return internal(normalize(`${dirOf(importer)}/${specifier}`));
    }
    return UNRESOLVED;
  };
}
