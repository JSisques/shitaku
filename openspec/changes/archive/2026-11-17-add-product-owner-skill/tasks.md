# Tasks: Add product-owner Catalog Skill

## Review Workload Forecast

| Field                   | Value                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | ~150-200 authored (SKILL.md 50-65, catalog.json 1, tests incl. refactor 40-80); generated docs excluded |
| 400-line budget risk    | Low                                                                                                     |
| Chained PRs recommended | No                                                                                                      |
| Suggested split         | Single PR, two commits (feat then docs)                                                                 |
| Delivery strategy       | ask-on-risk                                                                                             |
| Chain strategy          | pending (not needed)                                                                                    |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                              | Likely PR | Focused test command                                                 | Runtime harness                                                                                                     | Rollback boundary                                            |
| ---- | ------------------------------------------------- | --------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1    | Skill, registration, tests (RED, GREEN, REFACTOR) | PR 1      | `pnpm test test/adapters/catalog/bundled-catalog.test.ts`            | `pnpm run build` then `node dist/main.js init --skills product-owner --scope project --dry-run` classifies `create` | Revert commit 1: SKILL.md, catalog.json entry, test edits    |
| 2    | Regenerated README and website en/es pages        | PR 1      | `pnpm run docs:catalog:check && pnpm run docs:website-catalog:check` | N/A: generated docs only                                                                                            | Revert commit 2 (or rerun generators after reverting unit 1) |

## Phase 1: RED (tests first, strict TDD)

- [x] 1.1 Edit the existing skills `it` in `test/adapters/catalog/bundled-catalog.test.ts`: expect `items.skills` and sorted skills dir entries equal `['docs-writing', 'example-skill', 'pr-writing', 'product-owner', 'socratic-method']`, `catalog.skills` length 5, `product-owner` loaded with non-empty description and `files: ['SKILL.md']`, `catalog.issues` empty; update the test title to list five skills. (Spec: Bundled registration, Bundled load succeeds)
- [x] 1.2 Add `it('keeps the product-owner skill content contract')` after the docs-writing test in `test/adapters/catalog/bundled-catalog.test.ts`, written inline in the existing pattern via `readFileSync` of `catalog/skills/product-owner/SKILL.md`: exactly two frontmatter lines, `name: product-owner`, `description: 'Trigger:...'`, unquoted length <= 250, no `'`, `"` or `|` inside, no `disable-model-invocation`, the five `## ` headings; raw contains `Given`, `When`, `Then`, `acceptance criteria`, `user stor`, `MoSCoW`, `MVP`, `success metric`, `roadmap`, `tech lead`, `Not for technical design`; raw lacks `Co-Authored-By` and `/shitaku/i`. (Spec: Standard structure, Vision/backlog, Given/When/Then, Prioritization, MVP, Roadmap, Tech-lead handoff, Generic and model-invocable)
- [x] 1.3 Run `pnpm test` and record the observed failures: skills test fails on the list mismatch, content test fails with `ENOENT`. Do not proceed until both are observed RED.

## Phase 2: GREEN (make tests pass)

- [x] 2.1 Create `catalog/skills/product-owner/SKILL.md` with frontmatter `name: product-owner` and the single-quoted `description: 'Trigger: ...'` from design (no apostrophes, double quotes or pipes; <= 250 chars; no other keys), plus five sections (Activation Contract with "Not for technical design...", Hard Rules, Decision Gates table with the 7 gate rows, Execution Steps 1-8, Output Contract) per design outline, 45-65 lines, generic English, no "shitaku", no cross-skill names. (Spec: all content requirements)
- [x] 2.2 Edit `catalog/catalog.json`: set `items.skills` to `["docs-writing", "example-skill", "pr-writing", "product-owner", "socratic-method"]`; leave `items.profiles` and `catalog/profiles/*.json` untouched. (Spec: Bundled registration, No profile membership)
- [x] 2.3 Run `pnpm test`; confirm all green, including untouched `web`/`backend` profile-resolution tests (`skills: []`). Record the test count for the REFACTOR comparison.

## Phase 3: REFACTOR (user-approved, keeps every assertion)

- [x] 3.1 In `test/adapters/catalog/bundled-catalog.test.ts`, extract a file-local `expectSkillContract(name, { required, forbidden })` helper asserting: two frontmatter lines, `name: <name>`, `description: 'Trigger:...'`, unquoted length <= 250, no `'`, `"` or `|`, no `disable-model-invocation`, five `## ` headings, each `required` token present, each `forbidden` string or pattern absent. No new file under `test/helpers/`.
- [x] 3.2 Rewrite the `pr-writing`, `docs-writing` and `product-owner` content-contract tests to call the helper, preserving per-skill token lists exactly (pr-writing forbids `/topic/i` and `Co-Authored-By`; docs-writing forbids `/shitaku/i` and `Co-Authored-By`; product-owner forbids `/shitaku/i` and `Co-Authored-By`) and any extra per-skill assertions that do not fit the helper.
- [x] 3.3 Run `pnpm test`; confirm green with the same test count as task 2.3.
- [x] 3.4 Run `pnpm run format:check` and `pnpm run lint`; fix touched files only (`pnpm run format` / `lint:fix` scoped to them).
- [x] 3.5 Commit 1: `feat(catalog): add product-owner skill` (test file, SKILL.md, catalog.json) via normal hooks (no `--no-verify`).

## Phase 4: Generators (never hand-edit output)

- [x] 4.1 Run `pnpm run docs:catalog` to regenerate the skills table in `README.md`.
- [x] 4.2 Run `pnpm run docs:website-catalog` to create `website/src/content/docs/en/catalog/skills/product-owner.md` and `website/src/content/docs/es/catalog/skills/product-owner.md`.
- [x] 4.3 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both must pass. (Spec: Generated docs in sync)
- [x] 4.4 Commit 2: `docs: list product-owner skill in README and website` (README.md, two website pages).

## Phase 5: Full checks

- [x] 5.1 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`; all pass.
- [x] 5.2 Confirm `git diff main --stat` shows no change under `src/` or `catalog/profiles/`. (Spec: No profile membership, No src changes)
- [x] 5.3 Run `pnpm run build` then `node dist/main.js init --skills product-owner --scope project --dry-run` in a scratch directory; confirm `product-owner` classified `create` and no files, backups or manifest written. (Spec: Dry-run create when absent)
- [ ] 5.4 At delivery, annotate issue #17 with the deliberate no-profile deviation (user-owned; push and PR remain user decisions).
