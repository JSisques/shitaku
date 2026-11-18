const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** A problem in a frontmatter block. `file` is the file the problem lives in, as given by the caller. */
export type FrontmatterIssue = { issue: string; file: string };
export type FrontmatterResult = { data: Record<string, string>; body: string } | FrontmatterIssue;
/** Result of nested mode: `opaque` lists top-level keys whose (empty) value was not parsed. */
export type NestedFrontmatterResult =
  { data: Record<string, string>; opaque: string[]; body: string } | FrontmatterIssue;

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
 * `file` names the source file in issue messages. `body` is the text after the closing `---`.
 */
export function readFrontmatter(text: string, file: string, options: { allowNested: true }): NestedFrontmatterResult;
export function readFrontmatter(text: string, file: string, options?: { allowNested?: false }): FrontmatterResult;
export function readFrontmatter(
  text: string,
  file: string,
  options: { allowNested?: boolean },
): FrontmatterResult | NestedFrontmatterResult;
export function readFrontmatter(
  text: string,
  file: string,
  options: { allowNested?: boolean } = {},
): FrontmatterResult | NestedFrontmatterResult {
  const split = splitBlock(text);
  if (!split) return { issue: `${file} has no frontmatter block`, file };
  const nested = options.allowNested === true;
  const data: Record<string, string> = {};
  const opaque: string[] = [];
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
    owner = value === '' || (!nested && BLOCK_VALUE.test(value));
    if (owner) {
      if (!nested) return { issue: `frontmatter key '${line.slice(0, colon)}' has a multi-line or empty value`, file };
      opaque.push(key);
    } else data[key] = unquote(value);
  }
  return nested ? { data, opaque, body: split.body } : { data, body: split.body };
}
