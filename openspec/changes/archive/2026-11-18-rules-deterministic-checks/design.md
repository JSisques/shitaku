# Design: Deterministic checks and severity for rules (issue #288)

## Technical Approach

Pure-domain change, no ports, no adapters, no application use case. Three pieces, each a chained PR slice (stacked-to-main):

1. **Frontmatter mapping subset** (`src/domain/catalog/frontmatter.ts`, new): a bounded, hand-rolled reader for one nested mapping level under an opted-in key. `readFrontmatter` gains an opt-in `mappings` option; only `parseRule` asks for `['check']`. Every other key (including `paths:`) keeps today's opaque behavior.
2. **Check contract** (`src/domain/catalog/rule-check.ts`, new): zod schemas for `severity` and a discriminated union of check types, glob syntax validation and regex safety validation. `parseRule` drops `RESERVED_RULE_KEYS`, validates `check` and `severity`, and attaches the parsed check and effective severity to `RuleItem`.
3. **Evaluators** (`src/domain/checks/`, new): a pure glob matcher, an in-memory `ProjectSnapshot` type and `evaluateRuleCheck`, returning plain-data findings with severity. Nothing calls it in production until the gate runner (#226).

Rule bytes stay verbatim: `check` and `severity` YAML reach `.claude/rules/` unchanged and Claude Code ignores unknown keys. The catalog data slice is deferred until #226 (user decision), so no seed rule changes and no hash churn.

## Affected Hexagonal Layers

| Layer       | Files                                                                                                                                                           | Impact       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Domain      | `src/domain/catalog/frontmatter.ts`, `src/domain/catalog/rule.ts`                                                                                               | Modified     |
| Domain      | `src/domain/catalog/rule-check.ts`, `src/domain/checks/{glob,safe-regex,evaluate}.ts`                                                                           | New          |
| Ports       | None                                                                                                                                                            | None         |
| Application | None                                                                                                                                                            | None         |
| Adapters    | None (`folder-source.ts` passes the parsed `RuleItem` through unchanged; verified, no wiring needed)                                                            | None         |
| Docs/tests  | `README.md`, `CONTRIBUTING.md`, `website/src/content/docs/{en,es}/security.md`, `test/rules-docs.test.ts`, `test/domain/catalog/rule.test.ts`, new domain tests | Modified/New |

The domain stays free of `fs`, `os`, `path`, `child_process` and `process` (enforced by `test/architecture.test.ts`); no new dependency is added.

## Architecture Decisions

### Decision 1: Hand-rolled bounded YAML subset for `check`, not a YAML dependency and not a flat-key format

**Choice**: A pure reader, `readBlockMapping`, inlined in `frontmatter.ts` (see Portability constraint), that parses exactly one nested mapping level whose values are scalars or block sequences of scalars. It is a strict subset of YAML 1.2: anything it accepts parses to the same value in a real YAML parser; anything outside the subset is rejected with an issue rather than guessed.

**Portability constraint**: the reader lives inside `frontmatter.ts`, not in its own module, and `frontmatter.ts` must stay import-free. `scripts/lib/frontmatter-description.mjs` (used by the docs generators) loads `frontmatter.ts` under plain Node with type stripping, which cannot resolve `@/` aliases or `.js` -> `.ts` specifiers. `test/domain/catalog/frontmatter-portability.test.ts` guards this; an `import` here breaks the generators with `ERR_MODULE_NOT_FOUND`.

**Alternatives considered**:

- `yaml` (eemeli) dependency: pure JS, so the domain could import it. Rejected: it would be a second YAML authority beside the hand-rolled reader (both must agree on `name`/`description`), it adds a runtime dependency to an `npx`-installed CLI whose only runtime dependency is `zod`, and it accepts far more syntax (anchors, tags, flow mappings, multi-line plain scalars) than a check needs.
- Restricted flat keys (`check-type:`, `check-files:`): smallest parser, but not idiomatic, diverges from the issue's nested examples, and turns lists into ad hoc delimiters.
- Single-line flow mapping (`check: {type: ..., files: [...]}`): requires a flow parser with comma/quote rules that are harder to keep YAML-exact than block style.

**Rationale**: The subset is small (one level, two value shapes), testable table-driven, keeps the reader the single YAML authority, and preserves the zero-new-dependency stance. Strict-subset semantics matter because the bytes also reach Claude Code: a check our reader accepts must never make the file invalid YAML for Claude Code.

**Accepted subset** (inside the block under an opted-in key):

| Construct                                                                                                             | Accepted | Notes                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key: value` at the block's indent                                                                                    | Yes      | Block indent = indent of the first non-blank line, must be > 0, spaces only. Keys match `^[a-z][a-z0-9-]*$`.                                                                                                                    |
| Plain scalar                                                                                                          | Yes      | Rejected if it starts with a YAML indicator (`* & ! { [ ] } \| > % @ `` ` `` , ? - #`or an unmatched quote), or contains`: `or` #`before the end (a trailing` # comment` is stripped, as YAML does). The issue says "quote it". |
| Single-quoted scalar                                                                                                  | Yes      | `''` decodes to `'`; no other escapes (YAML semantics). Recommended for regex. Optional trailing ` # comment`.                                                                                                                  |
| Double-quoted scalar                                                                                                  | Yes      | Escapes `\\ \" \/ \n \t` only; any other escape (for example `\s`) is an issue telling the author to use single quotes.                                                                                                         |
| Block sequence (`- item`) under a key with empty value                                                                | Yes      | Items at indent >= the key's indent, all at the same indent; each item is a scalar as above.                                                                                                                                    |
| Flow sequence `[a, b]`, flow mapping, anchors, aliases, tags, block scalars, multi-line plain scalars, deeper nesting | No       | Issue naming the key and line.                                                                                                                                                                                                  |
| Duplicate key                                                                                                         | No       | Issue.                                                                                                                                                                                                                          |
| Tab indentation                                                                                                       | No       | Issue.                                                                                                                                                                                                                          |
| Full-line comment, blank line                                                                                         | Skipped  |                                                                                                                                                                                                                                 |

