# Tasks: Add commit-writing Catalog Skill

Strict TDD (`pnpm test`). Spec: `specs/commit-writing-skill/spec.md`. Design: `design.md`.

## Review Workload Forecast

| Field                   | Value                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| Estimated changed lines | ~110-150 (SKILL.md ~60-70, catalog.json ~2, test ~25-35; docs generated) |
| 400-line budget risk    | Low                                                                      |
| Chained PRs recommended | No                                                                       |
| Suggested split         | Single PR, two commits                                                   |
| Delivery strategy       | auto-chain                                                               |
| Chain strategy          | pending                                                                  |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Generated lines (excluded): README row + 2 website pages. Push only after commit 2, because `docs:catalog:check` runs in CI, not in hooks.

### Suggested Work Units

| Unit | Goal                                   | Likely PR | Focused test command                                      | Runtime harness                                                            | Rollback boundary                              |
| ---- | -------------------------------------- | --------- | --------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| 1    | Skill, catalog entry and contract test | PR 1      | `pnpm test test/adapters/catalog/bundled-catalog.test.ts` | `node dist/main.js init --skills commit-writing --scope project --dry-run` | Revert commit 1 (SKILL.md, catalog.json, test) |
| 2    | Regenerated README and website pages   | PR 1      | `pnpm run docs:catalog:check`                             | `pnpm run docs:website-catalog:check`                                      | Revert commit 2 (generated docs only)          |

## Commit 1: `feat(catalog): add commit-writing skill`

### Phase 1: RED (test edits only)

- [x] 1.1 In `test/adapters/catalog/bundled-catalog.test.ts`, rename the registration test to `ships commit-writing, docs-writing, example-skill, pr-writing, product-owner, refactoring, socratic-method and test-writing as registered loadable bundled skills` (Req: Bundled registration)
- [x] 1.2 Prepend `'commit-writing'` to both exact lists (`index.items.skills` and sorted `readdirSync` entries) (Req: Bundled registration)
- [x] 1.3 Change `expect(catalog.skills).toHaveLength(7)` to `8` (Req: Bundled registration)
- [x] 1.4 Before the `docs-writing` `byName` block add the `byName['commit-writing']` assertions: `toMatchObject({ name })`, description length > 0, `files` equal `['SKILL.md']` (Req: Bundled registration)
- [x] 1.5 After `keeps the test-writing skill content contract` add `keeps the commit-writing skill content contract` using `expectSkillContract('commit-writing', ...)` with the 8 required tokens (`Repository conventions first`, `Conventional Commits`, `why`, `BREAKING CHANGE:`, `atomic`, `only on explicit request`, `attribution trailers`, `Not for pull request`) and forbidden `/shitaku/i`, `'Co-Authored-By'` (Req: Content contract guard)
- [x] 1.6 Run `pnpm test`; observe and record RED (list/count failures and ENOENT on missing SKILL.md) (Req: Content contract guard, scenario "Guard fails before the skill exists")

### Phase 2: GREEN (skill + catalog)

- [x] 2.1 Create `catalog/skills/commit-writing/SKILL.md` from the design outline: two-key frontmatter, 225-char single-quoted `Trigger:` description, five sections in order, Decision Gates Condition | Action table, numbered Execution Steps, Activation Contract ending with `Not for pull request titles or descriptions, changelogs or release notes, or writing or changing code or tests.`, ~60-70 lines. Attribution rule worded `Never add co-author or AI attribution trailers.` No `shitaku`, no `Co-Authored-By`, no `disable-model-invocation` (Reqs: frontmatter, generic, sections, draft-only, conventions first, Conventional Commits, why body, breaking changes, atomic splits, no attribution, scope)
- [x] 2.2 Insert `"commit-writing"` before `"docs-writing"` in `catalog/catalog.json` `items.skills` (Req: Bundled registration)
- [x] 2.3 Run `pnpm run format` (aligns the SKILL.md table)
- [x] 2.4 Run `pnpm test`; observe GREEN, including the 250-char description check (Req: Content contract guard, scenario "Guard passes after the skill is added")
- [x] 2.5 Run `pnpm run typecheck && pnpm run lint && pnpm run format:check`
- [x] 2.6 Confirm `git diff --stat` shows no `src/`, `CHANGELOG.md`, or existing skill/rule/agent/profile change (Req: Scope limited, Catalog-only surface)
- [x] 2.7 Commit: `feat(catalog): add commit-writing skill` (SKILL.md, catalog.json, test). Never use `--no-verify` (commit 8ee76e0)

## Commit 2: `docs: list commit-writing skill in README and website`

### Phase 3: Generated docs

- [x] 3.1 Run `pnpm run docs:catalog` (README skills table), then `pnpm run docs:website-catalog` (en and es pages). Do not hand-edit (Req: Catalog-only surface)
- [x] 3.2 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both must pass
- [x] 3.3 Run `pnpm run format:check`; if generated files need formatting, run `pnpm run format` and re-run the generators' checks
- [x] 3.4 Confirm the diff contains only `README.md` and `website/src/content/docs/{en,es}/catalog/skills/commit-writing.md`
- [x] 3.5 Commit: `docs: list commit-writing skill in README and website` (commit 8d67f7d)

## Phase 4: Final verification (no commit)

- [x] 4.1 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`
- [x] 4.2 Run `pnpm run build`, then `node dist/main.js init --skills commit-writing --scope project --dry-run`; expect `commit-writing` classified `create` and no files, backups, or manifest written (Req: Installable create when absent)
- [x] 4.3 Confirm `git status` is clean of stray files from the dry-run and `dist/` is not committed

## Parallelism

Strictly sequential: RED must precede GREEN (strict TDD), and generators need the registered skill. No parallel tasks.
