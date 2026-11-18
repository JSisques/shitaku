import { describe, expect, it } from 'vitest';
import type { RuleCheck } from '@/domain/catalog/rule-check.js';
import {
  evaluateRuleCheck,
  finalizeEvaluation,
  MAX_FINDINGS,
  MAX_LINE_LENGTH,
  type CheckEvaluation,
  type SnapshotFile,
} from '@/domain/checks/evaluate.js';

type CheckOf<T extends RuleCheck['type']> = Extract<RuleCheck, { type: T }>;

function run(check: RuleCheck, files: readonly SnapshotFile[], severity: 'error' | 'warn' = 'error'): CheckEvaluation {
  return evaluateRuleCheck({ name: 'r', check, severity }, { files });
}

const lines = (...rows: string[]): string => rows.join('\n');

describe('constants', () => {
  it('pins the spec limits', () => {
    expect(MAX_FINDINGS).toBe(200);
    expect(MAX_LINE_LENGTH).toBe(10_000);
  });
});

describe('finalizeEvaluation', () => {
  const rule = { name: 'r', severity: 'error' as const };

  it('returns an empty evaluated result when there is no violation', () => {
    expect(finalizeEvaluation(rule, [], [])).toEqual({
      status: 'evaluated',
      findings: [],
      skipped: [],
      truncated: false,
    });
  });

  it('attaches the rule name and effective severity to every finding', () => {
    const drafts = [{ path: 'a', message: 'm' }];
    expect(finalizeEvaluation(rule, drafts, []).findings).toEqual([
      { rule: 'r', severity: 'error', path: 'a', message: 'm' },
    ]);
    expect(finalizeEvaluation({ name: 'w', severity: 'warn' }, drafts, []).findings).toEqual([
      { rule: 'w', severity: 'warn', path: 'a', message: 'm' },
    ]);
  });

  it('sorts findings by path then line and is deterministic', () => {
    const drafts = [
      { path: 'b.ts', line: 1, message: 'm' },
      { path: 'a.ts', line: 10, message: 'm' },
      { path: 'a.ts', line: 2, message: 'm' },
      { path: 'a.ts', message: 'm' },
    ];
    const first = finalizeEvaluation(rule, drafts, []);
    expect(first.findings.map((f) => `${f.path}:${f.line ?? '-'}`)).toEqual(['a.ts:-', 'a.ts:2', 'a.ts:10', 'b.ts:1']);
    expect(finalizeEvaluation(rule, [...drafts].reverse(), [])).toEqual(first);
  });

  it('caps at 200 findings in order and flags truncation', () => {
    const drafts = Array.from({ length: 201 }, (_, i) => ({ path: `f${String(i).padStart(3, '0')}`, message: 'm' }));
    const result = finalizeEvaluation(rule, drafts, []);
    expect(result.findings).toHaveLength(200);
    expect(result.findings[199]?.path).toBe('f199');
    expect(result.truncated).toBe(true);
    expect(finalizeEvaluation(rule, drafts.slice(0, 200), []).truncated).toBe(false);
  });

  it('passes skipped entries through sorted', () => {
    expect(finalizeEvaluation(rule, [], ['b', 'a:2', 'a']).skipped).toEqual(['a', 'a:2', 'b']);
  });
});

describe('evaluateRuleCheck tool', () => {
  it('defers a tool check without findings and ignores the snapshot', () => {
    const rule = { name: 'commits', severity: 'warn' as const, check: { type: 'tool' as const, tool: 'commitlint' } };
    const expected = { status: 'deferred', findings: [], skipped: [], truncated: false };
    expect(evaluateRuleCheck(rule, { files: [{ path: 'a.ts', text: 'x' }] })).toEqual(expected);
    expect(evaluateRuleCheck(rule, { files: [] })).toEqual(expected);
  });
});

