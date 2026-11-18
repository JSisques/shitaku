/**
 * Per-language extractor table keyed by file extension. A language is one row; files whose
 * extension is not listed are counted in the tree but are never modules. Pure.
 */

/** @typedef {{ language: 'typescript' | 'tsx' | 'javascript' | 'jsx' }} Extractor */

/** @type {Readonly<Record<string, Readonly<Extractor>>>} */
export const EXTRACTORS = Object.freeze({
  '.ts': Object.freeze({ language: 'typescript' }),
  '.mts': Object.freeze({ language: 'typescript' }),
  '.cts': Object.freeze({ language: 'typescript' }),
  '.tsx': Object.freeze({ language: 'tsx' }),
  '.js': Object.freeze({ language: 'javascript' }),
  '.mjs': Object.freeze({ language: 'javascript' }),
  '.cjs': Object.freeze({ language: 'javascript' }),
  '.jsx': Object.freeze({ language: 'jsx' }),
});

/**
 * @param {string} path POSIX, repository relative
 * @returns {Readonly<Extractor> | null}
 */
export function extractorFor(path) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;
  const extension = base.slice(dot);
  return Object.hasOwn(EXTRACTORS, extension) ? (EXTRACTORS[extension] ?? null) : null;
}