**Integration with `readFrontmatter`**: new overload `readFrontmatter(text, file, { allowNested: true, mappings: readonly string[] })` returning `{ data, opaque, maps, body }`. A top-level key listed in `mappings` with an empty value has its indented block parsed into `maps[key]` instead of becoming opaque; with a non-empty inline value it stays in `data` (the rule layer then reports "check must be a nested mapping"). Without `mappings`, results are byte-for-byte the current shapes, so existing `toEqual` tests and `agent.ts`, `command.ts`, `skill.ts` are untouched.

### Decision 2: Hand-rolled segment glob matcher, no dependency, no regex conversion

**Choice**: `src/domain/checks/glob.ts` with `parseGlob(pattern)` (syntax validation, used by the schema) and `matchGlob(glob, path)` (used by evaluators). Supported syntax: `*` (zero or more characters except `/`), `?` (exactly one character except `/`), `**` as a whole segment (zero or more segments), everything else literal. Paths are POSIX, relative, no leading `./`.

Rejected at validation: empty pattern, leading `/`, `\`, `..` or `.` segments, empty segments (`//`, trailing `/`), `**` mixed into a segment (`a**`, `**.ts`), and the characters `{ } [ ] !` (braces, classes and negation are unsupported; use the `exclude` field instead). Length <= 256 characters.

Matching is segment-wise with memoized dynamic programming over `(pathSegment, globSegment)` and an iterative two-pointer wildcard match within a segment. Worst case is O(path length x pattern length); no backtracking blow-up is possible by construction. Dot-files and dot-directories are matched like any other name; excluding `node_modules`, `.git` or ignored files is the snapshot builder's job (#226).

**Alternatives considered**: `picomatch`/`micromatch` (pure JS, would satisfy the domain rule). Rejected: a runtime dependency for a few dozen lines of logic, a much larger syntax surface (braces, extglobs, platform options) whose semantics would become part of the #226 contract, and the micromatch/braces family has had ReDoS advisories. Converting globs to `RegExp` was also rejected, to keep matching linear and free of escaping bugs.

**Rationale**: The catalog needs only `*`, `**`, `?`. A narrow, documented syntax with exhaustive table tests is cheaper to own than a dependency and keeps the domain zero-dependency beyond `zod`.

