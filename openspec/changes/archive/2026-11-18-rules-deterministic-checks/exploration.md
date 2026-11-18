# Exploration: rules-deterministic-checks (#288)

Engram: `sdd/rules-deterministic-checks/explore` (obs 1684).

## Current state

- Rules are a flat-file kind: `catalog/rules/<name>.md` is copied byte-for-byte to `.claude/rules/`.
- `src/domain/catalog/rule.ts` rejects `check` and `severity` via `RESERVED_RULE_KEYS` (message `key '<k>' is reserved for rule checks (see #288)`). #288 replaces this with real validation.
- The reservation is also asserted or documented in `test/domain/catalog/rule.test.ts`, `test/rules-docs.test.ts`, `CONTRIBUTING.md`, `README.md` and the website security page (en/es).
- `src/domain/catalog/frontmatter.ts` has no YAML parser: a nested `check: {...}` object is opaque today.
- Runtime deps are only `zod`; no yaml or glob library.
- `FileSystem.listFiles` rejects symlinks and large trees, so it does not fit scanning a project.
- Reusable: `ProcessRunner` port, `NodeProcessRunner`, `application/run-script.ts` (tool resolution, `.mjs` execution).
- Not present: gate runner (#226), team config repo (#181), learned rules (#228), severity concept.
- `test/adapters/catalog/bundled-catalog.test.ts` asserts exactly 10 rules, keys `['name','description']`, max 1500 bytes per file.

## Approaches

1. Pure-domain checks plus an injected file-reader port (recommended): schemas and evaluators in domain, project listing in an adapter, tool/.mjs checks through `ProcessRunner`.
2. Build the gate runner inside this change: observable `error`/`warn`, but collides with #226.
3. Schema-only: smallest, but "error blocks the gate" is not verifiable until #226 exists.

## Recommended slicing

- Slice 1 (~350-450 lines): schema (`check`, `severity`), declarative check types, pure evaluators, tests, reserved-key docs updates.
- Slice 2 (~300-400): project-scan port and adapter, check use case, severity handling, tool references. After the #226 decision.
- Slice 3 (~250-500, mostly data and docs): six new rules, checks on four existing rules, `bundled-catalog.test.ts`, `catalog.json`, generators.
- Defer: source precedence (#181), learned rules (#228), custom `.mjs` checks (trust/security design).

## Risks

- Rule hash churn for installed rules that gain a `check`.
- No YAML parser for a nested `check`.
- Hand-rolled glob is error-prone; the domain cannot import `path`.
- User-supplied regex: ReDoS and size limits.
- Rules with a check ship inert until a runner exists; docs must say so.
- Several docs and test tokens must change together or `rules-docs.test.ts` fails.
- Do not touch profile code (#285).

## Decision gaps

1. Where does `check` live: frontmatter or catalog sidecar?
2. Build own gate runner, or schema and evaluators only and wait for #226?
3. Is custom `.mjs` in scope? (recommend defer)
4. Default severity when `check` is present and `severity` omitted.
5. Dependency for glob/regex, or hand-rolled?
6. Chain strategy for the slices.
7. Should checked rules join `recommended.rules`?
