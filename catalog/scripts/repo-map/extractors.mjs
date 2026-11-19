/**
 * Per-language extractor table keyed by file extension. A language is one row; files whose
 * extension is not listed are counted in the tree but are never modules. Pure.
 */

import { extractJs } from './extract-js.mjs';

/**
 * @typedef {{
 *   language: 'typescript' | 'tsx' | 'javascript' | 'jsx',
 *   extract: (source: string) => { imports: import('./extract-js.mjs').RawImport[], exports: import('./extract-js.mjs').RawExport[] },
 * }} Extractor
 */

/** @type {Readonly<Record<string, Readonly<Extractor>>>} */
export const EXTRACTORS = Object.freeze({
  '.ts': Object.freeze({ language: 'typescript', extract: extractJs }),
  '.mts': Object.freeze({ language: 'typescript', extract: extractJs }),
  '.cts': Object.freeze({ language: 'typescript', extract: extractJs }),
  '.tsx': Object.freeze({ language: 'tsx', extract: extractJs }),
  '.js': Object.freeze({ language: 'javascript', extract: extractJs }),
  '.mjs': Object.freeze({ language: 'javascript', extract: extractJs }),
  '.cjs': Object.freeze({ language: 'javascript', extract: extractJs }),
  '.jsx': Object.freeze({ language: 'jsx', extract: extractJs }),
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