describe('evaluateRuleCheck file-exists', () => {
  const check: CheckOf<'file-exists'> = { type: 'file-exists', path: 'README.md' };

  it('returns no finding when the file is present', () => {
    expect(run(check, [{ path: 'README.md' }, { path: 'a.ts' }]).findings).toEqual([]);
  });

  it('returns one finding with the glob source when missing', () => {
    expect(run(check, [{ path: 'a.ts' }]).findings).toEqual([
      { rule: 'r', severity: 'error', path: 'README.md', message: "no file matches 'README.md'" },
    ]);
  });

  it('accepts a glob path without each', () => {
    expect(run({ type: 'file-exists', path: 'docs/**/*.md' }, [{ path: 'docs/a/b.md' }]).findings).toEqual([]);
  });

  it('requires the file in each matching directory', () => {
    const result = run({ type: 'file-exists', path: 'README.md', each: 'src/*' }, [
      { path: 'src/a/README.md' },
      { path: 'src/b/index.ts' },
    ]);
    expect(result.findings).toEqual([
      { rule: 'r', severity: 'error', path: 'src/b/README.md', message: "no file matches 'README.md' in src/b" },
    ]);
  });

  it('matches a glob path relative to each directory and reports the glob source', () => {
    const files = [{ path: 'src/a/x.md' }, { path: 'src/b/deep/index.ts' }, { path: 'src/c/index.ts' }];
    const star = run({ type: 'file-exists', path: '*.md', each: 'src/*' }, files);
    expect(star.findings.map((f) => f.path)).toEqual(['src/b/*.md', 'src/c/*.md']);
    const deep = run({ type: 'file-exists', path: '**/index.ts', each: 'src/*' }, files);
    expect(deep.findings.map((f) => f.path)).toEqual(['src/a/**/index.ts']);
  });

  it('treats a directory name with wildcard characters literally when stripping the prefix', () => {
    const result = run({ type: 'file-exists', path: 'README.md', each: 'pkg/*' }, [
      { path: 'pkg/a?b/README.md' },
      { path: 'pkg/axb/index.ts' },
    ]);
    expect(result.findings.map((f) => f.path)).toEqual(['pkg/axb/README.md']);
  });

  it('derives directories only from proper path prefixes', () => {
    expect(run({ type: 'file-exists', path: 'README.md', each: 'src/*' }, [{ path: 'src/index.ts' }]).findings).toEqual(
      [],
    );
  });
});

describe('evaluateRuleCheck contains-sections', () => {
  const check: CheckOf<'contains-sections'> = {
    type: 'contains-sections',
    files: ['**/README.md'],
    sections: ['Install', 'Usage'],
  };

  it('returns no finding when every section is present', () => {
    expect(run(check, [{ path: 'README.md', text: '# T\n## Install\n## Usage\n' }]).findings).toEqual([]);
  });

  it('names the missing section on the file path', () => {
    const result = run(check, [{ path: 'README.md', text: '## Install\n' }]);
    expect(result.findings).toEqual([
      { rule: 'r', severity: 'error', path: 'README.md', message: "missing section 'Usage'" },
    ]);
  });

  it('accepts heading levels 1 to 6, trims text and rejects 7 hashes or no space', () => {
    const ok = lines('# Install', '###### Usage  ');
    expect(run(check, [{ path: 'README.md', text: ok }]).findings).toEqual([]);
    const bad = lines('####### Install', '#Usage', 'Install', '## Installation', '## Usage');
    expect(run(check, [{ path: 'README.md', text: bad }]).findings.map((f) => f.message)).toEqual([
      "missing section 'Install'",
    ]);
  });

  it('skips excluded files and unloaded files', () => {
    const scoped: CheckOf<'contains-sections'> = { ...check, exclude: ['docs/**'] };
    const result = run(scoped, [{ path: 'docs/README.md', text: '' }, { path: 'x/README.md' }]);
    expect(result.findings).toEqual([]);
    expect(result.skipped).toEqual(['x/README.md']);
  });

  it('reports each missing section per file', () => {
    const result = run(check, [
      { path: 'a/README.md', text: '' },
      { path: 'b/README.md', text: '# Usage' },
    ]);
    expect(result.findings.map((f) => `${f.path} ${f.message}`)).toEqual([
      "a/README.md missing section 'Install'",
      "a/README.md missing section 'Usage'",
      "b/README.md missing section 'Install'",
    ]);
  });
});

