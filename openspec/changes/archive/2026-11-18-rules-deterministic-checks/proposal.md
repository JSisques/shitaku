# Proposal: Deterministic checks and severity for rules (issue #288)

## Intent

Rules (#237) are instruction text only: the agent may follow them or not, and nothing verifies them. Issue #288 asks for rules that can also carry a deterministic `check` plus a `severity` (`error` | `warn`), so a later gate can verify the rule mechanically instead of trusting the model. Today the rule parser rejects `check` and `severity` as reserved keys (`RESERVED_RULE_KEYS` in `src/domain/catalog/rule.ts`), and the frontmatter reader cannot parse a nested `check` object. This change replaces the reservation with a real, validated schema and pure evaluators, so the gate runner (#226) has a stable contract to consume when it is built.

Rules that declare a `check` are inert in this change: nothing runs the evaluators against a project until a runner exists. Docs must say this explicitly.

## Scope

### In Scope

- Rule frontmatter keys `check` and `severity`, validated on catalog load. `check` lives in the rule's own frontmatter (user decision), not in a sidecar file.
- A small set of declarative check types as a domain schema (exact names and shapes are a design decision; candidates: forbidden content pattern over a file glob, required file present, maximum file size or line count).
- Pure domain evaluators: given a check and an in-memory project snapshot (paths with text or size, supplied by the caller), return findings (`rule`, `severity`, `path`, optional line, message). No I/O.
- Severity semantics as data: `error` and `warn` are carried on findings; the evaluators do not decide exit codes.
- Frontmatter parsing support for the nested `check` value (see Approach).
- Remove the reserved-key rejection and update every place that asserts or documents it: `test/domain/catalog/rule.test.ts`, `test/rules-docs.test.ts`, `CONTRIBUTING.md`, `README.md`, and the website security page (en and es).
- Docs stating that checks are declared but not yet enforced until #226.
- Catalog data slice (see PR slicing): the six checked seed rules from the issue (`no-any`, `layer-boundaries`, `env-documented`, `no-stray-todos`, `changelog-or-docs`, `max-file-size`) and checks on four existing seed rules, with the bundled-catalog test, `catalog.json`, and generators updated. Whether this slice ships now (inert) or waits for #226 is an open question below.

### Out of Scope

- Gate runner, `shitaku check` (or similar) CLI command, exit-code policy, and any project-scan adapter or port: wait for #226 (user decision).
- Custom `.mjs` checks and tool-invocation checks (trust and execution model need their own design): follow-up.
- Source precedence layers (catalog < team < project): follow-up #181.
- Learned rules: follow-up #228.
- Profiles (#285 removes them): no change to `profile.ts` or profile wiring.
- Any change to how rule bytes are installed: bytes stay verbatim, `check` YAML reaches `.claude/rules/` and Claude Code ignores it.

## Capabilities

### New Capabilities

- `rule-checks`: the `check` and `severity` frontmatter contract, the declarative check types, validation errors, and pure evaluation semantics (input snapshot, findings, severity carried on findings).

### Modified Capabilities

- `catalog`: rule validation changes. `check` and `severity` stop being reserved; when present they MUST validate against `rule-checks`, and an invalid check makes the rule invalid with path and reason. Unknown keys and verbatim bytes are unchanged.
- `rules-install`: only if the catalog data slice ships in this change. The "exactly ten seed rules" and "Seed rules MUST NOT declare checks or severity" requirements change to sixteen seed rules, some with checks.

## Approach

Exploration approach 1 reduced to the user's scope: pure domain only, no ports or adapters added.

- **Domain schema** (`src/domain/catalog/rule-check.ts`, new): zod schemas for `severity` and a discriminated union of check types. `parseRule` returns the parsed check and severity on `RuleItem` (optional fields), so loaders and a future runner share one parse.
- **Frontmatter parsing** (decision for design, stated here as an approach risk). Two options:
  - A YAML-subset parser for nested mappings and scalar lists in nested mode. Most natural for authors; larger surface and more edge cases to test.
  - A restricted format, for example flat keys (`check-type: forbid-pattern`, `check-glob: ...`) or a single-line flow mapping. Small parser, but less idiomatic and possibly diverges from the issue's examples.
    Either way the reader stays pure, and the existing opaque behavior for other nested keys such as `paths:` must not regress.
- **Matching** (decision for design): glob matching over forward-slash paths implemented as a pure hand-rolled matcher (domain cannot import `path`) versus a small dependency (runtime deps are only `zod` today). User-supplied regex needs guards: compile-time validation, length limits, and a documented ReDoS stance.
- **Evaluators** (`src/domain/rules/evaluate-check.ts` or similar): pure functions over a snapshot type defined in the domain. A future adapter for #226 builds the snapshot; this change only tests evaluators with in-memory fixtures.
- **Default severity** when `check` is present and `severity` is omitted: open question, suggested `error`. `severity` without `check` is likely invalid; design confirms.
- Strict TDD throughout (`pnpm test`); the architecture guard keeps the domain free of `fs`, `path`, `process`, and `child_process`.

## Affected Areas

| Layer       | Area                                                                                                                                | Impact       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Domain      | `src/domain/catalog/rule.ts` (drop reservation, attach check), `src/domain/catalog/frontmatter.ts`                                  | Modified     |
| Domain      | `src/domain/catalog/rule-check.ts`, check evaluators and matcher (new)                                                              | New          |
| Ports       | None                                                                                                                                | None         |
| Application | None (no runner or use case in this change)                                                                                         | None         |
| Adapters    | `src/adapters/catalog/*` only if the loaded `RuleItem` shape needs wiring                                                           | Modified     |
| Data/docs   | `catalog/rules/*.md`, `catalog/catalog.json`, `scripts/generate-*.mjs`, README, CONTRIBUTING, website security page (en/es)         | New/Modified |
| Tests       | `test/domain/catalog/rule.test.ts`, `test/rules-docs.test.ts`, `test/adapters/catalog/bundled-catalog.test.ts`, new evaluator tests | New/Modified |

## Risks

| Risk                                                                                                                                                   | Likelihood | Mitigation                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------ |
| Nested `check` needs a parser that does not exist; a YAML subset grows edge cases                                                                      | High       | Design picks YAML subset vs restricted format; table-driven tests; keep `paths:` opaque behavior |
| Hash churn: adding `check` to four existing rules changes their bytes, so installed copies plan as `update`, and user-edited copies plan as `conflict` | Med        | Expected flat-file semantics; call it out in release notes; no manifest change needed            |
| Checked rules ship inert until #226; users may assume enforcement                                                                                      | Med        | README, CONTRIBUTING, and website state that checks are not enforced yet                         |
| Hand-rolled glob matcher is error-prone                                                                                                                | Med        | Narrow supported syntax (`*`, `**`, `?`), documented; exhaustive tests; or a dependency (design) |
| User-supplied regex: ReDoS and oversized patterns                                                                                                      | Med        | Validate on load, cap length, document; catalog checks are reviewed data                         |
| Some issue rules (`env-documented`, `changelog-or-docs`) need cross-file or changed-file input that a simple snapshot does not cover                   | Med        | Design decides whether they fit the declarative types or stay instruction-only for now           |
| Several docs and test tokens must change together or `rules-docs.test.ts` fails                                                                        | Med        | Change reservation code, tests, and docs in the same slice                                       |
| Schema chosen now constrains #226                                                                                                                      | Low        | Keep evaluator output plain data; runner owns exit codes and reporting                           |
| Collision with profile removal (#285)                                                                                                                  | Low        | Do not touch profile code                                                                        |

## Rollback Plan

Each slice reverts independently. Reverting the data slice removes the new and modified seed rules; installed copies remain plain Markdown that Claude Code still loads, and `undo`/`uninstall` remove them. Reverting the schema slice restores `RESERVED_RULE_KEYS`; any catalog rule that declares `check` would then fail to load, so the data slice must be reverted first. No manifest version or install-path change is involved, so no downgrade note is required beyond the bundled rule set.

## Dependencies

- None blocking for the schema and evaluators.
- #226 (gate runner) is the consumer; enforcement waits for it.
- Follow-ups: #181 (precedence), #228 (learned rules), custom `.mjs` checks (new issue).

## Open Questions for the User

1. Default `severity` when a rule has a `check` but omits `severity`. Suggested: `error`.
2. Ship the catalog data slice (six new rules and checks on four existing rules) now, inert until #226, or defer it to land with #226.
3. Which four existing seed rules gain checks (the issue text should be confirmed; exploration did not pin the list).

Design questions (not product decisions): YAML-subset parser vs restricted format; hand-rolled glob/regex matcher vs dependency; exact check type names and shapes.

## PR Slicing and Review Workload Forecast

Delivery strategy: `ask-on-risk`. The total exceeds the 400-line budget, so a chain strategy (`stacked-to-main` or `feature-branch-chain`) must be chosen before apply.

| PR  | Slice                                                                                                                                                 | Est. lines |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Frontmatter support for nested `check` (parser or restricted format) with tests                                                                       | ~250-350   |
| 2   | `rule-checks` schema, `severity`, `parseRule` wiring, drop reservation, reserved-key docs and test updates                                            | ~300-400   |
| 3   | Pure evaluators and matcher with in-memory snapshot tests                                                                                             | ~300-400   |
| 4   | Catalog data (if approved now): six new rules, checks on four existing rules, `bundled-catalog.test.ts`, `catalog.json`, generators, inert-check docs | ~250-500   |

Slices 1 and 2 may merge if design chooses a restricted format. Total ~1100-1650 authored lines.

Decision needed before apply: Yes
Chained PRs recommended: Yes
400-line budget risk: High

## Success Criteria

- [ ] A rule with a valid `check` and `severity` loads; `RuleItem` exposes the parsed check and effective severity.
- [ ] An invalid `check` (unknown type, bad glob, invalid regex, wrong field types) or invalid `severity` rejects the rule with path and reason; other items stay usable.
- [ ] The reserved-key error no longer exists; docs and `rules-docs.test.ts` agree.
- [ ] Evaluators return the expected findings for each check type over in-memory snapshots, with severity on each finding, and perform no I/O.
- [ ] Rule bytes stay verbatim on install; existing rules without `check` behave exactly as before, and `paths:` frontmatter still loads.
- [ ] Docs state that checks are not enforced until #226.
- [ ] `pnpm test`, typecheck, lint, format, build, and the architecture guard are green.
