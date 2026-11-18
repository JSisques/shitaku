import { describe, expect, it } from 'vitest';
import { MAX_PATTERN_LENGTH, compilePattern, validatePattern } from '@/domain/checks/safe-regex.js';

describe('validatePattern', () => {
  it.each([':\\s*any\\b', 'todo', '\\bfoo(bar)?\\b', '[+*]+', '\\(a+\\)+', '(?:ab)+', '(?<n>a)b', '(a|b)+'])(
    'accepts %s',
    (source) => {
      expect(validatePattern(source)).toBeUndefined();
    },
  );

  it.each([
    ['', '1 to 200'],
    ['a'.repeat(MAX_PATTERN_LENGTH + 1), '1 to 200'],
    ['(unclosed', 'not a valid regular expression'],
    ['\\p{Nope}', 'not a valid regular expression'],
    ['\\-', 'not a valid regular expression'],
    ['(a+)+', 'nested quantifier'],
    ['(a*)*', 'nested quantifier'],
    ['(\\w+\\s?)*', 'nested quantifier'],
    ['((a+))+', 'nested quantifier'],
    ['(a+){2,}', 'nested quantifier'],
    ['(a)\\1', 'backreference'],
    ['(?<n>a)\\k<n>', 'backreference'],
    ['(?<=a)b', 'lookbehind'],
    ['(?<!a)b', 'lookbehind'],
  ])('rejects %j', (source, reason) => {
    expect(validatePattern(source)).toContain(reason);
  });

  it('accepts a pattern at the length limit', () => {
    expect(validatePattern('a'.repeat(MAX_PATTERN_LENGTH))).toBeUndefined();
  });
});

describe('compilePattern', () => {
  it('compiles in unicode mode, adding i only when asked', () => {
    expect(compilePattern('todo', false).flags).toBe('u');
    expect(compilePattern('todo', true).flags).toBe('iu');
    expect(compilePattern('todo', true).test('// TODO')).toBe(true);
  });
});
