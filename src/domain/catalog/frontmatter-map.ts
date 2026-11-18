/** A mapping value: a single decoded scalar, or a list of decoded scalars (block sequence). */
export type MappingValue = string | string[];
/** One nested mapping level: keys to scalars or lists of scalars. */
export type BlockMapping = Record<string, MappingValue>;

type Scalar = { value: string } | { reason: string };

const KEY = /^[a-z][a-z0-9-]*$/;
/** After a closing quote only whitespace or a ` # comment` may follow. */
const QUOTED_TAIL = /^(?:\s+#.*|\s*)$/;
const DOUBLE_QUOTE_ESCAPES: Readonly<Record<string, string>> = { '\\': '\\', '"': '"', '/': '/', n: '\n', t: '\t' };
const INDICATOR_REASONS: Readonly<Record<string, string>> = {
  '[': 'is a flow collection, which is not supported',
  '{': 'is a flow collection, which is not supported',
  '&': 'is an anchor, which is not supported',
  '*': 'is an alias, which is not supported',
  '!': 'is a tag, which is not supported',
  '|': 'is a block scalar, which is not supported',
  '>': 'is a block scalar, which is not supported',
};
/** Other characters that cannot start a plain scalar in this subset. */
const PLAIN_INDICATORS = ']}%@`,?-#';

const isBlank = (line: string): boolean => line.trim() === '';
const indentOf = (line: string): number => line.length - line.trimStart().length;
const hasTabIndent = (line: string): boolean => /^[ \t]*\t/.test(line);
const isDash = (text: string): boolean => text === '-' || text.startsWith('- ');

/** Decodes a single-quoted scalar (`''` is a quote, no other escapes). */
const readSingleQuoted = (text: string): Scalar => {
  let out = '';
  for (let i = 1; i < text.length; i++) {
    const char = text[i];
    if (char !== "'") out += char;
    else if (text[i + 1] === "'") {
      out += "'";
      i++;
    } else {
      return QUOTED_TAIL.test(text.slice(i + 1))
        ? { value: out }
        : { reason: 'has text after the closing single quote' };
    }
  }
  return { reason: 'has an unterminated single-quoted value' };
};

/** Decodes a double-quoted scalar with the escapes `\\ \" \/ \n \t` only. */
const readDoubleQuoted = (text: string): Scalar => {
  let out = '';
  for (let i = 1; i < text.length; i++) {
    const char = text[i] ?? '';
    if (char === '"') {
      return QUOTED_TAIL.test(text.slice(i + 1))
        ? { value: out }
        : { reason: 'has text after the closing double quote' };
    }
    if (char !== '\\') {
      out += char;
      continue;
    }
    const escaped = text[++i];
    const decoded = escaped === undefined ? undefined : DOUBLE_QUOTE_ESCAPES[escaped];
    if (decoded === undefined) {
      return { reason: `has the unsupported escape '\\${escaped ?? ''}'; use single quotes for text with backslashes` };
    }
    out += decoded;
  }
  return { reason: 'has an unterminated double-quoted value' };
};

const readPlain = (text: string): Scalar => {
  const first = text[0] ?? '';
  const indicator = INDICATOR_REASONS[first];
  if (indicator) return { reason: `value ${indicator}` };
  if (PLAIN_INDICATORS.includes(first)) {
    return { reason: `value starts with the YAML indicator '${first}'; quote the value` };
  }
  const value = text.replace(/\s+#.*$/, '').trimEnd();
  if (/:(\s|$)/.test(value)) return { reason: 'value has a colon followed by a space or at the end; quote the value' };
  return { value };
};

/** Decodes one scalar (the text after `key:` or `- `), quoted or plain, without its trailing comment. */
const readScalar = (text: string): Scalar => {
  if (text.startsWith("'")) return readSingleQuoted(text);
  if (text.startsWith('"')) return readDoubleQuoted(text);
  return readPlain(text);
};

/**
 * Reads the indented block that starts at `lines[start]` (the line after `key:`) as one level of mapping whose
 * values are scalars or block sequences of scalars. It accepts a strict subset of YAML 1.2: anything it accepts a
 * standard YAML parser reads the same way, and anything else is an issue naming `key` and the offending line.
 * The block ends at the first non-blank line with no indentation; `next` is that line's index (or the end).
 */
export function readBlockMapping(
  lines: readonly string[],
  start: number,
  key: string,
): { value: BlockMapping; next: number } | { issue: string } {
  const fail = (reason: string, line?: string): { issue: string } => ({
    issue: `frontmatter key '${key}' ${reason}${line === undefined ? '' : ` (line: ${line.trim()})`}`,
  });
  /** First index at or after `from` that is not blank and not an indented full-line comment. */
  const skip = (from: number): number => {
    let i = from;
    while (i < lines.length) {
      const line = lines[i] ?? '';
      if (!isBlank(line) && !(line.trimStart().startsWith('#') && indentOf(line) > 0)) break;
      i++;
    }
    return i;
  };

  const value: BlockMapping = {};
  let indent = 0;
  let i = skip(start);
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (hasTabIndent(line)) return fail('is indented with a tab, which is not supported', line);
    const lineIndent = indentOf(line);
    if (lineIndent === 0) break;
    if (indent === 0) indent = lineIndent;
    if (lineIndent < indent) return fail('has inconsistent indentation', line);
    const previous = Object.values(value).at(-1);
    if (lineIndent > indent) {
      return fail(
        typeof previous === 'string'
          ? 'has a multi-line scalar, which is not supported'
          : 'has a nested mapping deeper than one level, which is not supported',
        line,
      );
    }

    const text = line.trim();
    const colon = text.indexOf(':');
    const name = colon < 0 ? '' : text.slice(0, colon);
    const rest = text.slice(colon + 1);
    if (colon < 0 || (rest !== '' && !rest.startsWith(' '))) return fail("has a line that is not 'key: value'", line);
    if (!KEY.test(name))
      return fail(`has the invalid key '${name}'; keys use lowercase letters, digits and dashes`, line);
    if (Object.hasOwn(value, name)) return fail(`has a duplicate key '${name}'`, line);

    const inline = rest.trim();
    if (inline !== '' && !inline.startsWith('#')) {
      const scalar = readScalar(inline);
      if ('reason' in scalar) return fail(`line ${scalar.reason}`, line);
      value[name] = scalar.value;
      i = skip(i + 1);
      continue;
    }

    const items: string[] = [];
    let itemIndent = -1;
    i = skip(i + 1);
    for (; i < lines.length; i = skip(i + 1)) {
      const item = lines[i] ?? '';
      if (hasTabIndent(item)) return fail('is indented with a tab, which is not supported', item);
      const itemText = item.trim();
      if (indentOf(item) < indent || !isDash(itemText)) break;
      if (itemIndent < 0) itemIndent = indentOf(item);
      if (indentOf(item) !== itemIndent) return fail('has inconsistent sequence indentation', item);
      const body = itemText.slice(1).trim();
      if (body === '' || body.startsWith('#')) return fail('has an empty sequence item', item);
      const scalar = readScalar(body);
      if ('reason' in scalar) return fail(`sequence item ${scalar.reason}`, item);
      items.push(scalar.value);
    }
    if (items.length === 0) {
      const below = lines[i] ?? '';
      return indentOf(below) > indent
        ? fail('has a nested mapping deeper than one level, which is not supported', below)
        : fail(`has an empty value for '${name}'`, line);
    }
    value[name] = items;
  }
  if (indent === 0) return fail('has an empty mapping block');
  return { value, next: i };
}
