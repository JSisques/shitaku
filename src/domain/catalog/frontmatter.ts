// Import-free on purpose: scripts/lib/frontmatter-description.mjs loads this file under plain Node (type stripping),
// which cannot resolve '@/' aliases or '.js' -> '.ts'. Guarded by test/domain/catalog/frontmatter-portability.test.ts.

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

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** A problem in a frontmatter block. `file` is the file the problem lives in, as given by the caller. */
export type FrontmatterIssue = { issue: string; file: string };
export type FrontmatterResult = { data: Record<string, string>; body: string } | FrontmatterIssue;
/** Result of nested mode: `opaque` lists top-level keys whose (empty) value was not parsed. */
export type NestedFrontmatterResult =
  { data: Record<string, string>; opaque: string[]; body: string } | FrontmatterIssue;
/** Result of nested mode with `mappings`: `maps` holds the block mappings of the listed keys. */
export type MappedFrontmatterResult =
  | { data: Record<string, string>; opaque: string[]; maps: Record<string, BlockMapping>; body: string }
  | FrontmatterIssue;

const unquote = (value: string): string => {
  const quote = value[0];
  return value.length >= 2 && (quote === '"' || quote === "'") && value.endsWith(quote) ? value.slice(1, -1) : value;
};

/** Strict mode only: any block-scalar-looking value is a rejected multi-line value. */
const BLOCK_VALUE = /^[|>][+-]?$/;
/** Nested mode: `|` or `>` with optional chomping and indentation indicators (either order) and a comment. */
const BLOCK_HEADER = /^([|>])(?:([1-9])([+-])?|([+-])([1-9])?)?(?:\s+#.*)?$/;

type Chomp = 'strip' | 'clip' | 'keep';
interface BlockHeader {
  folded: boolean;
  chomp: Chomp;
  indent: number | undefined;
}

const parseHeader = (value: string): BlockHeader | undefined => {
  const match = BLOCK_HEADER.exec(value);
  if (!match) return undefined;
  const sign = match[3] ?? match[4];
  const digit = match[2] ?? match[5];
  return {
    folded: match[1] === '>',
    chomp: sign === '-' ? 'strip' : sign === '+' ? 'keep' : 'clip',
    indent: digit === undefined ? undefined : Number(digit),
  };
};

const isBlank = (line: string): boolean => line.trim() === '';

/**
 * Decodes a block scalar whose content starts at `lines[start]`; `next` is the first line not consumed.
 * A whitespace-only line counts as empty (YAML keeps spaces beyond the indent on literal lines; irrelevant here).
 */
const readBlockScalar = (
  lines: readonly string[],
  start: number,
  header: BlockHeader,
  key: string,
): { value: string; next: number } | { issue: string } => {
  let indent = header.indent;
  let next = start;
  let out = '';
  let emptyLines = 0;
  let didReadContent = false;
  let atMoreIndented = false;
  const breaks = (): string => '\n'.repeat(didReadContent ? 1 + emptyLines : emptyLines);
  for (; next < lines.length; next++) {
    const line = lines[next] ?? '';
    if (isBlank(line)) {
      emptyLines++;
      continue;
    }
    const spaces = (/^ */.exec(line) ?? [''])[0].length;
    if (line[spaces] === '\t' && spaces < (indent ?? 1)) {
      return { issue: `frontmatter key '${key}' has a block scalar indented with a tab` };
    }
    if (indent === undefined) {
      if (spaces === 0) break;
      indent = spaces;
    }
    if (spaces < indent) break;
    const content = line.slice(indent);
    if (!header.folded) out += breaks();
    else if (/^[ \t]/.test(content)) {
      atMoreIndented = true;
      out += breaks();
    } else if (atMoreIndented) {
      atMoreIndented = false;
      out += '\n'.repeat(emptyLines + 1);
    } else if (emptyLines === 0) out += didReadContent ? ' ' : '';
    else out += '\n'.repeat(emptyLines);
    out += content;
    didReadContent = true;
    emptyLines = 0;
  }
  if (header.chomp === 'clip' && didReadContent) out += '\n';
  else if (header.chomp === 'keep') out += breaks();
  return { value: out, next };
};

/** Splits the block into raw lines; `undefined` when there is no frontmatter block. */
const splitBlock = (text: string): { lines: string[]; body: string } | undefined => {
  const match = FRONTMATTER.exec(text);
  if (!match) return undefined;
  return { lines: (match[1] ?? '').split(/\r?\n/), body: text.slice(match[0].length) };
};

/**
 * Minimal frontmatter reader: single-line `key: value` scalars only. A multi-line value is an issue.
 * With `allowNested`, a top-level key with a literal or folded block scalar (`|` or `>`, optional chomping and
 * indentation indicators) is decoded into `data`; a key with an empty value, plus its indented lines, is opaque:
 * its name goes to `opaque` and its value is not parsed; an indented line with no owning key is an issue.
 * With `mappings` (nested mode only), a listed key with an empty value has its indented block read one level deep
 * into `maps` instead of being opaque (see `readBlockMapping`); a listed key with an inline value stays in `data`.
 * `file` names the source file in issue messages. `body` is the text after the closing `---`.
 */
export function readFrontmatter(
  text: string,
  file: string,
  options: { allowNested: true; mappings: readonly string[] },
): MappedFrontmatterResult;
export function readFrontmatter(text: string, file: string, options: { allowNested: true }): NestedFrontmatterResult;
export function readFrontmatter(text: string, file: string, options?: { allowNested?: false }): FrontmatterResult;
export function readFrontmatter(
  text: string,
  file: string,
  options: { allowNested?: boolean; mappings?: readonly string[] },
): FrontmatterResult | NestedFrontmatterResult | MappedFrontmatterResult;
export function readFrontmatter(
  text: string,
  file: string,
  options: { allowNested?: boolean; mappings?: readonly string[] } = {},
): FrontmatterResult | NestedFrontmatterResult | MappedFrontmatterResult {
  const split = splitBlock(text);
  if (!split) return { issue: `${file} has no frontmatter block`, file };
  const nested = options.allowNested === true;
  const data: Record<string, string> = {};
  const opaque: string[] = [];
  const mappings = nested ? options.mappings : undefined;
  const maps: Record<string, BlockMapping> = {};
  let owner = false;
  for (let i = 0; i < split.lines.length; i++) {
    const line = split.lines[i] ?? '';
    if (isBlank(line)) continue;
    if (/^\s/.test(line)) {
      if (!nested) return { issue: 'frontmatter has a multi-line value, only single-line values are supported', file };
      if (!owner)
        return { issue: `frontmatter has an indented line with no owning key: ${JSON.stringify(line)}`, file };
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 1) return { issue: `frontmatter line is not 'key: value': ${line}`, file };
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    const header = nested ? parseHeader(value) : undefined;
    if (header) {
      const block = readBlockScalar(split.lines, i + 1, header, key);
      if ('issue' in block) return { issue: block.issue, file };
      data[key] = block.value;
      i = block.next - 1;
      owner = false;
      continue;
    }
    if (value === '' && mappings?.includes(key)) {
      const block = readBlockMapping(split.lines, i + 1, key);
      if ('issue' in block) return { issue: block.issue, file };
      maps[key] = block.value;
      i = block.next - 1;
      owner = false;
      continue;
    }
    owner = value === '' || (!nested && BLOCK_VALUE.test(value));
    if (owner) {
      if (!nested) return { issue: `frontmatter key '${line.slice(0, colon)}' has a multi-line or empty value`, file };
      opaque.push(key);
    } else data[key] = unquote(value);
  }
  if (!nested) return { data, body: split.body };
  return mappings ? { data, opaque, maps, body: split.body } : { data, opaque, body: split.body };
}
