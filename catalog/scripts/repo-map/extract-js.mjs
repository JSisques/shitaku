/**
 * Heuristic JS/TS import and export extractor over the token stream. Pure and total: it never
 * throws, and constructs it does not recognize are omitted. Static `import`/`export` forms count
 * only at brace depth 0; `require()` and `import()` calls with a literal specifier count at any depth.
 */
import { tokenize } from './tokenize-js.mjs';

/** @typedef {import('./tokenize-js.mjs').Token} Token */
/** @typedef {'static' | 'type' | 'reexport' | 'require' | 'dynamic'} ImportKind */
/** @typedef {{ specifier: string, kind: ImportKind }} RawImport */

/** @typedef {{ name: string, kind: string, signature: string | null }} RawExport */
/**
 * @typedef {{
 *   addImport: (specifier: string, kind: ImportKind) => void,
 *   addExport: (name: string, kind: string, header: number | null) => void,
 *   addListed: (local: string, name: string) => void,
 * }} Sink
 */

/** Words that start a declaration. */
const DECLARATION_KEYWORDS = new Set([
  'function',
  'class',
  'const',
  'let',
  'var',
  'interface',
  'type',
  'enum',
  'namespace',
]);

/** Words that may precede a declaration keyword and belong to its header. */
const DECLARATION_MODIFIERS = new Set(['declare', 'abstract', 'async']);

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
 * An identifier name or a quoted string name (`export { x as "str" }`).
 * @param {Token | undefined} token
 */
function nameOf(token) {
  return isIdent(token) ? (token?.value ?? null) : literalValue(token);
}

/**
 * Skip `declare`, `abstract` and `async` when another word follows them.
 * @param {Token[]} tokens
 * @param {number} index
 */
function skipModifiers(tokens, index) {
  let current = index;
  while (isModifier(tokens[current]) && isIdent(tokens[current + 1])) current++;
  return current;
}

/** @param {Token | undefined} token */
function isModifier(token) {
  return isIdent(token) && DECLARATION_MODIFIERS.has(token?.value ?? '');
}

/**
 * Index of the first modifier before the declaration keyword at `keyword`.
 * @param {Token[]} tokens
 * @param {number} keyword
 */
function headerStart(tokens, keyword) {
  let start = keyword;
  while (start > 0 && isModifier(tokens[start - 1])) start--;
  return start;
}

/**
 * Names bound by a destructuring pattern that opens at `open`. Default values are skipped
 * and a `key:` before a binding is not a name.
 * @param {Token[]} tokens
 * @param {number} open
 */
function patternNames(tokens, open) {
  /** @type {string[]} */
  const names = [];
  let depth = 0;
  for (let index = open; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === undefined) break;
    if (isPunct(token, '{') || isPunct(token, '[')) {
      depth++;
    } else if (isPunct(token, '}') || isPunct(token, ']')) {
      if (--depth === 0) break;
    } else if (isPunct(token, '=')) {
      // Skip the default value up to the next comma or closer of this pattern level.
      let nested = 0;
      for (index++; index < tokens.length; index++) {
        const inner = tokens[index];
        if (isPunct(inner, '(') || isPunct(inner, '[') || isPunct(inner, '{')) nested++;
        else if (isPunct(inner, ')') || isPunct(inner, ']') || isPunct(inner, '}')) {
          if (nested === 0) break;
          nested--;
        } else if (isPunct(inner, ',') && nested === 0) break;
      }
      index--;
    } else if (token.type === 'ident' && !isPunct(tokens[index + 1], ':') && !isPunct(tokens[index - 1], '.')) {
      names.push(token.value);
    }
  }
  return names;
}

/**
 * Names declared after `const`, `let` or `var` (first declarator only).
 * @param {Token[]} tokens
 * @param {number} index
 */