### Decision 3: JavaScript `RegExp` with load-time guards for `pattern-absent`

**Choice**: `src/domain/checks/safe-regex.ts` exports `validatePattern(source): string | undefined` (returns an issue). A pattern is valid only if:

- length is 1 to 200 characters;
- it compiles with `new RegExp(source, 'u')` (always Unicode mode: stricter syntax, consistent escapes);
- it has no backreferences (`\1`-`\9`, `\k<`) and no lookbehind (`(?<=`, `(?<!`);
- it has no nested quantifier: a group whose body contains an unescaped quantifier (`*`, `+`, `?` after an atom, `{n,}`) and which is itself followed by a quantifier (`(a+)+`, `(a*)*`, `(\w+\s?)*`). The scan is a small tokenizer that tracks escapes, character classes and group depth.

The only flag authors control is `ignore-case: true` (adds `i`). Evaluation tests one line at a time, so per-test input is bounded by line length, and lines longer than 10,000 characters are reported in `skipped` (as `path:line`) instead of being tested.

**Alternatives considered**: `re2`/native (build step, not pure), `re2js` (pure JS linear-time engine, but a new runtime dependency and different syntax from what authors expect), no guards at all.

**Rationale (ReDoS stance)**: Catalog rules are reviewed data at the same trust level as hooks, which already execute commands, so regex guards are defense in depth against accidental catastrophic patterns, not a security boundary. The heuristic rejects the common exponential shapes; line-by-line testing and the length caps bound the rest. If #226 ever evaluates checks from untrusted sources, swapping the engine behind `validatePattern`/`compilePattern` is local to this module.

### Decision 4: Check types, one check per rule, kebab-case keys

**Choice**: `check` is a single mapping with a `type` discriminator; five types (shapes in Interfaces). Keys are kebab-case, consistent with Claude Code frontmatter (`allowed-tools`, `argument-hint`). Every schema is a `z.strictObject`, so a typo in a check key is an issue. `files` and `exclude` accept a scalar or a list and normalize to arrays.

| Type                | Meaning                                                                                                                                        | Seed rule it serves (deferred data slice)                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `file-exists`       | Without `each`: at least one file matches `path`. With `each`: every directory matching `each` contains a file matching `path` relative to it. | `module-readme` (`each: "src/*"`, `path: README.md`)                                            |
| `contains-sections` | Every file matching `files` (minus `exclude`) has a Markdown heading (`#` to `######`) whose trimmed text equals each listed section.          | README or ADR structure rules                                                                   |
| `pattern-absent`    | No line of a file matching `files` (minus `exclude`) matches `pattern`. One finding per matching line.                                         | `no-any`, `layer-boundaries`, `no-stray-todos`, `no-secrets`                                    |
| `max-lines`         | No file matching `files` (minus `exclude`) has more than `max` lines.                                                                          | `max-file-size`                                                                                 |
| `tool`              | Names an external tool and arguments as data only; never executed in the domain. Evaluation returns `status: 'deferred'`.                      | `conventional-commits` (commitlint), `env-documented`, `changelog-or-docs`, `tests-for-changes` |

Cross-file and changed-file rules (`env-documented`, `changelog-or-docs`, `tests-for-changes`) do not fit a single-snapshot declarative type; they are expressed as `tool` references (or stay instruction-only) until #226 defines execution and a changed-files input.

**Alternatives considered**: a list of checks per rule (`checks:`) — rejected for now: needs a sequence of mappings (two nesting levels) in the parser; a rule needing two checks can be split. Moving to a list later is additive under a new key. Also rejected: `max-bytes` (no seed rule needs it; YAGNI) and `pattern-present` (not requested).

**Rationale**: Covers every seed rule listed in the issue with the smallest set, keeps the parser at one nesting level, and gives #226 a stable discriminated union.

### Decision 5: Severity semantics

**Choice**: `severity` is `error` or `warn`. When `check` is present and `severity` absent, the effective severity is `error`. `severity` without `check` is an issue (`severity requires a check`). `severity` must be a single-line scalar. Findings carry the rule's effective severity; the domain never maps severity to exit codes.

