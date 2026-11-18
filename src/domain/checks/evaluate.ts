import type { RuleCheck, Severity } from '@/domain/catalog/rule-check.js';

/** One project file. `path` is POSIX and relative; `text` is undefined when the caller did not or could not load it. */
export interface SnapshotFile {
  readonly path: string;
  readonly text?: string;
}

/** In-memory view of a project, built by a future adapter (#226). Directories are derived from file paths. */
export interface ProjectSnapshot {
  readonly files: readonly SnapshotFile[];
}

export interface RuleFinding {
  rule: string;
  severity: Severity;
  /** File path; for file-exists, the expected path or glob. */
  path: string;
  /** 1-based, pattern-absent only. */
  line?: number;
  message: string;
}

export interface CheckEvaluation {
  /** `deferred` for type `tool`. */
  status: 'evaluated' | 'deferred';
  findings: RuleFinding[];
  /** Files without text, or `path:line` for over-long lines. */
  skipped: string[];
  truncated: boolean;
}

export const MAX_FINDINGS = 200;
export const MAX_LINE_LENGTH = 10_000;

/** A violation before the rule name and severity are attached. */
export interface FindingDraft {
  path: string;
  line?: number;
  message: string;
}

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Attaches rule and severity, sorts by path then line, and caps the result. Shared by every evaluator. */
export function finalizeEvaluation(
  rule: { name: string; severity: Severity },
  drafts: readonly FindingDraft[],
  skipped: readonly string[],
): CheckEvaluation {
  const sorted = [...drafts].sort((a, b) => byCodeUnit(a.path, b.path) || (a.line ?? 0) - (b.line ?? 0));
  const findings = sorted.slice(0, MAX_FINDINGS).map((draft): RuleFinding => ({
    rule: rule.name,
    severity: rule.severity,
    path: draft.path,
    ...(draft.line === undefined ? {} : { line: draft.line }),
    message: draft.message,
  }));
  return {
    status: 'evaluated',
    findings,
    skipped: [...skipped].sort(byCodeUnit),
    truncated: sorted.length > MAX_FINDINGS,
  };
}

export function evaluateRuleCheck(
  rule: { name: string; check: RuleCheck; severity: Severity },
  snapshot: ProjectSnapshot,
): CheckEvaluation {
  void snapshot; // consumed by the per-type evaluators
  if (rule.check.type === 'tool') return { status: 'deferred', findings: [], skipped: [], truncated: false };
  throw new Error(`check type '${rule.check.type}' is not implemented yet`);
}
