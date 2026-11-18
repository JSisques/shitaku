/**
 * Heuristic JS/TS import and export extractor over the token stream. Pure and total: it never
 * throws, and constructs it does not recognize are omitted. Static `import`/`export` forms count
 * only at brace depth 0; `require()` and `import()` calls with a literal specifier count at any depth.
 */
import { tokenize } from './tokenize-js.mjs';

/** @typedef {import('./tokenize-js.mjs').Token} Token */
/** @typedef {'static' | 'type' | 'reexport' | 'require' | 'dynamic'} ImportKind */
/** @typedef {{ specifier: string, kind: ImportKind }} RawImport */

/** Statement keywords that cannot appear inside an import clause: a broken clause stops there. */
const CLAUSE_STOP_KEYWORDS = new Set(['const', 'let', 'var', 'function', 'class']);

/**
 * @param {string} a
 * @param {string} b
 */
function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * @param {Token | undefined} token
 * @param {string} [value]
 */
function isIdent(token, value) {
  return token !== undefined && token.type === 'ident' && (value === undefined || token.value === value);
}

/**
 * @param {Token | undefined} token
 * @param {string} value
 */
function isPunct(token, value) {
  return token !== undefined && token.type === 'punct' && token.value === value;
}

/**
 * The text of a closed quoted string token, or null for anything else (regex, template,
 * unterminated string).
 * @param {Token | undefined} token
 */
function literalValue(token) {
  if (token === undefined || token.type !== 'string') return null;
  const quote = token.value[0];
  if ((quote !== '"' && quote !== "'") || token.value.length < 2 || !token.value.endsWith(quote)) return null;
  return token.value.slice(1, -1);
}

/**
 * `callee ( 'literal' )` or `callee ( 'literal' , ...)`: the literal when the first argument is one.
 * @param {Token[]} tokens
 * @param {number} index index of the callee
 * @param {boolean} allowSecondArgument
 */
function literalCallArgument(tokens, index, allowSecondArgument) {
  if (!isPunct(tokens[index + 1], '(')) return null;
  const specifier = literalValue(tokens[index + 2]);
  if (specifier === null) return null;
  const after = tokens[index + 3];
  return isPunct(after, ')') || (allowSecondArgument && isPunct(after, ',')) ? specifier : null;
}

/**
 * `import ...` at depth 0. Returns the index of the last token consumed.
 * @param {Token[]} tokens
 * @param {number} start index of `import`
 * @param {(specifier: string, kind: ImportKind) => void} addImport
 */
function readImport(tokens, start, addImport) {
  let index = start + 1;
  const bare = literalValue(tokens[index]);
  if (bare !== null) {
    addImport(bare, 'static');
    return index;
  }
  /** @type {ImportKind} */
  let kind = 'static';
  if (isIdent(tokens[index], 'type')) {
    const after = tokens[index + 1];
    const defaultNamedType = isIdent(after, 'from') && literalValue(tokens[index + 2]) !== null;
    if (after !== undefined && !defaultNamedType && !isPunct(after, ',')) kind = 'type';
  }
  let braces = 0;
  for (; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === undefined) break;
    if (token.type === 'ident') {
      const member = isPunct(tokens[index - 1], '.') || isPunct(tokens[index - 1], '?.');
      if (!member && (token.value === 'import' || token.value === 'export' || CLAUSE_STOP_KEYWORDS.has(token.value))) {
        return index - 1;
      }
      if (token.value === 'from' && braces <= 0) {
        const specifier = literalValue(tokens[index + 1]);
        if (specifier !== null) {
          addImport(specifier, kind);
          return index + 1;
        }
      }
      if (token.value === 'require' && !member) {
        // TypeScript `import x = require('y')`
        const specifier = literalCallArgument(tokens, index, false);
        if (specifier !== null) {
          addImport(specifier, 'require');
          return index + 3;
        }
      }
    } else if (isPunct(token, '{')) {
      braces++;
    } else if (isPunct(token, '}')) {
      braces--;
    } else if (isPunct(token, ';') && braces <= 0) {
      return index;
    }
  }
  return tokens.length - 1;
}

/**
 * Index just past the `}` that closes the `{` at `open`, or -1 when it never closes.
 * @param {Token[]} tokens
 * @param {number} open
 */
function skipBraces(tokens, open) {
  let depth = 0;
  for (let index = open; index < tokens.length; index++) {
    if (isPunct(tokens[index], '{')) depth++;
    else if (isPunct(tokens[index], '}') && --depth === 0) return index + 1;
  }
  return -1;
}

/**
 * `export ...` at depth 0. Returns the index of the last token consumed.
 * @param {Token[]} tokens
 * @param {number} start index of `export`
 * @param {(specifier: string, kind: ImportKind) => void} addImport
 */
function readExport(tokens, start, addImport) {
  let index = start + 1;
  if (isIdent(tokens[index], 'type') && (isPunct(tokens[index + 1], '{') || isPunct(tokens[index + 1], '*'))) index++;
  if (isPunct(tokens[index], '*')) {
    index++;
    if (isIdent(tokens[index], 'as')) index += 2;
  } else if (isPunct(tokens[index], '{')) {
    index = skipBraces(tokens, index);
    if (index === -1) return start;
  } else {
    return start;
  }
  const specifier = isIdent(tokens[index], 'from') ? literalValue(tokens[index + 1]) : null;
  if (specifier === null) return index - 1;
  addImport(specifier, 'reexport');
  return index + 1;
}

/**
 * @param {string} source
 * @returns {{ imports: RawImport[] }}
 */
export function extractJs(source) {
  const tokens = tokenize(source);
  /** @type {Map<string, RawImport>} */
  const found = new Map();
  /**
   * @param {string} specifier
   * @param {ImportKind} kind
   */
  const addImport = (specifier, kind) => {
    found.set(`${kind}\0${specifier}`, { specifier, kind });
  };

  let depth = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === undefined) break;
    if (token.type === 'punct') {
      if (token.value === '{') depth++;
      else if (token.value === '}') depth = Math.max(0, depth - 1);
      continue;
    }
    if (token.type !== 'ident') continue;
    // `obj.require(...)` and `obj.import` are member accesses, never module syntax.
    if (isPunct(tokens[index - 1], '.') || isPunct(tokens[index - 1], '?.')) continue;

    if (token.value === 'require') {
      const specifier = literalCallArgument(tokens, index, false);
      if (specifier !== null) addImport(specifier, 'require');
    } else if (token.value === 'import') {
      if (isPunct(tokens[index + 1], '(')) {
        const specifier = literalCallArgument(tokens, index, true);
        if (specifier !== null) addImport(specifier, 'dynamic');
      } else if (!isPunct(tokens[index + 1], '.') && depth === 0) {
        index = readImport(tokens, index, addImport);
      }
    } else if (token.value === 'export' && depth === 0) {
      index = readExport(tokens, index, addImport);
    }
  }

  const imports = [...found.values()].sort((a, b) => compare(a.specifier, b.specifier) || compare(a.kind, b.kind));
  return { imports };
}