**Rationale**: User decision for the default; rejecting a dangling `severity` prevents authors from believing a text-only rule is enforced.

### Decision 6: `RuleItem` gains optional fields only when a check exists

**Choice**: `RuleItem` gets `check?: RuleCheck` and `severity?: Severity`, set together via conditional spread only when the rule declares a check. Rules without a check produce exactly today's object, so existing `toEqual` assertions, `folder-source.ts`, `clack-prompter.ts` and `schema.ts` need no change.

**Alternatives considered**: always setting `severity` (breaks deep-equality tests for every rule and invents meaning for unchecked rules); a separate `parseRuleCheck` called by the future runner (two parses of the same bytes, two places to diverge).

### Decision 7: Findings are plain data, bounded and deterministic

**Choice**: `evaluateRuleCheck` returns `{ status, findings, skipped, truncated }`. Findings are sorted by `path`, then `line`; at most 200 findings per check (`truncated: true` beyond that). Files in scope with `text === undefined` (binary, too large or not loaded by the caller) go to `skipped`, not to findings, so the runner decides whether that is a failure.

**Rationale**: Deterministic output makes evaluator tests and future CLI snapshots stable; bounding output protects the runner from a pathological glob over a large tree; `skipped` avoids silent passes without inventing failures.

## Data Flow

```
catalog/rules/<name>.md (bytes)
        │
        ▼
parseRule(stem, bytes)                         src/domain/catalog/rule.ts
   │  readFrontmatter(text, file, { allowNested: true, mappings: ['check'] })
   │        └─ readBlockMapping(lines, i, key)  src/domain/catalog/frontmatter.ts
   │  RuleCheckSchema.safeParse(maps.check)    src/domain/catalog/rule-check.ts
   │        ├─ parseGlob(...)                   src/domain/checks/glob.ts
   │        └─ validatePattern(...)             src/domain/checks/safe-regex.ts
   ▼
RuleItem { name, description, bytes, recommended, check?, severity? }
        │                                   (bytes copied verbatim on install; unchanged)
        ▼  (future, #226: adapter builds the snapshot; not in this change)
evaluateRuleCheck({ name, check, severity }, ProjectSnapshot)   src/domain/checks/evaluate.ts
        └─ matchGlob / compiled RegExp / heading scan / line count
        ▼
CheckEvaluation { status, findings[{ rule, severity, path, line?, message }], skipped, truncated }
```

## File Changes

| File                                                            | Action | Description                                                                                                                   |
| --------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/catalog/frontmatter.ts`                             | Modify | `readBlockMapping`: bounded YAML-subset reader for one mapping level (scalars, block sequences).                              |
| `src/domain/catalog/frontmatter.ts`                             | Modify | `mappings` option and overload; returns `maps` only when requested.                                                           |
| `src/domain/checks/glob.ts`                                     | Create | `parseGlob` (slice 2: syntax validation and segment compilation) and `matchGlob` (slice 3).                                   |
| `src/domain/checks/safe-regex.ts`                               | Create | `validatePattern` and `compilePattern` (length, `u` compile, backreference, lookbehind, nested-quantifier guards).            |
| `src/domain/catalog/rule-check.ts`                              | Create | `SeveritySchema`, `RuleCheckSchema` (discriminated union), types, limits, zod-issue formatting.                               |
| `src/domain/catalog/rule.ts`                                    | Modify | Remove `RESERVED_RULE_KEYS`; request `mappings: ['check']`; validate `check`/`severity`; attach to `RuleItem`.                |
| `src/domain/checks/evaluate.ts`                                 | Create | `ProjectSnapshot`, `RuleFinding`, `CheckEvaluation`, `evaluateRuleCheck`.                                                     |
| `test/domain/catalog/frontmatter-block-mapping.test.ts`         | Create | Table-driven subset tests (accepted, rejected, YAML-equivalence cases).                                                       |
| `test/domain/catalog/frontmatter.test.ts`                       | Modify | `mappings` option; `paths:` stays opaque; no `maps` key without the option.                                                   |
| `test/domain/catalog/rule-check.test.ts`                        | Create | Schema per type, limits, normalization, error messages.                                                                       |
| `test/domain/checks/safe-regex.test.ts`                         | Create | Accepted and rejected patterns.                                                                                               |
| `test/domain/checks/glob.test.ts`                               | Create | Syntax validation (slice 2) and matching tables (slice 3).                                                                    |
| `test/domain/checks/evaluate.test.ts`                           | Create | Each type over in-memory snapshots; ordering, truncation, skipped, deferred.                                                  |
| `test/domain/catalog/rule.test.ts`                              | Modify | Replace reserved-key tests with check/severity acceptance and rejection tests.                                                |
| `test/rules-docs.test.ts`                                       | Modify | Replace the `reserved keys` token with a "declared but not enforced until #226" token (README, CONTRIBUTING, security en/es). |
| `README.md`, `CONTRIBUTING.md`                                  | Modify | Document `check`/`severity`, the five types, glob and regex limits, and that checks are not enforced yet (#226).              |
| `website/src/content/docs/en/security.md`, `.../es/security.md` | Modify | Replace "reserved and rejected" with the not-enforced note and the regex stance.                                              |

No change to `src/adapters/**`, `src/application/**`, `src/ports/**`, `catalog/**`, `scripts/**` or profile code (#285).

## Interfaces / Contracts

```ts
// src/domain/catalog/frontmatter.ts
export type MappingValue = string | string[];
export type BlockMapping = Record<string, MappingValue>;
/** Parses the indented block that starts at lines[start] (the line after `key:`). `next` = first unconsumed line. */
export function readBlockMapping(
  lines: readonly string[],
  start: number,
  key: string,
): { value: BlockMapping; next: number } | { issue: string };

