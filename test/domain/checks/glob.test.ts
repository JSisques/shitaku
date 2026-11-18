import { describe, expect, it } from 'vitest';
import { matchGlob, matchesAny, parseGlob, type Glob } from '@/domain/checks/glob.js';

describe('parseGlob', () => {
  it.each([
    ['src/**/*.ts', ['src', '**', '*.ts']],
    ['*.md', ['*.md']],
    ['a?c', ['a?c']],
    ['**/x', ['**', 'x']],
  ])('accepts %s', (source, segments) => {
    expect(parseGlob(source)).toEqual({ source, segments });
  });

  it.each([
    ['', 'empty'],
    ['/abs', 'start with'],
    ['../x', "'..'"],
    ['./x', "'.'"],
    ['src//a', 'empty segment'],
    ['src/', 'empty segment'],
    ['a**', "'**'"],
    ['**.ts', "'**'"],
    ['src/{a,b}', "'{'"],
    ['src/[ab]', "'['"],
    ['!src/a', "'!'"],
    ['a\\b', 'backslash'],
  ])('rejects %j', (source, reason) => {
    const res = parseGlob(source);
    expect('issue' in res ? res.issue : '').toContain(reason);
  });

  it('rejects 257 characters naming the limit and accepts 256', () => {
    const res = parseGlob('a'.repeat(257));
    expect('issue' in res ? res.issue : '').toContain('256');
    expect('issue' in parseGlob('a'.repeat(256))).toBe(false);
  });
});

function glob(source: string): Glob {
  const parsed = parseGlob(source);
  if ('issue' in parsed) throw new Error(parsed.issue);
  return parsed;
}

describe('matchGlob', () => {
  it.each([
    ['*.md', 'README.md', true],
    ['*.md', 'docs/README.md', false],
    ['src/*.ts', 'src/a.ts', true],
    ['src/*.ts', 'src/deep/b.ts', false],
    ['a?c', 'abc', true],
    ['a?c', 'ac', false],
    ['a?c', 'abbc', false],
    ['src/**/*.ts', 'src/a.ts', true],
    ['src/**/*.ts', 'src/deep/b.ts', true],
    ['src/**/*.ts', 'src/a/b/c.ts', true],
    ['src/**/*.ts', 'lib/a.ts', false],
    ['**/x', 'x', true],
    ['**/x', 'a/b/x', true],
    ['**/x', 'a/b/y', false],
    ['src/**', 'src/a', true],
    ['src/**', 'src/a/b', true],
    ['src/**', 'src', true],
    ['**', 'any/path/here', true],
    ['a/**/b/**/c', 'a/b/c', true],
    ['a/**/b/**/c', 'a/x/b/y/z/c', true],
    ['a/**/b/**/c', 'a/x/c', false],
    ['.*', '.gitignore', true],
    ['**/*.md', '.github/README.md', true],
    ['src/a.b', 'src/a.b', true],
    ['src/a.b', 'src/aXb', false],
    ['a*b*c', 'aXXbYYc', true],
    ['a*b*c', 'aXXbYY', false],
    ['*', '', true],
    ['*', 'a/b', false],
  ])('%s vs %s -> %s', (source, path, expected) => {
    expect(matchGlob(glob(source), path)).toBe(expected);
  });

  it('completes on adversarial long inputs without blow-up', () => {
    const pattern = glob(`${'a*'.repeat(50)}b`);
    const path = 'a'.repeat(5000);
    expect(matchGlob(pattern, path)).toBe(false);
    const deep = glob(`${'**/a/'.repeat(20)}z`);
    expect(matchGlob(deep, `${'a/'.repeat(400)}y`)).toBe(false);
    expect(matchGlob(deep, `${'a/'.repeat(400)}z`)).toBe(true);
  });
});

describe('matchesAny', () => {
  it('is true when any glob matches and false otherwise', () => {
    const globs = [glob('*.md'), glob('src/**/*.ts')];
    expect(matchesAny(globs, 'src/a/b.ts')).toBe(true);
    expect(matchesAny(globs, 'README.md')).toBe(true);
    expect(matchesAny(globs, 'lib/a.js')).toBe(false);
    expect(matchesAny([], 'README.md')).toBe(false);
  });
});
