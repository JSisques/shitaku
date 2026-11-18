import { describe, expect, it } from 'vitest';
import { RuleCheckSchema, SeveritySchema, formatCheckIssue } from '@/domain/catalog/rule-check.js';

const parse = (input: unknown): { ok: true; value: unknown } | { ok: false; issue: string } => {
  const res = RuleCheckSchema.safeParse(input);
  return res.success ? { ok: true, value: res.data } : { ok: false, issue: formatCheckIssue(res.error) };
};
const issueOf = (input: unknown): string => {
  const res = parse(input);
  return res.ok ? '' : res.issue;
};
const base = { type: 'pattern-absent', files: 'src/**/*.ts', pattern: 'todo' };
const lines = { type: 'max-lines', files: ['src/**/*.ts'], max: '300' };

describe('RuleCheckSchema types', () => {
  it.each([
    [
      { type: 'file-exists', path: 'README.md' },
      { type: 'file-exists', path: 'README.md' },
    ],
    [
      { type: 'file-exists', path: 'README.md', each: 'src/*' },
      { type: 'file-exists', path: 'README.md', each: 'src/*' },
    ],
    [
      { type: 'contains-sections', files: 'README.md', exclude: 'docs/*.md', sections: 'Usage' },
      { type: 'contains-sections', files: ['README.md'], exclude: ['docs/*.md'], sections: ['Usage'] },
    ],
    [
      { ...base, 'ignore-case': 'true', message: '  Use unknown  ' },
      { type: 'pattern-absent', files: ['src/**/*.ts'], pattern: 'todo', 'ignore-case': true, message: 'Use unknown' },
    ],
    [lines, { type: 'max-lines', files: ['src/**/*.ts'], max: 300 }],
    [
      { type: 'tool', tool: 'commitlint', args: '--edit' },
      { type: 'tool', tool: 'commitlint', args: ['--edit'] },
    ],
    [
      { type: 'tool', tool: 'commitlint', args: [] },
      { type: 'tool', tool: 'commitlint', args: [] },
    ],
  ])('accepts and normalizes %j', (input, expected) => {
    expect(parse(input)).toEqual({ ok: true, value: expected });
  });

  it('parses ignore-case false', () => {
    expect(parse({ ...base, 'ignore-case': 'false' })).toMatchObject({ ok: true, value: { 'ignore-case': false } });
  });

  it.each([
    [{ ...base, extra: '1' }, 'extra'],
    [{ type: 'run-script' }, 'type:'],
    [{ type: 'forbid-pattern', files: 'a', pattern: 'x' }, 'type:'],
    [{ type: 'max-bytes', files: 'a', max: '1' }, 'type:'],
    [{ type: 'require-file', path: 'a' }, 'type:'],
    [{ type: 'max-size', files: 'a', max: '1' }, 'type:'],
    [{ files: 'a' }, 'type:'],
    [{ type: 'pattern-absent', files: 'a' }, 'pattern:'],
    [{ type: 'max-lines', files: 'a' }, 'max:'],
    [{ ...lines, max: 'many' }, 'max:'],
    [{ ...lines, max: '0' }, 'max:'],
    [{ ...lines, max: '-3' }, 'max:'],
    [{ ...lines, max: '007' }, 'max:'],
    [{ ...lines, max: '12345678' }, 'max:'],
    [{ ...base, 'ignore-case': 'maybe' }, 'ignore-case:'],
    [{ ...base, message: '   ' }, 'message:'],
    [{ ...base, message: 'x'.repeat(201) }, 'message:'],
    [{ type: 'tool', tool: 'bin/tool' }, 'tool:'],
    [{ type: 'tool', tool: 'a b' }, 'tool:'],
    [{ type: 'tool', tool: 'x', args: Array.from({ length: 33 }, () => 'a') }, 'args:'],
    [{ ...base, files: [] }, 'files:'],
    [{ ...base, files: Array.from({ length: 33 }, () => 'a') }, 'files:'],
    [{ type: 'contains-sections', files: 'a', sections: 'x'.repeat(121) }, 'sections.0:'],
    [{ type: 'contains-sections', files: 'a', sections: [] }, 'sections:'],
  ])('rejects %j naming %s', (input, field) => {
    expect(issueOf(input)).toContain(`invalid check: ${field.replace(/:$/, '')}`);
  });

  it('accepts 32 list entries', () => {
    expect(parse({ ...base, files: Array.from({ length: 32 }, () => 'a') }).ok).toBe(true);
  });

  it.each([
    [{ ...base, files: '../x' }, 'invalid check: files.0:', '..'],
    [{ ...base, exclude: ['ok', 'src/{a,b}'] }, 'invalid check: exclude.1:', '{'],
    [{ type: 'file-exists', path: 'a'.repeat(257) }, 'invalid check: path:', '256'],
  ])('runs glob syntax validation on %j', (input, prefix, detail) => {
    expect(issueOf(input)).toContain(prefix);
    expect(issueOf(input)).toContain(detail);
  });

  it.each([
    ['without each', { type: 'file-exists', path: '/abs' }, 'invalid check: path:'],
    [
      'with each (path is a glob relative to each match)',
      { type: 'file-exists', path: 'a/../b', each: 'src/*' },
      'invalid check: path:',
    ],
    ['each itself', { type: 'file-exists', path: 'README.md', each: 'src//x' }, 'invalid check: each:'],
  ])('file-exists validates path and each as globs %s', (_label, input, prefix) => {
    expect(issueOf(input)).toContain(prefix);
  });

  it('accepts glob wildcards in file-exists path with and without each', () => {
    expect(parse({ type: 'file-exists', path: 'docs/**/*.md' }).ok).toBe(true);
    expect(parse({ type: 'file-exists', path: '*.md', each: 'src/*' }).ok).toBe(true);
    expect(parse({ type: 'file-exists', path: '**/index.ts', each: 'src/*' }).ok).toBe(true);
  });

  it.each([
    ['(a+)+', 'nested quantifier'],
    ['(unclosed', 'not a valid regular expression'],
    ['', '1 to 200'],
  ])('runs regex validation on pattern %j', (pattern, reason) => {
    expect(issueOf({ ...base, pattern })).toContain(`invalid check: pattern: pattern`);
    expect(issueOf({ ...base, pattern })).toContain(reason);
  });
});

describe('SeveritySchema', () => {
  it.each(['error', 'warn'])('accepts %s', (value) => {
    expect(SeveritySchema.parse(value)).toBe(value);
  });
  it.each(['fatal', 'Error', ''])('rejects %j', (value) => {
    expect(SeveritySchema.safeParse(value).success).toBe(false);
  });
});