// src/domain/catalog/frontmatter.ts (additional overload)
export type MappedFrontmatterResult =
  | { data: Record<string, string>; opaque: string[]; maps: Record<string, BlockMapping>; body: string }
  | FrontmatterIssue;
export function readFrontmatter(
  text: string,
  file: string,
  options: { allowNested: true; mappings: readonly string[] },
): MappedFrontmatterResult;
```

```ts
// src/domain/catalog/rule-check.ts
export const MAX_GLOBS = 32;
export const MAX_SECTIONS = 32;
export const MAX_SECTION_LENGTH = 120;
export const MAX_ARGS = 32;

export const SeveritySchema = z.enum(['error', 'warn']);
export type Severity = z.infer<typeof SeveritySchema>;

const Glob = z.string().superRefine(/* parseGlob issue -> ctx.addIssue */);
const Globs = z.union([Glob, z.array(Glob).min(1).max(MAX_GLOBS)]).transform((g) => (Array.isArray(g) ? g : [g]));
const PositiveInt = z
  .string()
  .regex(/^[1-9][0-9]{0,6}$/)
  .transform(Number); // parser yields strings
const Bool = z.enum(['true', 'false']).transform((b) => b === 'true');

export const RuleCheckSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('file-exists'), path: Glob, each: Glob.optional() }),
  z.strictObject({
    type: z.literal('contains-sections'),
    files: Globs,
    exclude: Globs.optional(),
    sections: z.union([Section, z.array(Section).min(1).max(MAX_SECTIONS)]).transform(toArray),
  }),
  z.strictObject({
    type: z.literal('pattern-absent'),
    files: Globs,
    exclude: Globs.optional(),
    pattern: z.string().superRefine(/* validatePattern */),
    'ignore-case': Bool.optional(),
    message: z.string().trim().min(1).max(200).optional(),
  }),
  z.strictObject({ type: z.literal('max-lines'), files: Globs, exclude: Globs.optional(), max: PositiveInt }),
  z.strictObject({
    type: z.literal('tool'),
    tool: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/), // a bin name, never a path or shell text
    args: z
      .union([z.string(), z.array(z.string()).max(MAX_ARGS)])
      .transform(toArray)
      .optional(),
  }),
]);
export type RuleCheck = z.output<typeof RuleCheckSchema>;
/** First zod issue as `invalid check: <dotted.path>: <message>`. */
export function formatCheckIssue(error: z.ZodError): string;
```

```ts
// src/domain/catalog/rule.ts
export interface RuleItem {
  name: string;
  description: string;
  bytes: Uint8Array;
  recommended: boolean;
  /** Present only when the rule declares a check; then `severity` is present too (default 'error'). */
  check?: RuleCheck;
  severity?: Severity;
}
```

Rule-level issues (exact strings fixed in spec/tests): `check must be a nested mapping`, `severity requires a check`, `severity must be 'error' or 'warn'`, `invalid check: <path>: <reason>`, and subset-parser issues naming the key and the offending line.

```ts
// src/domain/checks/glob.ts
export type Glob = { readonly source: string; readonly segments: readonly string[] };
export function parseGlob(source: string): Glob | { issue: string };
export function matchGlob(glob: Glob, path: string): boolean;
export function matchesAny(globs: readonly Glob[], path: string): boolean;

