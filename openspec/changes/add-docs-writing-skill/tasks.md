# Tasks: Add docs-writing Catalog Skill

## Review Workload Forecast

| Field                   | Value                                     |
| ----------------------- | ----------------------------------------- |
| Estimated changed lines | 90–130 authored (generated docs excluded) |
| 400-line budget risk    | Low                                       |
| Chained PRs recommended | No                                        |
| Suggested split         | Single PR, two commits (feat then docs)   |
| Delivery strategy       | ask-on-risk                               |
| Chain strategy          | pending                                   |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Note: `ask-on-risk` only asks when the budget is at risk; the forecast is Low (SKILL.md about 50–65 lines, catalog.json 1 line, test about 35 lines), so no decision is needed. Generated docs (README row, two website pages) add roughly 40–60 lines and are excluded from the authored count.

### Resolved consistency decision: "no shitaku-specific names"

The spec says "no shitaku-specific file, tool, or convention names are hardcoded"; the design asserts the file does not contain `shitaku`. They are consistent: the testable form is ONE rule, applied everywhere: the raw SKILL.md MUST NOT contain the string `shitaku` case-insensitively (`/shitaku/i`). The spec's broader wording stays as the intent (generic, no repo-specific names) and the case-insensitive `shitaku` absence is its automated proxy. No spec amendment is needed. Tasks 1.2, 2.1 and 5.2 all use this same form.

### Suggested Work Units

| Unit | Goal                                    | Likely PR | Focused test command                                                 | Runtime harness                                                                                   | Rollback boundary                                                                                              |
| ---- | --------------------------------------- | --------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1    | Skill + registration + content guard    | PR 1      | `pnpm run test -- test/adapters/catalog/bundled-catalog.test.ts`     | `node dist/main.js init --skills docs-writing --scope project --dry-run` (after `pnpm run build`) | Revert `catalog/skills/docs-writing/`, `catalog/catalog.json`, `test/adapters/catalog/bundled-catalog.test.ts` |
| 2    | Regenerated README and website listings | PR 1      | `pnpm run docs:catalog:check && pnpm run docs:website-catalog:check` | N/A: generated docs only, covered by the check scripts                                            | Revert `README.md` and `website/src/content/docs/{en,es}/catalog/skills/docs-writing.md`                       |

## Phase 1: RED (strict TDD)

- [ ] 1.1 In `test/adapters/catalog/bundled-catalog.test.ts`, update the existing skills test (rename title to cover four skills): `items.skills` equals `['docs-writing', 'example-skill', 'pr-writing', 'socratic-method']`, sorted skills dir entries equal the same, `catalog.skills` length 4, `docs-writing` loads with a non-empty description and `files` `['SKILL.md']`, `catalog.issues` empty. Spec: Bundled registration and valid frontmatter (Bundled load succeeds); Installable create when absent.
- [ ] 1.2 In the same file, add `it('keeps the docs-writing skill content contract')` after the pr-writing one, reading `catalog/skills/docs-writing/SKILL.md` raw via `readFileSync` (copy the frontmatter-splitting pattern inline; do not modify the pr-writing test). Assert: frontmatter is exactly two lines, `name: docs-writing` and a single-line `description: 'Trigger:...'`; unquoted description length <= 250 with no apostrophe, double quote or `|`; no `disable-model-invocation`; body has headings Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract; raw contains `Keep a Changelog`, `JSDoc`, `not what`, `Not for pull request`; raw does not match `/shitaku/i` and does not contain `Co-Authored-By`. Spec: Bundled registration and valid frontmatter; Scope limited to documentation (Out-of-scope content absent); Generic and model-invocable.
- [ ] 1.3 Run `pnpm test` and record the failures as RED evidence (list mismatch, `ENOENT` on the raw read). Do not proceed until observed failing.

## Phase 2: GREEN

- [ ] 2.1 Create `catalog/skills/docs-writing/SKILL.md` (about 45–65 lines) per design outline: frontmatter with exactly `name: docs-writing` and single-quoted single-line `description` (about 224 chars, starts `Trigger:`, no apostrophe, double quote or `|`; avoid "repo's"), no `disable-model-invocation`, no other keys. Sections: Activation Contract (includes "Not for pull request titles or descriptions, commit messages, or agent instruction files."), Hard Rules, Decision Gates (7-row table per design), Execution Steps (7 steps), Output Contract. Must cover: README purpose first then install, usage, configuration, contributing/license links and follow existing structure; CHANGELOG Keep a Changelog with Conventional Commits mapping, never hand-edit release-tool-generated sections, change commit messages instead; comments explain why, not what, JSDoc/TSDoc params/returns/throws, no commented-out code or stale TODOs; docs updated in the same change, run docs generators and check scripts, never hand-edit generated output; concise neutral second person or imperative, follow existing style guide, template and language. Must not contain `shitaku` in any casing (`/shitaku/i`), repo-specific labels or paths, or `Co-Authored-By`. Spec: all requirements.
- [ ] 2.2 Update `catalog/catalog.json` `items.skills` to `["docs-writing", "example-skill", "pr-writing", "socratic-method"]` (alphabetical). Spec: Bundled registration and valid frontmatter.
- [ ] 2.3 Run `pnpm run test -- test/adapters/catalog/bundled-catalog.test.ts` then `pnpm test`; confirm GREEN.

## Phase 3: Refactor and quality gate

- [ ] 3.1 Run `pnpm run format` on touched files, then `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm test`; all pass. Spec: Catalog-only surface (no `src/` change).
- [ ] 3.2 Confirm `git diff --stat` shows no `src/` changes and no change to `catalog/skills/pr-writing/SKILL.md`, then commit test, skill and index: `feat(catalog): add docs-writing skill` (Conventional Commits; no Co-Authored-By or AI attribution; no `--no-verify`). Spec: pr-writing unchanged; No src changes.

## Phase 4: Docs sync

- [ ] 4.1 Run `pnpm run docs:catalog` (updates `README.md` skills table). Spec: Generated docs in sync.
- [ ] 4.2 Run `pnpm run docs:website-catalog` (creates `website/src/content/docs/en/catalog/skills/docs-writing.md` and `website/src/content/docs/es/catalog/skills/docs-writing.md`).
- [ ] 4.3 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both pass. Run `pnpm run format:check`.
- [ ] 4.4 Commit generated docs: `docs: list docs-writing skill in README and website` (no Co-Authored-By or AI attribution; no `--no-verify`).

## Phase 5: Acceptance verification

- [ ] 5.1 Run `pnpm run build`, then `node dist/main.js init --skills docs-writing --scope project --dry-run` in a clean temp project; plan classifies `docs-writing` as `create` and no file, backup or manifest is written. Spec: Installable create when absent (Dry-run create when absent).
- [ ] 5.2 Inspect `catalog/skills/docs-writing/SKILL.md`: no `disable-model-invocation: true`, no match for `/shitaku/i`, no repo-specific label or path names, no PR title/description, commit-message or agent-instruction-file authoring guidance, no tool-generated release notes authoring. Spec: Generic and model-invocable; Scope limited to documentation.
- [ ] 5.3 Note for PR time (non-blocking): reference issue #125 in the PR body; AGENTS.md conventions remain tracked in #126.
