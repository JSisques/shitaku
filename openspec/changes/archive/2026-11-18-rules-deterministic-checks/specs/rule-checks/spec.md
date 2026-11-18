# Rule Checks Specification

## Purpose

Defines the optional `check` and `severity` frontmatter contract of a rule, the declarative check types (a discriminated union on `type`), validation of that contract, and the pure evaluation of a check over an in-memory project snapshot. Checks are declared and evaluable but inert: no runner, CLI command, project scan, snapshot builder, or exit-code policy exists in this change (consumer: #226). The `tool` check type is data only and is never executed. Custom `.mjs` checks, source precedence (#181), learned rules (#228), and seed-rule catalog data are out of scope.

## Requirements

### Requirement: Check and severity frontmatter keys

A rule MAY declare at most one `check` (a nested mapping) and a `severity` in its own frontmatter. `severity` MUST be a single-line scalar equal to `error` or `warn`. When `check` is present and `severity` is omitted, the effective severity MUST be `error`. `severity` without `check` MUST make the rule invalid. A rule without `check` MUST expose no check and no severity. Rule bytes MUST stay verbatim: `check` and `severity` are not stripped from the file. Rule-level issues MUST use these exact strings: `check must be a nested mapping`, `severity requires a check`, `severity must be 'error' or 'warn'`, and `invalid check: <dotted.path>: <reason>`.

#### Scenario: Check with explicit severity

- GIVEN a rule whose frontmatter has a valid `check` and `severity: warn`
- WHEN parsed
- THEN the rule is valid, exposes the parsed check, and its effective severity is `warn`

#### Scenario: Default severity is error

- GIVEN a rule with a valid `check` and no `severity`
- WHEN parsed
- THEN the effective severity is `error`

#### Scenario: Invalid severity value

- GIVEN a rule with a valid `check` and `severity: fatal`
- WHEN parsed
- THEN the rule is rejected with the issue `severity must be 'error' or 'warn'`

#### Scenario: Severity without check

- GIVEN a rule with `severity: error` and no `check`
- WHEN parsed
- THEN the rule is rejected with the issue `severity requires a check`

#### Scenario: Check is not a nested mapping

- GIVEN a rule with `check: pattern-absent` on one line
- WHEN parsed
- THEN the rule is rejected with the issue `check must be a nested mapping`

#### Scenario: Rule without check

- GIVEN a rule with only `name`, `description`, optional `paths:`, and a body
- WHEN parsed
- THEN the rule is valid, exposes no check and no severity, and its parsed object is identical to before this change

#### Scenario: Bytes verbatim

- GIVEN a rule with a `check` block and `severity`
- WHEN parsed
- THEN the exposed bytes equal the file bytes

### Requirement: Declarative check types

A `check` MUST be a single mapping with a `type` discriminator and kebab-case keys. Exactly these types MUST be supported; any other `type` MUST be rejected:

- `file-exists`: fields `path` (glob, required) and `each` (glob, optional).
- `contains-sections`: fields `files` (glob or list), `exclude` (glob or list, optional), and `sections` (string or list of strings, required).
- `pattern-absent`: fields `files` (glob or list), `exclude` (optional), `pattern` (regular expression, required), `ignore-case` (`true` or `false`, optional), and `message` (optional string, 1-200 characters after trimming).
- `max-lines`: fields `files` (glob or list), `exclude` (optional), and `max` (positive integer, 1 to 7 digits, no leading zero).
- `tool`: fields `tool` (a bare executable name matching `^[a-z0-9][a-z0-9._-]*$`, never a path or shell text) and `args` (optional string or list of strings).

Unknown fields inside `check` MUST be rejected (strict objects). `files`, `exclude`, `sections`, and `args` MUST accept a single value or a list and MUST be normalized to lists. Lists MUST NOT be empty and MUST NOT exceed 32 entries (`args` MAY be empty but MUST NOT exceed 32); each section MUST be at most 120 characters. `ignore-case` MUST be parsed from the strings `true` or `false`. A rule MUST NOT declare more than one check. The types `forbid-pattern`, `require-file`, `max-size`, and any `max-bytes` limit MUST NOT exist. Validation failures MUST be reported as `invalid check: <dotted.path>: <reason>` using the first failing issue.

#### Scenario: Each type validates

- GIVEN valid `file-exists`, `contains-sections`, `pattern-absent`, `max-lines`, and `tool` checks
- WHEN each is parsed
- THEN each is accepted and its fields are exposed with `files`, `exclude`, `sections`, and `args` as lists

#### Scenario: Scalar and list normalization

- GIVEN `files: 'src/**/*.ts'` in one check and a two-item `files` list in another
- WHEN parsed
- THEN both expose `files` as a list

#### Scenario: Unknown type

- GIVEN `check` with `type: run-script`, or the former `type: forbid-pattern`
- WHEN parsed
- THEN the rule is rejected with an `invalid check: type:` issue

#### Scenario: Missing type or required field

- GIVEN a `check` lacking `type`, a `pattern-absent` lacking `pattern`, or a `max-lines` lacking `max`
- WHEN parsed
- THEN the rule is rejected with an `invalid check:` issue naming the missing field

#### Scenario: Wrong field type or unknown field

- GIVEN `max: many`, `max: 0`, `max: -3`, `ignore-case: maybe`, or an unrecognized field `extra: 1`
- WHEN parsed
- THEN the rule is rejected with an `invalid check:` issue naming the offending field

#### Scenario: Tool is data only

- GIVEN `type: tool`, `tool: commitlint`, and `args` of `--edit`
- WHEN parsed
- THEN the check is accepted and exposes the tool name and args
- AND a `tool` value containing `/` or whitespace is rejected

### Requirement: Glob and pattern validation

A glob MUST be a POSIX relative path of at most 256 characters. Supported syntax: `*` (zero or more characters within one segment), `?` (exactly one character within a segment), and `**` only as a whole segment (zero or more segments); all else is literal. A glob MUST be rejected when empty, longer than 256 characters, starting with `/`, containing `\`, containing `.` or `..` segments, containing empty segments (`//` or a trailing `/`), mixing `**` into a segment (`a**`, `**.ts`), or containing any of `{ } [ ] !`.

A `pattern` MUST be 1 to 200 characters, MUST compile as a JavaScript regular expression in Unicode (`u`) mode, MUST NOT contain backreferences (`\1` to `\9`, `\k<`) or lookbehind (`(?<=`, `(?<!`), and MUST NOT contain a nested quantifier, meaning a group whose body contains an unescaped quantifier and which is itself followed by a quantifier (for example `(a+)+`, `(a*)*`, `(\w+\s?)*`). The only author-controlled flag MUST be `ignore-case`. The ReDoS stance MUST be documented: catalog checks are reviewed data at the same trust level as hooks, and the guards are defense in depth, not a security boundary.

#### Scenario: Valid glob and pattern

- GIVEN `files: src/**/*.ts` and `pattern: ':\s*any\b'`
- WHEN parsed
- THEN both are accepted

#### Scenario: Rejected glob syntax

- GIVEN a glob of `''`, `/abs`, `../x`, `src//a`, `src/`, `a**`, `**.ts`, `src/{a,b}`, `src/[ab]`, or `!src/a`
- WHEN parsed
- THEN the rule is rejected with an `invalid check:` issue naming the field

#### Scenario: Oversized glob

- GIVEN a glob of 257 characters
- WHEN parsed
- THEN the rule is rejected with an `invalid check:` issue naming the field and the limit

#### Scenario: Invalid regular expression

- GIVEN `pattern: '(unclosed'`
- WHEN parsed
- THEN the rule is rejected with an `invalid check: pattern:` issue naming the compile error

#### Scenario: Oversized or empty pattern

- GIVEN a `pattern` of 201 characters
- WHEN parsed
- THEN the rule is rejected with an `invalid check: pattern:` issue naming the limit
- AND an empty pattern is rejected the same way

#### Scenario: Unsafe pattern shapes

- GIVEN `pattern` values `(a+)+`, `(\w+\s?)*`, `(a)\1`, `(?<=a)b`, or `(?<!a)b`
- WHEN parsed
- THEN each is rejected with an `invalid check: pattern:` issue

### Requirement: Invalid check isolation

An invalid `check` or `severity` MUST make only that rule invalid, reported with the rule file path and the reason. Other rules in the catalog MUST remain valid and installable, and the catalog MUST still load.

#### Scenario: One bad rule among good ones

- GIVEN a catalog with `a` (valid check) and `b` (unknown check type)
- WHEN loaded
- THEN an error names `rules/b.md` and the reason, `b` is not selectable, and `a` is available with its check

### Requirement: Pure evaluation over a snapshot

The system MUST provide `evaluateRuleCheck(rule, snapshot)` taking `{ name, check, severity }` and a `ProjectSnapshot` of the shape `{ files: { path, text? }[] }`, where `path` is POSIX and relative and `text` is undefined when the caller did not or could not load the file. Directories MUST be derived from file paths. The evaluator MUST perform no I/O and MUST NOT read the file system, environment, or clock. It MUST return `CheckEvaluation { status, findings, skipped, truncated }`, where `status` is `evaluated` or `deferred`, `findings` are `{ rule, severity, path, line?, message }`, `skipped` is a list of strings, and `truncated` is a boolean. Findings MUST be sorted by `path`, then `line`, and MUST be capped at 200 per check; when more exist, only the first 200 MUST be returned and `truncated` MUST be `true`. Files in scope with `text === undefined` MUST be listed in `skipped` by path and MUST NOT produce findings. A check with no violation MUST return no findings. Evaluators MUST NOT decide pass or fail.

#### Scenario: Deterministic output

- GIVEN the same check and snapshot evaluated twice
- WHEN compared
- THEN the results are identical and findings are ordered by path then line

#### Scenario: No violations

- GIVEN a snapshot with no violation
- WHEN evaluated
- THEN `status` is `evaluated`, `findings` is empty, `skipped` is empty, and `truncated` is `false`

#### Scenario: Truncation

- GIVEN a check producing 201 violations
- WHEN evaluated
- THEN exactly 200 findings are returned, in sorted order, and `truncated` is `true`

#### Scenario: Unloaded files are skipped

- GIVEN a file in scope whose `text` is undefined
- WHEN a content-based check is evaluated
- THEN the file path is in `skipped` and no finding is produced for it

### Requirement: Finding shape and severity

Each finding MUST carry the rule name, the effective severity (`error` or `warn`), the file path, a human-readable message, and, for `pattern-absent` only, a 1-based line number. A finding MUST NOT carry exit codes or reporting policy.

#### Scenario: Severity carried

- GIVEN a rule with `severity: warn` whose check is violated
- WHEN evaluated
- THEN every finding has severity `warn` and the rule name

#### Scenario: Default severity on findings

- GIVEN a rule with a check and no `severity`, violated
- WHEN parsed and evaluated
- THEN every finding has severity `error`

### Requirement: file-exists evaluation

Without `each`, the evaluator MUST emit exactly one finding, with `path` set to the glob source, when no snapshot file matches `path`, and none otherwise. With `each`, for every directory derived from the snapshot that matches `each`, the evaluator MUST require a file matching `path` interpreted relative to that directory, and MUST emit one finding per directory lacking it, with the expected path.

#### Scenario: File present

- GIVEN `file-exists` with `path: README.md` and a snapshot containing `README.md`
- WHEN evaluated
- THEN no finding is returned

#### Scenario: File missing

- GIVEN the same check and a snapshot without `README.md`
- WHEN evaluated
- THEN one finding is returned with path `README.md`

#### Scenario: Each directory needs a file

- GIVEN `each: src/*`, `path: README.md`, and files `src/a/README.md` and `src/b/index.ts`
- WHEN evaluated
- THEN one finding is returned for the expected path `src/b/README.md` and none for `src/a`

### Requirement: contains-sections evaluation

For every snapshot file matching `files` and not matching `exclude`, the evaluator MUST require, for each listed section, a Markdown heading (`#` to `######`) whose trimmed text equals the section. One finding MUST be emitted per missing section per file, with that file's path.

#### Scenario: All sections present

- GIVEN `sections` of `Install` and `Usage` and a matching README with `## Install` and `## Usage`
- WHEN evaluated
- THEN no finding is returned

#### Scenario: Missing section

- GIVEN the same check and a README lacking `Usage`
- WHEN evaluated
- THEN one finding is returned with that file's path naming `Usage`

#### Scenario: Excluded file

- GIVEN a file matching both `files` and `exclude`
- WHEN evaluated
- THEN no finding is returned for it

### Requirement: pattern-absent evaluation

For every snapshot file matching `files` and not matching `exclude`, the evaluator MUST test each line against `pattern` (with the `i` flag only when `ignore-case` is `true`) and emit one finding per matching line, with the file path and 1-based line number. The finding message MUST be the check's `message` when given, otherwise a default message. Lines longer than 10,000 characters MUST NOT be tested and MUST be listed in `skipped` as `path:line`. Files not in scope MUST be ignored.

#### Scenario: Match found

- GIVEN `files: src/**/*.ts`, `pattern: ':\s*any\b'`, and `src/a.ts` with `const x: any = 1;` on line 3
- WHEN evaluated
- THEN one finding is returned with path `src/a.ts` and line 3

#### Scenario: Multiple matches and files

- GIVEN two matching files with two and one offending lines
- WHEN evaluated
- THEN three findings are returned, ordered by path then line

#### Scenario: Scope and exclude

- GIVEN an offending `test/a.ts` outside `files`, and an offending `src/a.d.ts` matching `exclude`
- WHEN evaluated
- THEN no finding is returned for either

#### Scenario: Ignore case

- GIVEN `pattern: todo` with `ignore-case: true` and a line `// TODO fix`
- WHEN evaluated
- THEN one finding is returned
- AND without `ignore-case` no finding is returned

#### Scenario: Custom message

- GIVEN a `message` of `Use unknown` and a violation
- WHEN evaluated
- THEN the finding message is `Use unknown`

#### Scenario: Over-long line skipped

- GIVEN a matching file with a line of 10,001 characters on line 2
- WHEN evaluated
- THEN that line is not tested, `skipped` contains `<path>:2`, and no finding is produced for it

#### Scenario: Glob semantics

- GIVEN `files: src/*.ts`, and files `src/a.ts` and `src/deep/b.ts`
- WHEN evaluated
- THEN only `src/a.ts` is considered
- AND with `files: src/**/*.ts` both are considered, and `**` also matches zero segments (`src/a.ts`)

### Requirement: max-lines evaluation

For every snapshot file matching `files` and not matching `exclude`, the evaluator MUST emit one finding when its line count exceeds `max`. Lines MUST be counted as `\n`-separated lines ignoring one trailing newline (`'a\n'` is 1 line, `''` is 0), with CRLF counting as one line break. A file exactly at the limit MUST NOT produce a finding.

#### Scenario: Over limit

- GIVEN `max: 300` and a 301-line `src/big.ts`
- WHEN evaluated
- THEN one finding is returned with path `src/big.ts`

#### Scenario: Exactly at limit

- GIVEN a 300-line `src/ok.ts` with `max: 300`
- WHEN evaluated
- THEN no finding is returned

#### Scenario: Line counting

- GIVEN texts `'a\n'`, `''`, and `'a\r\nb\r\n'`
- WHEN counted
- THEN the counts are 1, 0, and 2

### Requirement: tool evaluation is deferred

For a `tool` check, the evaluator MUST NOT execute anything and MUST return `status: 'deferred'` with no findings, no skipped entries, and `truncated: false`.

#### Scenario: Tool deferred

- GIVEN a `tool` check and any snapshot
- WHEN evaluated
- THEN the result is `{ status: 'deferred', findings: [], skipped: [], truncated: false }`

### Requirement: Checks are declared but not enforced

Documentation (CONTRIBUTING, README, and the website security page in `en` and `es`) MUST state that rule checks are declared and validated but not enforced by any command until the gate runner (#226) exists, and MUST NOT describe `check` or `severity` as reserved keys. Documentation MUST describe the five check types, the default severity, and the glob and regex limits.

#### Scenario: Docs state non-enforcement

- GIVEN CONTRIBUTING, README, and `website/src/content/docs/{en,es}/security.md`
- WHEN inspected
- THEN each states that checks are not enforced yet and none calls `check` or `severity` reserved

#### Scenario: Docs guard agrees

- GIVEN the docs guard test
- WHEN run
- THEN it asserts the non-enforcement statement and no longer asserts the reserved-key wording
