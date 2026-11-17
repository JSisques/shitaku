# Tasks: Add pr-writing Catalog Skill

## Review Workload Forecast

| Field                   | Value                                      |
| ----------------------- | ------------------------------------------ |
| Estimated changed lines | 130–200 authored (generated docs excluded) |
| 400-line budget risk    | Low                                        |
| Chained PRs recommended | No                                         |
| Suggested split         | Single PR, two commits (feat then docs)    |
| Delivery strategy       | ask-on-risk                                |
| Chain strategy          | pending                                    |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Note: `ask-on-risk` only asks when the budget is at risk; the forecast is Low, so no decision is needed. Generated docs (README row, two website pages) add roughly 40–60 lines and are excluded from authored count.

### Suggested Work Units

| Unit | Goal                                    | Likely PR | Focused test command                                                 | Runtime harness                                                                                 | Rollback boundary                                                                                            |
| ---- | --------------------------------------- | --------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1    | Skill + registration + content guard    | PR 1      | `pnpm run test -- test/adapters/catalog/bundled-catalog.test.ts`     | `node dist/main.js init --skills pr-writing --scope project --dry-run` (after `pnpm run build`) | Revert `catalog/skills/pr-writing/`, `catalog/catalog.json`, `test/adapters/catalog/bundled-catalog.test.ts` |
| 2    | Regenerated README and website listings | PR 1      | `pnpm run docs:catalog:check && pnpm run docs:website-catalog:check` | N/A: generated docs only, covered by the check scripts                                          | Revert `README.md` and `website/src/content/docs/{en,es}/catalog/skills/pr-writing.md`                       |

## Phase 1: RED (strict TDD)

- [x] 1.1 In `test/adapters/catalog/bundled-catalog.test.ts`, update the existing skills test (rename to cover three skills): `items.skills` equals `['example-skill', 'pr-writing', 'socratic-method']`, skills dir entries equal the same, `catalog.skills` length 3, `pr-writing` loads with `files` `['SKILL.md']` and no issues. Spec: Bundled registration and valid frontmatter (Bundled load succeeds); Installable create when absent.
- [x] 1.2 In the same file, add one `it` reading `catalog/skills/pr-writing/SKILL.md` raw via `readFileSync`: frontmatter has exactly `name: pr-writing` and a single-line `description:` starting `'Trigger:`; unquoted description length <= 250 with no apostrophe, double quote or `|`; no `disable-model-invocation`; contains headings Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract; contains `BREAKING CHANGE:`, `Closes #`, `CODEOWNERS`, `gh label list`; contains no `topic` (case-insensitive) and no `Co-Authored-By`. Spec: Bundled registration and valid frontmatter; Conventional Commits title; Concise structured body; Metadata discovered, never invented; Draft only, scope limited (Out-of-scope content absent); Generic and model-invocable.
- [x] 1.3 Run `pnpm test` and record the failures as RED evidence (missing skill and catalog entry). Do not proceed until observed failing.

## Phase 2: GREEN

- [x] 2.1 Create `catalog/skills/pr-writing/SKILL.md` (about 45–65 lines) per design: frontmatter with single-quoted single-line `description` (about 190 chars, starts `Trigger:`, no `disable-model-invocation`); sections Activation Contract, Hard Rules, Decision Gates (table per design), Execution Steps (7 steps), Output Contract. Must cover: Conventional Commits title with `!` plus `BREAKING CHANGE:` footer; concise Summary/Changes/How to test body with `Closes #<n>` only when known; follow existing PR template; discover labels (`gh label list`), reviewers (`CODEOWNERS`, git history by name), milestone; never invent; cite source per suggestion; present as suggestions; no PR creation without explicit confirmation; no shitaku-specific names; no topics or commit-message authoring. Spec: all requirements.
- [x] 2.2 Update `catalog/catalog.json` `items.skills` to `["example-skill", "pr-writing", "socratic-method"]` (alphabetical). Spec: Bundled registration and valid frontmatter.
- [x] 2.3 Run `pnpm run test -- test/adapters/catalog/bundled-catalog.test.ts` then `pnpm test`; confirm GREEN.

## Phase 3: Refactor and quality gate

- [x] 3.1 Run `pnpm run format` on touched files, then `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm test`; all pass. Spec: Catalog-only surface (no `src/` change).
- [x] 3.2 Confirm `git diff --stat` shows no `src/` changes, then commit test, skill and index: `feat(catalog): add pr-writing skill` (Conventional Commits; no Co-Authored-By or AI attribution; no `--no-verify`).

## Phase 4: Docs sync

- [x] 4.1 Run `pnpm run docs:catalog` (updates `README.md` skills table). Spec: Catalog-only surface with synced docs.
- [x] 4.2 Run `pnpm run docs:website-catalog` (creates `website/src/content/docs/en/catalog/skills/pr-writing.md` and `website/src/content/docs/es/catalog/skills/pr-writing.md`).
- [x] 4.3 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both pass. Run `pnpm run format:check`.
- [x] 4.4 Commit generated docs: `docs: list pr-writing skill in README and website` (no Co-Authored-By or AI attribution).

## Phase 5: Acceptance verification

- [x] 5.1 Run `pnpm run build`, then `node dist/main.js init --skills pr-writing --scope project --dry-run` in a clean temp project; plan classifies `pr-writing` as `create` and no file, backup or manifest is written. Spec: Installable create when absent (Dry-run create when absent).
- [x] 5.2 Inspect `catalog/skills/pr-writing/SKILL.md`: no `disable-model-invocation: true`, no repo-specific label/reviewer/milestone names, no topics or commit-message authoring. Spec: Generic and model-invocable; Draft only.
- [x] 5.3 Note for PR time (non-blocking): update issue #236 acceptance criteria that still mention topics.