describe('evaluateRuleCheck pattern-absent', () => {
  const check: CheckOf<'pattern-absent'> = {
    type: 'pattern-absent',
    files: ['src/**/*.ts'],
    exclude: ['**/*.d.ts'],
    pattern: ':\\s*any\\b',
  };

  it('reports the 1-based line of a match with the default message', () => {
    const text = lines('const a = 1;', '', 'const x: any = 1;');
    const result = run(check, [{ path: 'src/a.ts', text }]);
    expect(result.findings).toEqual([
      {
        rule: 'r',
        severity: 'error',
        path: 'src/a.ts',
        line: 3,
        message: "line matches forbidden pattern ':\\s*any\\b'",
      },
    ]);
  });

  it('orders multiple matches across files by path then line', () => {
    const result = run(check, [
      { path: 'src/b.ts', text: 'x: any' },
      { path: 'src/a.ts', text: lines('x: any', 'ok', 'y: any') },
    ]);
    expect(result.findings.map((f) => `${f.path}:${f.line}`)).toEqual(['src/a.ts:1', 'src/a.ts:3', 'src/b.ts:1']);
  });

  it('ignores files out of scope or excluded', () => {
    const result = run(check, [
      { path: 'test/a.ts', text: 'x: any' },
      { path: 'src/a.d.ts', text: 'x: any' },
    ]);
    expect(result.findings).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('honors ignore-case only when true', () => {
    const base: CheckOf<'pattern-absent'> = { type: 'pattern-absent', files: ['**'], pattern: 'todo' };
    const files = [{ path: 'a.ts', text: '// TODO fix' }];
    expect(run({ ...base, 'ignore-case': true }, files).findings).toHaveLength(1);
    expect(run({ ...base, 'ignore-case': false }, files).findings).toEqual([]);
    expect(run(base, files).findings).toEqual([]);
  });

  it('uses the custom message and the rule severity', () => {
    const result = run({ ...check, message: 'Use unknown' }, [{ path: 'src/a.ts', text: 'x: any' }], 'warn');
    expect(result.findings.map((f) => [f.severity, f.message])).toEqual([['warn', 'Use unknown']]);
  });

  it('skips over-long lines as path:line without testing them', () => {
    const long = `x: any ${'a'.repeat(MAX_LINE_LENGTH)}`;
    const result = run(check, [{ path: 'src/a.ts', text: lines('ok', long, 'y: any') }]);
    expect(result.skipped).toEqual(['src/a.ts:2']);
    expect(result.findings.map((f) => f.line)).toEqual([3]);
    const atLimit = run(check, [{ path: 'src/a.ts', text: `x: any${' '.repeat(MAX_LINE_LENGTH - 6)}` }]);
    expect(atLimit.skipped).toEqual([]);
    expect(atLimit.findings).toHaveLength(1);
  });

  it('lists unloaded in-scope files as skipped without findings', () => {
    const result = run(check, [{ path: 'src/a.ts' }, { path: 'test/a.ts' }]);
    expect(result.skipped).toEqual(['src/a.ts']);
    expect(result.findings).toEqual([]);
  });

  it('is not affected by regex state between lines (no sticky lastIndex)', () => {
    const result = run(check, [{ path: 'src/a.ts', text: lines('x: any', 'y: any', 'z: any') }]);
    expect(result.findings.map((f) => f.line)).toEqual([1, 2, 3]);
  });

  it('truncates at 200 findings', () => {
    const text = lines(...Array.from({ length: 201 }, () => 'x: any'));
    const result = run(check, [{ path: 'src/a.ts', text }]);
    expect(result.findings).toHaveLength(200);
    expect(result.truncated).toBe(true);
  });
});

describe('evaluateRuleCheck max-lines', () => {
  const check: CheckOf<'max-lines'> = { type: 'max-lines', files: ['src/**/*.ts'], exclude: ['src/gen/**'], max: 300 };
  const rows = (n: number): string => `${Array.from({ length: n }, () => 'x').join('\n')}\n`;

  it('flags a file over the limit and not one at the limit', () => {
    const result = run(check, [
      { path: 'src/big.ts', text: rows(301) },
      { path: 'src/ok.ts', text: rows(300) },
    ]);
    expect(result.findings).toEqual([
      { rule: 'r', severity: 'error', path: 'src/big.ts', message: 'file has 301 lines (max 300)' },
    ]);
  });

  it.each([
    ['a\n', 1],
    ['', 0],
    ['a\r\nb\r\n', 2],
    ['a\nb', 2],
    ['\n', 1],
  ])('counts %j as %i lines', (text, count) => {
    const tight: CheckOf<'max-lines'> = { type: 'max-lines', files: ['f'], max: 1 };
    const flagged = run(tight, [{ path: 'f', text }]).findings.length === 1;
    expect(flagged).toBe(count > 1);
    const exact: CheckOf<'max-lines'> = { type: 'max-lines', files: ['f'], max: Math.max(count, 1) };
    expect(run(exact, [{ path: 'f', text }]).findings).toEqual([]);
    if (count > 1) {
      expect(run({ ...exact, max: count - 1 }, [{ path: 'f', text }]).findings[0]?.message).toBe(
        `file has ${count} lines (max ${count - 1})`,
      );
    }
  });

  it('ignores excluded files and skips unloaded ones', () => {
    const result = run(check, [{ path: 'src/gen/a.ts', text: rows(999) }, { path: 'src/b.ts' }]);
    expect(result.findings).toEqual([]);
    expect(result.skipped).toEqual(['src/b.ts']);
  });
});
