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

/** Iterative two-pointer match of one segment: `*` spans any characters, `?` exactly one. No backtracking blow-up. */
function matchSegment(pattern: string, text: string): boolean {
  let p = 0;
  let t = 0;
  let star = -1;
  let resume = 0;
  while (t < text.length) {
    const c = pattern[p];
    if (c === '*') {
      star = p;
      resume = t;
      p += 1;
    } else if (c !== undefined && (c === '?' || c === text[t])) {
      p += 1;
      t += 1;
    } else if (star >= 0) {
      p = star + 1;
      resume += 1;
      t = resume;
    } else {
      return false;
    }
  }
  while (pattern[p] === '*') p += 1;
  return p === pattern.length;
}

/** Matches a POSIX relative path against a validated glob. `**` spans zero or more whole segments. */
export function matchGlob(glob: Glob, path: string): boolean {
  const parts = path.split('/');
  const segments = glob.segments;
  // reach[j] = the first i path segments are matched by the first j glob segments, built row by row.
  let reach: boolean[] = new Array<boolean>(segments.length + 1).fill(false);
  reach[0] = true;
  for (let j = 1; j <= segments.length; j++) reach[j] = segments[j - 1] === '**' && reach[j - 1] === true;
  for (const part of parts) {
    const next: boolean[] = new Array<boolean>(segments.length + 1).fill(false);
    for (let j = 1; j <= segments.length; j++) {
      const segment = segments[j - 1] ?? '';
      next[j] =
        segment === '**'
          ? next[j - 1] === true || reach[j] === true
          : reach[j - 1] === true && matchSegment(segment, part);
    }
    reach = next;
  }
  return reach[segments.length] === true;
}

export function matchesAny(globs: readonly Glob[], path: string): boolean {
  return globs.some((glob) => matchGlob(glob, path));
}
