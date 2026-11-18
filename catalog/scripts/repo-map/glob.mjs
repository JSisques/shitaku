/**
 * Tiny glob dialect shared by `--ignore` and workspace patterns. Pure and dependency free.
 *
 * `**` spans segments, `*` stays inside a segment, `?` is one character and everything
 * else is literal, so shell metacharacters in a pattern never mean anything special.
 */

const REGEXP_SPECIAL = /[\\^$.*+?()[\]{}|/]/;

/** @param {string} char */
function escapeChar(char) {
  return REGEXP_SPECIAL.test(char) ? `\\${char}` : char;
}

/**
 * @param {string} pattern
 * @returns {RegExp} matches a whole string
 */
export function globToRegExp(pattern) {
  const trailingAny = pattern.endsWith('/**');
  const body = trailingAny ? pattern.slice(0, -3) : pattern;
  let source = '';
  for (let i = 0; i < body.length; i++) {
    const char = body.charAt(i);
    if (char === '*') {
      if (body.charAt(i + 1) !== '*') {
        source += '[^/]*';
      } else if (body.charAt(i + 2) === '/') {
        source += '(?:.*/)?';
        i += 2;
      } else {
        source += '.*';
        i += 1;
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escapeChar(char);
    }
  }
  if (trailingAny) source += '(?:/.*)?';
  return new RegExp(`^${source}$`);
}

/** @param {string} pattern */
function normalize(pattern) {
  let value = pattern;
  while (value.startsWith('./')) value = value.slice(2);
  while (value.endsWith('/') && value.length > 1) value = value.slice(0, -1);
  return value;
}

/**
 * True when the path, or any ancestor directory of it, matches one of the patterns.
 * A pattern without `/` matches a single path segment; one with `/` is anchored at the root.
 * @param {string} path POSIX, repository relative
 * @param {string[]} patterns
 */
export function isIgnored(path, patterns) {
  const segments = path.split('/');
  const prefixes = segments.map((_, index) => segments.slice(0, index + 1).join('/'));
  for (const raw of patterns) {
    const pattern = normalize(raw);
    if (pattern === '') continue;
    const re = globToRegExp(pattern);
    const candidates = pattern.includes('/') ? prefixes : segments;
    if (candidates.some((candidate) => re.test(candidate))) return true;
  }
  return false;
}

/**
 * Workspace-style matching of a whole directory path: at least one positive pattern matches
 * and no `!` pattern does.
 * @param {string} path POSIX, repository relative
 * @param {string[]} patterns
 */
export function matchAny(path, patterns) {
  let matched = false;
  for (const raw of patterns) {
    const negated = raw.startsWith('!');
    const pattern = normalize(negated ? raw.slice(1) : raw);
    if (pattern === '' || !globToRegExp(pattern).test(path)) continue;
    if (negated) return false;
    matched = true;
  }
  return matched;
}
