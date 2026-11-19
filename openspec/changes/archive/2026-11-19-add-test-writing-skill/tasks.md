# Tasks: Add test-writing Catalog Skill

Strict TDD (`pnpm test`). Spec: `specs/test-writing-skill/spec.md`. Design: `design.md`.

## Review Workload Forecast

| Item                         | Estimate                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| Authored changed lines       | ~110-150 (SKILL.md ~55-65, catalog.json ~10 after Prettier, test ~25-35) |
| Generated lines (excluded)   | README row + 2 website pages                                             |
| 400-line budget risk         | Low                                                                      |
| Chained PRs recommended      | No (single PR, two commits)                                              |
| Decision needed before apply | No                                                                       |

Delivery: ask-on-risk; no risk triggered. Push only after commit 2, because `docs:catalog:check` runs in CI, not in hooks.

## Commit 1: `feat(catalog): add test-writing skill`

### Phase 1: RED (test edits only)

- [x] 1.1 In `test/adapters/catalog/bundled-catalog.test.ts`, rename the registration test to `ships docs-writing, example-skill, pr-writing, product-owner, refactoring, socratic-method and test-writing as registered loadable bundled skills` (Req: Bundled registration)
- [x] 1.2 Append `'test-writing'` to both exact lists (`index.items.skills` and sorted `readdirSync` entries) (Req: Bundled registration)
- [x] 1.3 Change `expect(catalog.skills).toHaveLength(6)` to `7` (Req: Bundled registration)
- [x] 1.4 After the `socratic-method` block add the `byName['test-writing']` assertions: `toMatchObject({ name })`, description length > 0, `files` equal `['SKILL.md']` (Req: Bundled registration)
- [x] 1.5 After `keeps the refactoring skill content contract` add `keeps the test-writing skill content contract` using `expectSkillContract('test-writing', ...)` with the 8 required tokens and forbidden `/shitaku/i`, `'Co-Authored-By'`, `/\b(?:vitest|jest|pytest|mocha)\b/i` exactly as in design (Req: Content contract guard, Model-invocable and generic)
- [x] 1.6 Run `pnpm test`; observe and record RED (list/count failures and ENOENT on missing SKILL.md) (Req: Content contract guard, scenario "Guard fails before the skill exists")

### Phase 2: GREEN (skill + catalog)

- [x] 2.1 Create `catalog/skills/test-writing/SKILL.md` from the design outline: two-key frontmatter, 246-char single-quoted `Trigger:` description, five sections in order, Decision Gates Condition | Action table, numbered Execution Steps, Activation Contract ending with `Not for refactoring safety nets ...`, ~55-65 lines. No runner names, no `shitaku`, no `Co-Authored-By`, no `disable-model-invocation` (Reqs: frontmatter, generic, sections, conventions first, right level, boundaries, AAA, checklists, flakiness, scope)
- [x] 2.2 Append `"test-writing"` after `"socratic-method"` in `catalog/catalog.json` `items.skills` (Req: Bundled registration)
- [x] 2.3 Run `pnpm run format` (aligns the SKILL.md table, expands the catalog.json array)
- [x] 2.4 Run `pnpm test`; observe GREEN, including the 250-char description check (margin is 4 characters; rely on the contract test) (Req: Content contract guard, scenario "Guard passes after the skill is added")
- [x] 2.5 Run `pnpm run typecheck && pnpm run lint && pnpm run format:check`
- [x] 2.6 Confirm `git diff --stat` shows no `src/`, `CHANGELOG.md`, or existing skill/rule/agent/profile change (Req: Scope limited, Catalog-only surface)
- [x] 2.7 Commit: `feat(catalog): add test-writing skill` (SKILL.md, catalog.json, test). Never use `--no-verify`

## Commit 2: `docs: list test-writing skill in README and website`

### Phase 3: Generated docs

- [x] 3.1 Run `pnpm run docs:catalog` (README skills table), then `pnpm run docs:website-catalog` (en and es pages). Do not hand-edit (Req: Catalog-only surface)
- [x] 3.2 Run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both must pass
- [x] 3.3 Run `pnpm run format:check`; if generated files need formatting, run `pnpm run format` and re-run the generators' checks
- [x] 3.4 Confirm the diff contains only `README.md` and `website/src/content/docs/{en,es}/catalog/skills/test-writing.md`
- [x] 3.5 Commit: `docs: list test-writing skill in README and website`

## Phase 4: Final verification (no commit)

- [x] 4.1 Run `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`
- [x] 4.2 Run `pnpm run build`, then `node dist/main.js init --skills test-writing --scope project --dry-run`; expect `test-writing` classified `create` and no files, backups, or manifest written (Req: Installable create when absent)
- [x] 4.3 Confirm `git status` is clean of stray files from the dry-run and `dist/` is not committed

## Parallelism

Strictly sequential: RED must precede GREEN (strict TDD), and generators need the registered skill. No parallel tasks.
