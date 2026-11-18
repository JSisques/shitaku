/** A validated glob: POSIX relative path split into segments. `*`, `?` and whole-segment `**` are the only wildcards. */
export type Glob = { readonly source: string; readonly segments: readonly string[] };

export const MAX_GLOB_LENGTH = 256;

const UNSUPPORTED = ['{', '}', '[', ']', '!'] as const;

function globIssue(source: string): string | undefined {
  if (source === '') return 'glob must not be empty';
  if (source.length > MAX_GLOB_LENGTH) return `glob must be at most ${MAX_GLOB_LENGTH} characters`;
  if (source.startsWith('/')) return "glob must not start with '/'";
  if (source.includes('\\')) return 'glob must not contain a backslash';
  for (const char of UNSUPPORTED) {
    if (source.includes(char)) return `glob must not contain '${char}' (use exclude instead)`;
  }
  for (const segment of source.split('/')) {
    if (segment === '') return 'glob must not contain an empty segment';
    if (segment === '.' || segment === '..') return `glob must not contain a '${segment}' segment`;
    if (segment.includes('**') && segment !== '**') return "'**' must be a whole segment";
  }
  return undefined;
}

/** Validates glob syntax; returns the parsed glob or an issue. Matching is a separate concern. */
export function parseGlob(source: string): Glob | { issue: string } {
  const issue = globIssue(source);
  return issue === undefined ? { source, segments: source.split('/') } : { issue };
}
