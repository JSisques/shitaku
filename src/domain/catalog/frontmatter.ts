const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** A problem in a frontmatter block. `file` is the file the problem lives in, as given by the caller. */
export type FrontmatterIssue = { issue: string; file: string };
export type FrontmatterResult = { data: Record<string, string>; body: string } | FrontmatterIssue;
/** Result of nested mode: `opaque` lists top-level keys whose (empty or block) value was not parsed. */
export type NestedFrontmatterResult =
  { data: Record<string, string>; opaque: string[]; body: string } | FrontmatterIssue;

const unquote = (value: string): string => {
  const quote = value[0];
  return value.length >= 2 && (quote === '"' || quote === "'") && value.endsWith(quote) ? value.slice(1, -1) : value;
};

const BLOCK_VALUE = /^[|>][+-]?$/;

/** Splits the block into non-blank lines; `undefined` when there is no frontmatter block. */
const splitBlock = (text: string): { lines: string[]; body: string } | undefined => {
  const match = FRONTMATTER.exec(text);
  if (!match) return undefined;
  return {
    lines: (match[1] ?? '').split(/\r?\n/).filter((line) => line.trim() !== ''),
    body: text.slice(match[0].length),
  };
};

/**
 * Minimal frontmatter reader: single-line `key: value` scalars only. A multi-line value is an issue.
 * With `allowNested`, a top-level key with an empty or block value, plus its indented lines, is opaque:
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
  for (const line of split.lines) {
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
    owner = value === '' || BLOCK_VALUE.test(value);
    if (owner) {
      if (!nested) return { issue: `frontmatter key '${line.slice(0, colon)}' has a multi-line or empty value`, file };
      opaque.push(key);
    } else data[key] = unquote(value);
  }
  return nested ? { data, opaque, body: split.body } : { data, body: split.body };
}
