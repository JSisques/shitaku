import type { RuleCheck, Severity } from '@/domain/catalog/rule-check.js';
import { matchGlob, matchesAny, parseGlob, type Glob } from '@/domain/checks/glob.js';
import { compilePattern } from '@/domain/checks/safe-regex.js';

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

type Rule = { name: string; check: RuleCheck; severity: Severity };
type Check<T extends RuleCheck['type']> = Extract<RuleCheck, { type: T }>;
type Outcome = { drafts: FindingDraft[]; skipped: string[] };

function compileGlobs(sources: readonly string[]): Glob[] {
  return sources.flatMap((source) => {
    const parsed = parseGlob(source);
    return 'issue' in parsed ? [] : [parsed];
  });
}

/** Files matching `files` and not `exclude`, in snapshot order. Shared by every content-based check. */
function filesInScope(
  snapshot: ProjectSnapshot,
  check: { files: readonly string[]; exclude?: readonly string[] | undefined },
): SnapshotFile[] {
  const include = compileGlobs(check.files);
  const exclude = compileGlobs(check.exclude ?? []);
  return snapshot.files.filter((file) => matchesAny(include, file.path) && !matchesAny(exclude, file.path));
}

/** Runs `inspect` on every in-scope file that has text; files without text go to `skipped`. */
function inspectFiles(
  snapshot: ProjectSnapshot,
  check: { files: readonly string[]; exclude?: readonly string[] | undefined },
  inspect: (file: SnapshotFile, text: string, outcome: Outcome) => void,
): Outcome {
  const outcome: Outcome = { drafts: [], skipped: [] };
  for (const file of filesInScope(snapshot, check)) {
    if (file.text === undefined) outcome.skipped.push(file.path);
    else inspect(file, file.text, outcome);
  }
  return outcome;
}

function parseOrThrow(source: string): Glob {
  const parsed = parseGlob(source);
  if ('issue' in parsed) throw new Error(`invalid glob '${source}': ${parsed.issue}`);
  return parsed;
}

/** Every proper directory prefix of every file path, deduplicated. */
function directoriesOf(snapshot: ProjectSnapshot): string[] {
  const dirs = new Set<string>();
  for (const { path } of snapshot.files) {
    const parts = path.split('/');
    for (let end = 1; end < parts.length; end++) dirs.add(parts.slice(0, end).join('/'));
  }
  return [...dirs];
}

function evaluateFileExists(check: Check<'file-exists'>, snapshot: ProjectSnapshot): Outcome {
  const target = parseOrThrow(check.path);
  const missing = (expected: string, where: string): FindingDraft => ({
    path: expected,
    message: `no file matches '${check.path}'${where}`,
  });
  if (check.each === undefined) {
    const found = snapshot.files.some((file) => matchGlob(target, file.path));
    return { drafts: found ? [] : [missing(check.path, '')], skipped: [] };
  }
  const each = parseOrThrow(check.each);
  const drafts = directoriesOf(snapshot)
    .filter((dir) => matchGlob(each, dir))
    .filter((dir) => {
      const prefix = `${dir}/`;
      return !snapshot.files.some(
        (file) => file.path.startsWith(prefix) && matchGlob(target, file.path.slice(prefix.length)),
      );
    })
    .map((dir) => missing(`${dir}/${check.path}`, ` in ${dir}`));
  return { drafts, skipped: [] };
}

const HEADING = /^ {0,3}#{1,6}[ \t]+(.*)$/;

function headingTexts(text: string): Set<string> {
  const texts = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = HEADING.exec(line);
    if (match?.[1] !== undefined) texts.add(match[1].trim());
  }
  return texts;
}

function evaluateSections(check: Check<'contains-sections'>, snapshot: ProjectSnapshot): Outcome {
  return inspectFiles(snapshot, check, (file, text, outcome) => {
    const present = headingTexts(text);
    for (const section of check.sections) {
      if (!present.has(section)) outcome.drafts.push({ path: file.path, message: `missing section '${section}'` });
    }
  });
}

function evaluatePatternAbsent(check: Check<'pattern-absent'>, snapshot: ProjectSnapshot): Outcome {
  const regex = compilePattern(check.pattern, check['ignore-case'] === true);
  const message = check.message ?? `line matches forbidden pattern '${check.pattern}'`;
  return inspectFiles(snapshot, check, (file, text, outcome) => {
    text.split(/\r?\n/).forEach((line, index) => {
      if (line.length > MAX_LINE_LENGTH) outcome.skipped.push(`${file.path}:${index + 1}`);
      else if (regex.test(line)) outcome.drafts.push({ path: file.path, line: index + 1, message });
    });
  });
}

/** `\n`-separated lines ignoring one trailing newline: `'a\n'` is 1, `''` is 0. */
export function countLines(text: string): number {
  if (text === '') return 0;
  const breaks = text.split('\n').length - 1;
  return text.endsWith('\n') ? breaks : breaks + 1;
}

function evaluateMaxLines(check: Check<'max-lines'>, snapshot: ProjectSnapshot): Outcome {
  return inspectFiles(snapshot, check, (file, text, outcome) => {
    const count = countLines(text);
    if (count > check.max)
      outcome.drafts.push({ path: file.path, message: `file has ${count} lines (max ${check.max})` });
  });
}

function evaluateCheck(check: RuleCheck, snapshot: ProjectSnapshot): Outcome {
  switch (check.type) {
    case 'file-exists':
      return evaluateFileExists(check, snapshot);
    case 'contains-sections':
      return evaluateSections(check, snapshot);
    case 'pattern-absent':
      return evaluatePatternAbsent(check, snapshot);
    case 'max-lines':
      return evaluateMaxLines(check, snapshot);
    case 'tool':
      return { drafts: [], skipped: [] };
  }
}

/** Pure: no I/O, environment or clock. `tool` checks are data only and evaluate to `deferred`. */
export function evaluateRuleCheck(rule: Rule, snapshot: ProjectSnapshot): CheckEvaluation {
  if (rule.check.type === 'tool') return { status: 'deferred', findings: [], skipped: [], truncated: false };
  const { drafts, skipped } = evaluateCheck(rule.check, snapshot);
  return finalizeEvaluation(rule, drafts, skipped);
}
