# Tasks: Add refactoring Catalog Skill

Strict TDD, runner `pnpm test` (Vitest). Single PR, two commits. Spec: `specs/refactoring-skill/spec.md`. Design: `design.md`.

## Review Workload Forecast

| Item                             | Estimate                                                    |
| -------------------------------- | ----------------------------------------------------------- |
| `SKILL.md` (new)                 | about 60 lines                                              |
| `catalog.json`                   | 1 line                                                      |
| `bundled-catalog.test.ts`        | about 25 lines                                              |
| Generated docs (README, 2 pages) | excluded from authored count                                |
| **Estimated authored changes**   | **about 85-100 changed lines**                              |
| 400-line budget risk             | Low (about 25% of budget)                                   |
| Chained PRs recommended          | No (single PR, two commits)                                 |
| Decision needed before apply     | No (single PR fits the budget; confirm only if scope grows) |

## Phase 1: RED (tests first)

- [x] 1.1 Edit `test/adapters/catalog/bundled-catalog.test.ts` per design "Exact test edits" 1-5: title lists six skills, `items.skills` and sorted dir entries include `refactoring` between `product-owner` and `socratic-method`, `toHaveLength(6)`, add the `refactoring` entry block (`name`, non-empty description, `files` equal `['SKILL.md']`). Satisfies: Bundled registration and valid frontmatter.
- [x] 1.2 Add `it('keeps the refactoring skill content contract')` after the product-owner one, using `expectSkillContract('refactoring', ...)`. Required tokens (aligned with the spec): `characterization test`, `behavior`, `Extract Function`, `Inline Function`, `Rename`, `baseline` (failing baseline blocks refactoring and is reported), `revert`, `pure rename` (existing tests are not edited except a pure rename), `refactor:`, `Not for new features`. Forbidden: `/shitaku/i`, `Co-Authored-By`. The helper already enforces exactly two frontmatter keys, single-quoted `Trigger:` description of at most 250 characters with no apostrophe, double quote or pipe, no `disable-model-invocation`, and the five headings. Satisfies: Model-invocable and generic, Required sections, Safety net first, Behavior unchanged, Small named steps, Verify each step, Atomic commits, Scope limited.
- [x] 1.3 Run `pnpm test`. Record the expected failures: list mismatch (catalog/dir entries) and `ENOENT` for `catalog/skills/refactoring/SKILL.md`. Do not edit any other existing test (profile `skills: []` assertions stay valid).

## Phase 2: GREEN

- [x] 2.1 Create `catalog/skills/refactoring/SKILL.md` per the design outline: two-key frontmatter (`name: refactoring`, single-quoted `Trigger:` description of about 232 characters, no apostrophes, double quotes or pipes); sections Activation Contract (includes `Not for new features, bug fixes, commit-message authoring, or pull request titles and descriptions`), Hard Rules, Decision Gates (Condition | Action table), Execution Steps, Output Contract; about 45-65 lines, generic English, no `shitaku`, no `Co-Authored-By`, no `references/` folder. Content must cover: inspect repo and run tests before changing code; characterization tests or stop and ask when coverage is missing; failing baseline means stop and report, do not refactor; behavior unchanged, bugs and public contract changes reported and handled outside the refactoring; one named refactoring per step with the 11-entry compact catalog (Extract Function, Inline Function, Extract Variable, Rename, Move Function or Field, Decompose Conditional, Replace Conditional with Guard Clauses, Replace Conditional with Polymorphism, Introduce Parameter Object, Replace Magic Number with Constant, Remove Dead Code) as one-line bullets with when-to-apply; run tests after every step; revert a failing step and never patch forward or edit existing tests to pass them, except a pure rename of the symbol under test; one `refactor:` commit per coherent step (or the repository equivalent), never mixed with behavior changes, follow the repository convention when one exists; no scope creep, mention unrelated cleanups as follow-ups. Do not define commit-message rules beyond the `refactor:` type.
- [x] 2.2 Edit `catalog/catalog.json` line 21: `"skills": ["docs-writing", "example-skill", "pr-writing", "product-owner", "refactoring", "socratic-method"],`. Satisfies: Bundled registration (alphabetical).
- [x] 2.3 Run `pnpm test` until green (both RED failures resolved, `catalog.issues` empty).

## Phase 3: Gate and commit 1

- [x] 3.1 Run `pnpm run format` if needed, then `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm test`; all must pass.
- [x] 3.2 Confirm `git diff` touches no `src/`, `CHANGELOG.md`, or existing skill, rule, agent or profile file. Satisfies: Catalog-only surface, Existing items unchanged.
- [x] 3.3 Commit 1 (no hook bypass): `feat(catalog): add refactoring skill` containing the test, `SKILL.md` and `catalog.json`.

## Phase 4: Generated docs and commit 2

- [x] 4.1 Run `pnpm run docs:catalog`, then `pnpm run docs:website-catalog` (never hand-edit generated files).
- [x] 4.2 Run `pnpm run docs:catalog:check`, `pnpm run docs:website-catalog:check` and `pnpm run format:check`; all pass. Verify README and `website/src/content/docs/{en,es}/catalog/skills/refactoring.md` list `refactoring`. Satisfies: Generated docs in sync.
- [x] 4.3 Commit 2: `docs: list refactoring skill in README and website` containing `README.md` and the two new website pages.

## Phase 5: Acceptance

- [x] 5.1 Run `pnpm run build`.
- [x] 5.2 Run `node dist/main.js init --skills refactoring --scope project --dry-run` in a scratch directory; confirm the plan classifies `refactoring` as `create` and nothing is written (no files, backups or manifest). Satisfies: Installable create when absent.
- [x] 5.3 Confirm the working tree is clean and report check results.

## Dependencies

Sequential: 1.x then 2.x then 3.x then 4.x then 5.x (TDD and generated docs depend on the registered skill). No parallelizable tasks; 1.1 and 1.2 touch the same file, 2.1 and 2.2 are independent but tiny.
