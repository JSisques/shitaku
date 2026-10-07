const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** A problem in a frontmatter block. `file` is the file the problem lives in, as given by the caller. */
export type FrontmatterIssue = { issue: string; file: string };
export type FrontmatterResult = { data: Record<string, string>; body: string } | FrontmatterIssue;

const unquote = (value: string): string => {
  const quote = value[0];
  return value.length >= 2 && (quote === '"' || quote === "'") && value.endsWith(quote) ? value.slice(1, -1) : value;
};

/**
 * Minimal frontmatter reader: single-line `key: value` scalars only. A multi-line value is an issue.
 * `file` names the source file in issue messages. `body` is the text after the closing `---`.
 */
export function readFrontmatter(text: string, file: string): FrontmatterResult {
  const match = FRONTMATTER.exec(text);
  if (!match) return { issue: `${file} has no frontmatter block`, file };
  const data: Record<string, string> = {};
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    if (line.trim() === '') continue;
    if (/^\s/.test(line))
      return { issue: 'frontmatter has a multi-line value, only single-line values are supported', file };
    const colon = line.indexOf(':');
    if (colon < 1) return { issue: `frontmatter line is not 'key: value': ${line}`, file };
    const value = line.slice(colon + 1).trim();
    if (value === '' || /^[|>][+-]?$/.test(value)) {
      return { issue: `frontmatter key '${line.slice(0, colon)}' has a multi-line or empty value`, file };
    }
    data[line.slice(0, colon).trim()] = unquote(value);
  }
  return { data, body: text.slice(match[0].length) };
}
