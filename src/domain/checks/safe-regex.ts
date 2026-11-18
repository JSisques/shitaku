export const MAX_PATTERN_LENGTH = 200;

const QUANTIFIERS = new Set(['*', '+', '?']);

/** Index just past the `{n,m}` quantifier starting at `open`, or `open + 1` when it is not closed. */
function skipBraces(source: string, open: number): number {
  const close = source.indexOf('}', open);
  return close === -1 ? open + 1 : close + 1;
}

/** Index just past the character class starting at `open` (escapes respected). */
function skipClass(source: string, open: number): number {
  let i = open + 1;
  while (i < source.length && source[i] !== ']') i += source[i] === '\\' ? 2 : 1;
  return i + 1;
}

/** Index just past the group opener at `open`: `(`, `(?:`, `(?=`, `(?!` or `(?<name>`. */
function skipGroupOpener(source: string, open: number): number {
  if (source[open + 1] !== '?') return open + 1;
  if (source[open + 2] === '<') return source.indexOf('>', open) + 1 || open + 3;
  return open + 3;
}

/** Single pass over a pattern that already compiles; reports the first shape the guards reject. */
function scanShapes(source: string): string | undefined {
  // Each open group records whether its body has contained a quantifier so far.
  const groups: boolean[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '\\') {
      const next = source[i + 1] ?? '';
      if (/[1-9]/.test(next) || (next === 'k' && source[i + 2] === '<')) return 'pattern must not use backreferences';
      i += 2;
    } else if (char === '[') {
      i = skipClass(source, i);
    } else if (char === '(') {
      if (source.startsWith('(?<=', i) || source.startsWith('(?<!', i)) return 'pattern must not use lookbehind';
      groups.push(false);
      i = skipGroupOpener(source, i);
    } else if (char === ')') {
      const hadQuantifier = groups.pop() ?? false;
      const next = source[i + 1] ?? '';
      const quantified = QUANTIFIERS.has(next) || next === '{';
      if (hadQuantifier && quantified) return 'pattern must not contain a nested quantifier';
      if (hadQuantifier || quantified) groups[groups.length - 1] = true;
      i += 1;
    } else if (char !== undefined && (QUANTIFIERS.has(char) || char === '{')) {
      if (groups.length > 0) groups[groups.length - 1] = true;
      i = char === '{' ? skipBraces(source, i) : i + 1;
    } else {
      i += 1;
    }
  }
  return undefined;
}

/** Returns an issue when the pattern is unusable for a check, or undefined when it is accepted. */
export function validatePattern(source: string): string | undefined {
  if (source.length < 1 || source.length > MAX_PATTERN_LENGTH) {
    return `pattern must be 1 to ${MAX_PATTERN_LENGTH} characters`;
  }
  try {
    new RegExp(source, 'u');
  } catch (error) {
    return `pattern is not a valid regular expression: ${error instanceof Error ? error.message : String(error)}`;
  }
  return scanShapes(source);
}

/** Compiles a pattern accepted by `validatePattern`; `ignoreCase` is the only author-controlled flag. */
export function compilePattern(source: string, ignoreCase: boolean): RegExp {
  return new RegExp(source, ignoreCase ? 'iu' : 'u');
}
