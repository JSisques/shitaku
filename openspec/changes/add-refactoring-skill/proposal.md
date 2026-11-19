# Proposal: Add refactoring Catalog Skill

## Intent

Add a bundled **refactoring** skill (#274) so agents restructure code safely and consistently: a test safety net before touching code, behavior kept unchanged, one small named refactoring step at a time, tests after every step, and atomic `refactor:` commits never mixed with behavior changes. Today agents improvise refactors, which leads to large untested rewrites, silent behavior changes and commits that mix cleanup with features. The skill also unblocks a future `refactorer` agent, which will preload it through its `skills:` frontmatter.

## Scope

### In Scope

- `catalog/skills/refactoring/SKILL.md`: English, generic (works in any repository), model-invocable (no `disable-model-invocation`), exactly two frontmatter keys: `name: refactoring` and a single-quoted, single-line `Trigger:`-style `description` (<=250 chars, no apostrophes, double quotes or pipes). Layout mirrors `docs-writing` and `product-owner`: Activation Contract, Hard Rules, Decision Gates (Condition | Action table), Execution Steps, Output Contract (~45-65 lines).
- Skill behavior:
  - **Safety net first**: run existing tests before touching code; when coverage is missing, write characterization tests first, or stop and ask.
  - **Behavior unchanged**: no new features, bug fixes or public contract changes inside a refactoring step.
  - **Small named steps**: apply one named refactoring at a time from a compact catalog with when-to-apply guidance (for example Extract Function, Inline Function, Rename, Extract Variable, Move Function or Field, Replace Conditional with Guard Clauses or Polymorphism, Introduce Parameter Object, Remove Dead Code, Replace Magic Number with Constant, Decompose Conditional).
  - **Verify each step**: run tests after every step; revert the step when they fail.
  - **Atomic commits**: one `refactor:` commit per coherent step, never mixed with behavior changes; no scope creep.
  - Activation boundary: "Not for" new features, bug fixes, commit-message authoring or pull request text.
- Register `refactoring` in `catalog/catalog.json` -> `items.skills` in alphabetical order (`docs-writing`, `example-skill`, `pr-writing`, `product-owner`, `refactoring`, `socratic-method`).
- Update `test/adapters/catalog/bundled-catalog.test.ts` RED first: bundled skill list, sorted directory entries, count 5 -> 6, a `refactoring` entry with `files: ['SKILL.md']`, and a content-contract test via the existing `expectSkillContract` helper (a few load-bearing required tokens; forbidden `/shitaku/i` and `Co-Authored-By`).
- Regenerate docs: `pnpm run docs:catalog` (README) then `pnpm run docs:website-catalog` (website en/es); verify with the matching `:check` scripts.

### Out of Scope

- The `refactorer` agent (follow-up issue; it will consume this skill).
- Commit-message authoring rules (owned by the existing conventional-commits rule) and PR titles or descriptions (owned by `pr-writing`).
- Any change to existing skills, rules or agents.
- A `references/` folder or multi-file skill (exploration Approach B).
- Any `src/` change (domain, ports, application, adapters) or install-time templating.
- Hand edits to generated README or website pages, or to `CHANGELOG.md` (release-generated).

## Capabilities

Catalog-bundled skill content and installability acceptance. Install, list and validate behavior stays under the existing `catalog` and `skills-install` capabilities (no deltas).

### New Capabilities

- `refactoring-skill`: catalog-bundled refactoring skill content (safety net and characterization tests, behavior preservation, named small steps with a compact refactoring catalog, per-step verification and revert, atomic `refactor:` commits), activation boundary, decision gates, and installability acceptance.

### Modified Capabilities

None

## Approach

Exploration Approach A: a single generic `SKILL.md` mirroring the archived `add-docs-writing-skill` and `add-product-owner-skill` changes and CONTRIBUTING "Add a skill". The skill tells the agent to inspect the repository first (test runner, coverage of the target code, commit conventions), secure a safety net, then apply named refactorings one at a time with tests after each. The refactoring catalog stays compact (a short table or bullet list) to respect the ~45-65 line precedent. Install remains a byte-identical copy.

Strict TDD (`pnpm test`): update the bundled-catalog test and add the content-contract test first and observe RED, then add the skill and catalog entry (GREEN), then run the gates and regenerate docs.

Delivery: one PR with two Conventional Commits:

1. `feat(catalog): add refactoring skill` (SKILL.md, catalog.json, test).
2. `docs: list refactoring skill in README and website` (generated README and website pages).

## Affected Areas

Hexagonal layers: none (`src/domain`, `src/ports`, `src/application`, `src/adapters` untouched). Catalog data, tests and generated docs only.

| Area                                                             | Impact   | Description                                               |
| ---------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| `catalog/skills/refactoring/SKILL.md`                            | New      | Skill content and frontmatter                             |
| `catalog/catalog.json`                                           | Modified | Add `refactoring` to `items.skills` (alphabetical)        |
| `test/adapters/catalog/bundled-catalog.test.ts`                  | Modified | Bundled list, dir entries, count 6, content-contract test |
| `README.md`                                                      | Modified | Skills table (generated by `docs:catalog`)                |
| `website/src/content/docs/{en,es}/catalog/skills/refactoring.md` | New      | Website pages (generated by `docs:website-catalog`)       |
| `src/`                                                           | None     | Catalog data only                                         |

## Risks

| Risk                                                             | Likelihood | Mitigation                                                                                                                |
| ---------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| Description breaks the 250-char or no-apostrophe/quote/pipe rule | Med        | Short trigger phrases plus one summary clause; avoid contractions; `expectSkillContract` enforces it                      |
| Refactoring catalog inflates the skill beyond the compact format | Med        | Keep the catalog to ~8-10 one-line entries; defer extras rather than add `references/`                                    |
| Overlap with conventional-commits rule or pr-writing             | Low        | Explicit "Not for" boundary; state only that refactor commits stay separate from behavior changes                         |
| Docs CI drift (README/website out of sync)                       | Med        | Run both docs scripts in order and their `:check` variants                                                                |
| Brittle content guard                                            | Low        | Assert only a few load-bearing tokens (for example behavior, Extract Function, Rename, characterization, atomic, Not for) |
| Prettier reformats Markdown tables                               | Low        | Run `pnpm run format` before the gate                                                                                     |

## Rollback Plan

Revert the PR (or its two commits): remove `catalog/skills/refactoring/`, the `catalog.json` entry, the test changes, and the regenerated README and website pages (or rerun the docs scripts after the revert). No `src/`, manifest or migration impact. Users who already installed the skill can run `shitaku undo` or delete the installed skill directory. The future `refactorer` agent is not yet shipped, so nothing depends on the skill at revert time.

## Dependencies

- Shipped skills-install capability (existing `skills-install` spec) and the existing catalog docs generators.
- No external dependency.

## Review Workload Forecast

Expected authored change ~150-200 lines: ~45-65-line SKILL.md, 1-line catalog entry, ~20-40 test lines; generated README and website pages excluded. Single PR, two commits. 400-line budget risk: Low. Decision needed before apply: No. Chained PRs recommended: No.

## Success Criteria

- [ ] Bundled-catalog test lists 6 skills including `refactoring` and passes (observed RED first)
- [ ] Content-contract test for `refactoring` passes via `expectSkillContract`
- [ ] `pnpm run build` then `node dist/main.js init --skills refactoring --scope project --dry-run` plans a `create` for the skill from the bundled catalog
- [ ] `docs:catalog:check` and the website catalog check pass
- [ ] SKILL.md has single-line `name: refactoring`, Trigger-style one-line `description` (<=250 chars), no `disable-model-invocation`
- [ ] SKILL.md covers safety net and characterization tests, unchanged behavior, small named steps with a compact catalog, tests after each step with revert on failure, and atomic `refactor:` commits
- [ ] SKILL.md excludes new features, bug fixes, commit-message authoring and PR text
- [ ] SKILL.md is concise English with no project-specific hardcoding
- [ ] No `src/` changes; `CHANGELOG.md` untouched
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` pass