function bindingNames(tokens, index) {
  const token = tokens[index];
  if (isIdent(token)) return [token?.value ?? ''];
  return isPunct(token, '{') || isPunct(token, '[') ? patternNames(tokens, index) : [];
}

/**
 * A declaration whose keyword sits at `index`.
 * @param {Token[]} tokens
 * @param {number} index
 * @returns {{ kind: string, names: string[] } | null}
 */
function readDeclaration(tokens, index) {
  const keyword = tokens[index];
  if (!isIdent(keyword)) return null;
  const named = (/** @type {string} */ kind, /** @type {number} */ at) => {
    const name = tokens[at];
    return isIdent(name) ? { kind, names: [name?.value ?? ''] } : null;
  };
  switch (keyword?.value) {
    case 'function':
      return named('function', isPunct(tokens[index + 1], '*') ? index + 2 : index + 1);
    case 'class':
      return isIdent(tokens[index + 1], 'extends') || isIdent(tokens[index + 1], 'implements')
        ? null
        : named('class', index + 1);
    case 'interface':
    case 'enum':
    case 'namespace':
      return named(keyword.value, index + 1);
    case 'type':
      // `type Name =` or `type Name<`; a bare `type` is an ordinary identifier.
      return isPunct(tokens[index + 2], '=') || isPunct(tokens[index + 2], '<') ? named('type', index + 1) : null;
    case 'const':
      return isIdent(tokens[index + 1], 'enum')
        ? named('enum', index + 2)
        : { kind: 'const', names: bindingNames(tokens, index + 1) };
    case 'let':
    case 'var':
      return { kind: keyword.value, names: bindingNames(tokens, index + 1) };
    default:
      return null;
  }
}

/**
 * Kind of `export default <what follows>`.
 * @param {Token[]} tokens
 * @param {number} index first token after `default`
 */
function defaultKind(tokens, index) {
  const keyword = tokens[skipModifiers(tokens, index)];
  if (isIdent(keyword, 'function') || isIdent(keyword, 'class') || isIdent(keyword, 'interface')) {
    return keyword?.value ?? 'expression';
  }
  return 'expression';
}

/**
 * The `{ a, b as c }` items between `open` and `close` (exclusive) as local and exported names.
 * @param {Token[]} tokens
 * @param {number} open
 * @param {number} close
 */
function exportListItems(tokens, open, close) {
  /** @type {{ local: string, name: string }[]} */
  const items = [];
  /** @type {Token[]} */
  let item = [];
  const flush = () => {
    let parts = item;
    item = [];
    // `type` modifier: `{ type A }`, but `{ type as x }` exports a binding named type.
    if (isIdent(parts[0], 'type') && parts.length > 1 && !isIdent(parts[1], 'as')) parts = parts.slice(1);
    const local = nameOf(parts[0]);
    const name = isIdent(parts[1], 'as') ? nameOf(parts[2]) : local;
    if (local !== null && name !== null) items.push({ local, name });
  };
  for (let index = open + 1; index < close; index++) {
    const token = tokens[index];
    if (token === undefined) continue;
    if (isPunct(token, ',')) flush();
    else item.push(token);
  }
  flush();
  return items;
}

/**
 * `export ...` at depth 0. Declarations are recorded where their keyword is read; this handles
 * `default`, `*` and `{ ... }` forms. Returns the index of the last token consumed.
 * @param {Token[]} tokens
 * @param {number} start index of `export`
 * @param {Sink} sink
 */
