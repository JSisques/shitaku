# Proposal: Add test-writing Catalog Skill

## Intent

Add a bundled **test-writing** skill (#268) so agents write reliable, maintainable tests consistently: pick the right test level, mock only at boundaries, name cases by behavior, cover edge cases and regressions, and avoid flakiness. Today agents improvise tests, which leads to over-mocked, implementation-coupled, flaky or redundant suites. The skill complements `refactoring` (which owns characterization tests during a refactor) and can later be preloaded by a test-focused agent.

## Scope

### In Scope

- `catalog/skills/test-writing/SKILL.md`: English, generic and runner-agnostic, model-invocable (no `disable-model-invocation`), exactly two frontmatter keys: `name: test-writing` and a single-quoted, single-line `Trigger:`-style `description` (<=250 chars, no apostrophes, double quotes or pipes). Layout mirrors `docs-writing` and `refactoring`: Activation Contract (ending with a "Not for ..." sentence), Hard Rules, Decision Gates (Condition | Action table), Execution Steps (numbered), Output Contract (~45-65 lines).
- Skill behavior:
  - **Repository conventions first**: inspect the existing runner, file layout, naming and helpers; they win over the skill defaults.
  - **Right level**: choose unit, integration or end-to-end per the test pyramid; prefer the cheapest level that proves the behavior.
  - **Mock only at boundaries**: fake I/O, network, clock and randomness; never mock the unit under test or internal collaborators.
  - **Behavior-named cases**: one behavior per test, Arrange-Act-Assert structure, assertions on observable outcomes.
  - **Edge-case and regression checklists**: empty, boundary, invalid and error paths; a regression test reproduces the bug and fails before the fix.
  - **No flakiness**: deterministic time and randomness, no sleeps, isolated state, no order dependence.
  - Activation boundary: "Not for" refactoring safety nets (owned by `refactoring`), production code changes, commit messages or pull request text.
- Register `test-writing` in `catalog/catalog.json` -> `items.skills` in alphabetical order (after `socratic-method`); run `pnpm run format`.
- Update `test/adapters/catalog/bundled-catalog.test.ts` RED first: both exact skill lists, count 6 -> 7, a `test-writing` entry with `files: ['SKILL.md']`, and a content-contract test via `expectSkillContract` (a few load-bearing tokens; forbidden `/shitaku/i` and `Co-Authored-By`).
- Regenerate docs: `pnpm run docs:catalog` (README) then `pnpm run docs:website-catalog` (website en/es); verify with the matching `:check` scripts.

### Out of Scope

- A `test-writer` agent or any profile entry (possible follow-up).
- Runner-specific guidance (Vitest, Jest, pytest syntax) or coverage thresholds.
- Any change to existing skills (including `refactoring`), rules or agents.
- A `references/` folder or multi-file skill (exploration Approach 2).
- Any `src/` change or install-time templating.
- Hand edits to generated README or website pages, or to `CHANGELOG.md` (release-generated).

## Capabilities

Install, list and validate behavior stays under the existing `catalog` and `skills-install` capabilities (no deltas).

### New Capabilities

- `test-writing-skill`: catalog-bundled test-writing skill content (repository conventions first, test pyramid level choice, boundary-only mocking, behavior naming and Arrange-Act-Assert, edge-case and regression checklists, flakiness avoidance), activation boundary versus `refactoring`, decision gates, and installability acceptance.

### Modified Capabilities

None

## Approach

Exploration Approach 1: a single generic `SKILL.md` mirroring the archived `add-refactoring-skill` and `add-docs-writing-skill` changes. The skill tells the agent to inspect the repository first, decide the level and boundaries, write behavior-named tests, run them, and report. Install remains a byte-identical copy.

Strict TDD (`pnpm test`): update the bundled-catalog test and add the content-contract test first and observe RED, then add the skill and catalog entry (GREEN), then format, regenerate docs, run gates, and dry-run `init --skills test-writing`.

Delivery: one PR with two Conventional Commits:

1. `feat(catalog): add test-writing skill` (SKILL.md, catalog.json, test).
2. `docs: list test-writing skill in README and website` (generated README and website pages).

## Affected Areas

Hexagonal layers: none (`src/domain`, `src/ports`, `src/application`, `src/adapters` untouched). Catalog data, tests and generated docs only.

| Area                                                              | Impact   | Description                                                 |
| ----------------------------------------------------------------- | -------- | ----------------------------------------------------------- |
| `catalog/skills/test-writing/SKILL.md`                            | New      | Skill content and frontmatter                               |
| `catalog/catalog.json`                                            | Modified | Add `test-writing` to `items.skills` (alphabetical)         |
| `test/adapters/catalog/bundled-catalog.test.ts`                   | Modified | Skill lists, count 7, `byName` entry, content-contract test |
| `README.md`                                                       | Modified | Skills table (generated by `docs:catalog`)                  |
| `website/src/content/docs/{en,es}/catalog/skills/test-writing.md` | New      | Website pages (generated by `docs:website-catalog`)         |
| `src/`                                                            | None     | Catalog data only                                           |

## Risks

| Risk                                                             | Likelihood | Mitigation                                                                                          |
| ---------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- |
| Description breaks the 250-char or no-apostrophe/quote/pipe rule | Med        | Count characters; avoid contractions; `expectSkillContract` enforces it                             |
| Overlap with `refactoring` on characterization tests             | Med        | Explicit "Not for" boundary naming refactoring safety nets                                          |
| Content becomes runner-specific or too long                      | Low        | Generic wording, compact checklists, ~45-65 lines                                                   |
| Project name leaks into the skill                                | Low        | Forbidden-token guard (`/shitaku/i`) in the content-contract test                                   |
| Docs CI drift or Prettier reformatting (catalog.json, tables)    | Med        | Run `pnpm run format`, both docs scripts in order and their `:check` variants                       |
| Brittle content guard                                            | Low        | Assert only a few load-bearing tokens (for example boundaries, Arrange, regression, flaky, Not for) |

## Rollback Plan

Revert the PR (or its two commits): remove `catalog/skills/test-writing/`, the `catalog.json` entry, the test changes and the regenerated README and website pages (or rerun the docs scripts after the revert). No `src/`, manifest or migration impact. Users who already installed the skill can run `shitaku undo` or delete the installed skill directory. No agent or profile depends on the skill.

## Dependencies

- Existing `skills-install` capability and catalog docs generators.
- No external dependency.

## Review Workload Forecast

Expected authored change ~100-150 lines: ~45-65-line SKILL.md, a few catalog.json lines, ~20-40 test lines; generated README and website pages excluded. Single PR, two commits. 400-line budget risk: Low. Decision needed before apply: No. Chained PRs recommended: No.

## Success Criteria

- [ ] Bundled-catalog test lists 7 skills including `test-writing` and passes (observed RED first)
- [ ] Content-contract test for `test-writing` passes via `expectSkillContract`
- [ ] `pnpm run build` then `node dist/main.js init --skills test-writing --scope project --dry-run` plans a `create` for the skill
- [ ] `docs:catalog:check` and the website catalog check pass
- [ ] SKILL.md has `name: test-writing`, Trigger-style one-line `description` (<=250 chars), no `disable-model-invocation`
- [ ] SKILL.md covers conventions first, level choice, boundary-only mocking, behavior naming and AAA, edge-case and regression checklists, and flakiness avoidance
- [ ] SKILL.md excludes refactoring safety nets, production code changes, commit messages and PR text
- [ ] No `src/` changes; `CHANGELOG.md` untouched
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` pass