// src/domain/checks/safe-regex.ts
export const MAX_PATTERN_LENGTH = 200;
export function validatePattern(source: string): string | undefined; // issue or undefined
export function compilePattern(source: string, ignoreCase: boolean): RegExp; // only after validatePattern

// src/domain/checks/evaluate.ts
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
  path: string; // file path; for file-exists, the expected path or glob
  line?: number; // 1-based, pattern-absent only
  message: string;
}
export interface CheckEvaluation {
  status: 'evaluated' | 'deferred'; // 'deferred' for type 'tool'
  findings: RuleFinding[];
  skipped: string[]; // files without text, or `path:line` for over-long lines
  truncated: boolean;
}
export const MAX_FINDINGS = 200;
export const MAX_LINE_LENGTH = 10_000;
/** A finding before the rule name and effective severity are attached. */
export interface FindingDraft {
  path: string;
  line?: number;
  message: string;
}
/** Sorts, caps at MAX_FINDINGS and attaches rule/severity. Exported so the core can be tested before the evaluators. */
export function finalizeEvaluation(
  rule: { name: string; severity: Severity },
  drafts: readonly FindingDraft[],
  skipped: readonly string[],
): CheckEvaluation;
/** `\n`-separated lines ignoring one trailing newline. Exported to test the empty string (0 lines) directly. */
export function countLines(text: string): number;
export function evaluateRuleCheck(
  rule: { name: string; check: RuleCheck; severity: Severity },
  snapshot: ProjectSnapshot,
): CheckEvaluation;
```

Example rule frontmatter accepted by the subset:

```yaml
---
name: no-any
description: Do not use the any type in TypeScript
severity: error
check:
  type: pattern-absent
  files:
    - 'src/**/*.ts'
  exclude: '**/*.d.ts'
  pattern: ':\s*any\b'
  message: Use unknown or a precise type instead of any
---
```

Line counting for `max-lines`: number of `\n`-separated lines, ignoring one trailing newline (`'a\n'` is 1 line, `''` is 0). CRLF counts as one line break.

## Testing Strategy

Strict TDD (`pnpm test`): every behavior gets a failing test first.

| Layer         | What to test                                                                                                                                                                                         | Approach                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Unit (domain) | Subset parser: scalars (plain, single, double), block sequences at both legal indents, comments, every rejected construct, duplicate keys, tabs, YAML-equivalence cases (`'it''s'`, trailing ` # c`) | `it.each` tables in `frontmatter-block-mapping.test.ts`       |
| Unit (domain) | `readFrontmatter` with and without `mappings`; `paths:` still opaque; no `maps` key without the option                                                                                               | `frontmatter.test.ts`                                         |
| Unit (domain) | Glob validation and matching (`*`, `?`, `**` at start, middle, end, zero segments, dot-files, rejected syntax, length cap)                                                                           | `glob.test.ts` tables                                         |
| Unit (domain) | Regex guards: accepted patterns; rejected nested quantifiers, backreferences, lookbehind, invalid `u` syntax, length                                                                                 | `safe-regex.test.ts` tables                                   |
| Unit (domain) | Schema per type: normalization of scalar/list, `strictObject` unknown key, `max` parsing, `ignore-case`, tool name, issue formatting                                                                 | `rule-check.test.ts`                                          |
| Unit (domain) | `parseRule`: valid check with and without severity (default `error`), severity without check, scalar check, invalid check, bytes verbatim, unchecked rule shape unchanged                            | `rule.test.ts`                                                |
| Unit (domain) | Evaluators per type over in-memory snapshots; sorting, `MAX_FINDINGS` truncation, `skipped`, `deferred` for `tool`, no I/O                                                                           | `evaluate.test.ts`                                            |
| Repo guards   | Domain purity, no `../` imports, docs tokens                                                                                                                                                         | existing `architecture.test.ts`, updated `rules-docs.test.ts` |
| Integration   | Existing `folder-source` and bundled-catalog tests stay green unchanged (no seed rule declares a check)                                                                                              | existing suites                                               |
| E2E           | None (no CLI surface)                                                                                                                                                                                | N/A                                                           |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The `tool` check type is validated data only and is never executed in this change; execution and its threat model belong to #226. Regex and glob input safety is covered by Decisions 2 and 3.