function readExport(tokens, start, sink) {
  let index = start + 1;
  if (isIdent(tokens[index], 'default')) {
    sink.addExport('default', defaultKind(tokens, index + 1), null);
    return index;
  }
  if (isIdent(tokens[index], 'type') && (isPunct(tokens[index + 1], '{') || isPunct(tokens[index + 1], '*'))) index++;
  let star = false;
  /** @type {string | null} */
  let namespace = null;
  /** @type {{ local: string, name: string }[]} */
  let items = [];
  if (isPunct(tokens[index], '*')) {
    star = true;
    index++;
    if (isIdent(tokens[index], 'as')) {
      namespace = nameOf(tokens[index + 1]);
      index += 2;
    }
  } else if (isPunct(tokens[index], '{')) {
    const after = skipBraces(tokens, index);
    if (after === -1) return start;
    items = exportListItems(tokens, index, after - 1);
    index = after;
  } else {
    return start;
  }
  const specifier = isIdent(tokens[index], 'from') ? literalValue(tokens[index + 1]) : null;
  if (specifier === null) {
    for (const item of items) sink.addListed(item.local, item.name);
    return index - 1;
  }
  sink.addImport(specifier, 'reexport');
  if (star) sink.addExport(namespace ?? '*', namespace === null ? 'reexport-all' : 'reexport', null);
  for (const item of items) sink.addExport(item.name, 'reexport', null);
  return index + 1;
}

/**
 * The exported name of a CommonJS assignment starting at `module` or `exports`, or null.
 * @param {Token[]} tokens
 * @param {number} index
 */
function commonJsExportName(tokens, index) {
  let at = index;
  if (tokens[at]?.value === 'module') {
    if (!isPunct(tokens[at + 1], '.') || !isIdent(tokens[at + 2], 'exports')) return null;
    at += 2;
    if (isPunct(tokens[at + 1], '=')) return 'default';
  }
  const name = tokens[at + 2];
  return isPunct(tokens[at + 1], '.') && isIdent(name) && isPunct(tokens[at + 3], '=') ? (name?.value ?? null) : null;
}

/**
 * @param {string} source
 * @returns {{ imports: RawImport[], exports: RawExport[] }}
 */
export function extractJs(source) {
  const tokens = tokenize(source);
  /** @type {Map<string, RawImport>} */
  const found = new Map();
  /** @type {Map<string, { name: string, kind: string, header: number | null }>} */
  const exported = new Map();
  // Top-level declarations by name, so `export { a }` can take the kind of `a`.
  /** @type {Map<string, { kind: string, header: number }>} */
  const locals = new Map();
  /** @type {{ local: string, name: string }[]} */
  const listed = [];

  /** @type {Sink} */
  const sink = {
    addImport(specifier, kind) {
      found.set(`${kind}\0${specifier}`, { specifier, kind });
    },
    addExport(name, kind, header) {
      const key = `${name}\0${kind}`;
      if (!exported.has(key)) exported.set(key, { name, kind, header });
    },
    addListed(local, name) {
      listed.push({ local, name });
    },
  };
  const addImport = sink.addImport;

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
    } else if (depth === 0) {
      if (token.value === 'export') {
        index = readExport(tokens, index, sink);
      } else if (DECLARATION_KEYWORDS.has(token.value)) {
        const declaration = readDeclaration(tokens, index);
        if (declaration === null) continue;
        const header = headerStart(tokens, index);
        const isExported = isIdent(tokens[header - 1], 'export');
        for (const name of declaration.names) {
          if (!locals.has(name)) locals.set(name, { kind: declaration.kind, header });
          if (isExported) sink.addExport(name, declaration.kind, header);
        }
      } else if (token.value === 'module' || token.value === 'exports') {
        const name = commonJsExportName(tokens, index);
        if (name !== null) sink.addExport(name, 'commonjs', null);
      }
    }
  }

  for (const { local, name } of listed) {
    const declaration = locals.get(local);
    sink.addExport(name, declaration?.kind ?? 'named', declaration?.header ?? null);
  }

  const imports = [...found.values()].sort((a, b) => compare(a.specifier, b.specifier) || compare(a.kind, b.kind));
  const exports = [...exported.values()]
    .sort((a, b) => compare(a.name, b.name) || compare(a.kind, b.kind))
    .map(({ name, kind }) => ({ name, kind, signature: null }));
  return { imports, exports };
}
