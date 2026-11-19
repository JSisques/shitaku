/**
 * Single-pass JS/TS tokenizer. Comments are skipped (flagged as a gap before the next token),
 * strings and template literals are single tokens, and the tokenizer never throws: unknown
 * characters become `punct`. Pure.
 */

/**
 * @typedef {{
 *   type: 'ident' | 'punct' | 'string' | 'template' | 'number',
 *   value: string,
 *   start: number,
 *   end: number,
 *   line: number,
 *   gap: boolean,
 * }} Token
 */

/** Operators kept whole because later stages look at `=>`, `...` and `?.` as units. */
const MULTI_PUNCT = ['...', '===', '!==', '=>', '==', '!=', '&&', '||', '??', '?.', '++', '--'];

/** Keywords after which a `/` opens a regular expression instead of dividing. */
const REGEX_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
]);

/** Closers that end an operand, so a following `/` is a division. */
const OPERAND_END = new Set([')', ']', '}']);

const WHITESPACE = /\s/;
const IDENT_START = /[A-Za-z_$\u0080-￿]/;
const IDENT_PART = /[A-Za-z0-9_$\u0080-￿]/;
const DIGIT = /[0-9]/;
const NUMBER_PART = /[0-9A-Za-z_.]/;

/**
 * Whether a `/` at `start` opens a regular expression, judged by the previous significant token.
 * Known residual: `/` after `)` in `if (x) /re/` is read as a division.
 * @param {Token | undefined} previous
 * @param {number} start
 */
function startsRegex(previous, start) {
  if (previous === undefined) return true;
  switch (previous.type) {
    case 'number':
    case 'string':
      return false;
    case 'ident':
      return REGEX_KEYWORDS.has(previous.value);
    case 'template':
      // A chunk ending in `${` is followed by an expression; a closed template is an operand.
      return previous.value.endsWith('${');
    default:
      if (OPERAND_END.has(previous.value)) return false;
      // `</tag>`: a slash glued to `<` closes a JSX element.
      return !(previous.value === '<' && previous.end === start);
  }
}

/**
 * @param {string} source
 * @returns {Token[]}
 */
export function tokenize(source) {
  /** @type {Token[]} */
  const tokens = [];
  const length = source.length;
  let i = 0;
  let gap = false;
  // Lines are counted lazily: `counted` is how far the newline scan has reached.
  let line = 1;
  let counted = 0;
  // One brace counter per open `${` substitution; the top entry belongs to the innermost one.
  /** @type {number[]} */
  const substitutions = [];

  /** @param {number} position */
  const lineAt = (position) => {
    for (; counted < position; counted++) {
      const char = source[counted];
      // CRLF counts once (at the LF); a lone CR is a line break of its own.
      if (char === '\n' || (char === '\r' && source[counted + 1] !== '\n')) line++;
    }
    return line;
  };

  /**
   * @param {Token['type']} type
   * @param {number} start
   * @param {number} end
   */
  const emit = (type, start, end) => {
    tokens.push({ type, value: source.slice(start, end), start, end, line: lineAt(start), gap });
    gap = false;
    i = end;
  };

  /**
   * Read template text from `from` up to the closing backtick or the next `${`.
   * @param {number} from
   * @returns {number} end offset of the chunk
   */
  const templateChunkEnd = (from) => {
    let j = from;
    while (j < length) {
      const char = source[j];
      if (char === '\\') {
        j += 2;
      } else if (char === '`') {
        return j + 1;
      } else if (char === '$' && source[j + 1] === '{') {
        substitutions.push(0);
        return j + 2;
      } else {
        j++;
      }
    }
    return length;
  };

  /** @param {number} position */
  const isLineBreak = (position) => source[position] === '\n' || source[position] === '\r';

  /**
   * Skip a backslash escape at `position`; an escaped CRLF counts as one escaped break.
   * @param {number} position
   */
  const afterEscape = (position) => (source.startsWith('\r\n', position + 1) ? position + 3 : position + 2);

  /**
   * An unterminated string ends at the end of its line, as in JavaScript.
   * @param {number} start index of the opening quote
   * @returns {number} end offset of the string
   */
  const stringEnd = (start) => {
    const quote = source[start];
    let j = start + 1;
    while (j < length) {
      if (isLineBreak(j)) return j;
      const char = source[j];
      if (char === '\\') j = afterEscape(j);
      else if (char === quote) return j + 1;
      else j++;
    }
    return length;
  };

  /**
   * A regex also ends at the end of its line when unterminated; flags follow the closing slash.
   * @param {number} start index of the opening slash
   * @returns {number} end offset of the regex
   */
  const regexEnd = (start) => {
    let j = start + 1;
    let inClass = false;
    while (j < length) {
      if (isLineBreak(j)) return j;
      const char = source[j];
      if (char === '\\') {
        j = isLineBreak(j + 1) ? j + 1 : j + 2;
      } else if (char === '/' && !inClass) {
        j++;
        while (j < length && /[A-Za-z]/.test(source[j] ?? '')) j++;
        return j;
      } else {
        if (char === '[') inClass = true;
        else if (char === ']') inClass = false;
        j++;
      }
    }
    return length;
  };

  /** @param {number} start */
  const numberEnd = (start) => {
    const hex = /^0[xX]/.test(source.slice(start, start + 2));
    let j = start;
    while (j < length) {
      const char = source[j] ?? '';
      const exponentSign = (char === '+' || char === '-') && !hex && /[eE]/.test(source[j - 1] ?? '');
      if (!NUMBER_PART.test(char) && !exponentSign) break;
      j++;
    }
    return j;
  };

  while (i < length) {
    const char = source[i] ?? '';
    const next = source[i + 1];

    if (WHITESPACE.test(char)) {
      gap = true;
      i++;
    } else if (char === '/' && next === '/') {
      gap = true;
      const newline = source.indexOf('\n', i);
      i = newline === -1 ? length : newline;
    } else if (char === '/' && next === '*') {
      gap = true;
      const close = source.indexOf('*/', i + 2);
      i = close === -1 ? length : close + 2;
    } else if (char === '/' && startsRegex(tokens[tokens.length - 1], i)) {
      // Regex literals are emitted as `string` tokens; their value starts with `/`, never a quote.
      emit('string', i, regexEnd(i));
    } else if (char === '"' || char === "'") {
      emit('string', i, stringEnd(i));
    } else if (char === '`') {
      emit('template', i, templateChunkEnd(i + 1));
    } else if (char === '}' && substitutions.length > 0 && substitutions[substitutions.length - 1] === 0) {
      substitutions.pop();
      emit('template', i, templateChunkEnd(i + 1));
    } else if (DIGIT.test(char) || (char === '.' && DIGIT.test(next ?? ''))) {
      emit('number', i, numberEnd(i));
    } else if (IDENT_START.test(char)) {
      let end = i + 1;
      while (end < length && IDENT_PART.test(source[end] ?? '')) end++;
      emit('ident', i, end);
    } else {
      if (substitutions.length > 0) {
        const top = substitutions.length - 1;
        if (char === '{') substitutions[top] = (substitutions[top] ?? 0) + 1;
        else if (char === '}') substitutions[top] = (substitutions[top] ?? 1) - 1;
      }
      const multi = MULTI_PUNCT.find((operator) => source.startsWith(operator, i));
      emit('punct', i, i + (multi?.length ?? 1));
    }
  }
  return tokens;
}
