import { describe, expect, it } from 'vitest';
import { evaluateRuleCheck, finalizeEvaluation, MAX_FINDINGS, MAX_LINE_LENGTH } from '@/domain/checks/evaluate.js';

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