## PR Slices (stacked-to-main)

| PR  | Files                                                                                                                                                                                                                                                                                                 | Est. authored lines                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | `frontmatter-map.ts` (~150), `frontmatter.ts` (~30), `frontmatter-block-mapping.test.ts` (~170), `frontmatter.test.ts` (~30)                                                                                                                                                                          | ~380                                                    |
| 2   | `rule-check.ts` (~110), `checks/glob.ts` parse half (~50), `checks/safe-regex.ts` (~70), `rule.ts` (~30), tests: `rule-check.test.ts` (~90), `safe-regex.test.ts` (~40), `glob.test.ts` validation (~30), `rule.test.ts` (~40); docs README, CONTRIBUTING, security en/es, `rules-docs.test.ts` (~30) | ~490 (split docs into a 2b PR if review prefers <= 400) |
| 3   | `checks/glob.ts` match half (~50), `checks/evaluate.ts` (~150), `glob.test.ts` matching (~60), `evaluate.test.ts` (~160)                                                                                                                                                                              | ~420                                                    |

Total ~1,290 authored lines. Slice 2 must ship the docs and `rules-docs.test.ts` change together with the reservation removal, or the docs test fails; that is why its estimate is the largest. Each slice is independently green: slice 1 adds an unused option, slice 2 makes checks loadable but nothing evaluates them, slice 3 adds unused evaluators.

## Resolved Assumptions

- **A: `file-exists` with `each` and a glob `path` (resolved in PR 2a, task 2.8).** `path` is always a validated glob (`parseGlob`), with and without `each`; `each` is a validated glob too. Without `each`, `path` is matched against whole snapshot paths. With `each`, the evaluator does NOT join `each` and `path` into one glob string (a matched directory name could itself contain `*` or `?`); for every directory `D` matching `each`, it strips the literal prefix `D/` from snapshot file paths and matches the remainder against `path`. So `path: README.md` means `D/README.md`, `path: '*.md'` means any direct child `.md`, and `path: '**/index.ts'` means `index.ts` anywhere below `D`. A directory is a proper prefix of at least one file path; the finding for a directory lacking a match uses the expected path `D/<path glob source>`. No schema restriction beyond `parseGlob` is needed. Task 4.4 and 4.5 implement exactly this.
- Schema deviation from the Interfaces sketch: list-or-scalar fields use `z.preprocess` wrapping to a list followed by `z.array(...)` instead of `z.union([...]).transform(...)`, so zod reports `files.0` with the glob reason instead of an opaque union error. Behavior and normalized output are identical.

## Migration / Rollout

No migration required: no manifest version, install path or catalog data changes. Rules without `check` behave exactly as before. Rules that declare a check are inert until #226; docs state this.

## Rollback Plan

Revert in reverse slice order. Reverting slice 3 removes unused evaluators with no other effect. Reverting slice 2 restores `RESERVED_RULE_KEYS` and the docs; safe because no bundled rule declares a check (the data slice is deferred), though a `--source` folder rule using `check` would then fail to load again, which is the pre-change behavior. Reverting slice 1 removes the unused `mappings` option. No installed state is affected by any revert.

## Open Questions

- [ ] Spec phase should confirm the exact issue strings listed under Interfaces (they become test assertions).
- [ ] #226 must confirm that `tool` (data-only, `deferred`) and `skipped` semantics fit the runner; this design keeps both additive-friendly.
