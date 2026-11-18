import { describe, expect, it } from 'vitest';
import { parseGlob } from '@/domain/checks/glob.js';

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
