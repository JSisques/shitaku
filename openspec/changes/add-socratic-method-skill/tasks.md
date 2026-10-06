# Tasks: Add socratic-method Catalog Skill

## Review Workload Forecast

| Field                   | Value                                            |
| ----------------------- | ------------------------------------------------ |
| Estimated changed lines | 150–280                                          |
| 400-line budget risk    | Low                                              |
| Chained PRs recommended | No                                               |
| Suggested split         | Single PR (split only if docs regen bloats >400) |
| Delivery strategy       | auto-chain                                       |
| Chain strategy          | stacked-to-main                                  |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                         | Likely PR | Focused test command                                             | Runtime harness                                                                                      | Rollback boundary                                                                                                             |
| ---- | ---------------------------- | --------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | Catalog skill + guard + docs | PR 1      | `pnpm run test -- test/adapters/catalog/bundled-catalog.test.ts` | `node dist/main.js init --skills socratic-method --scope project --dry-run` (after `pnpm run build`) | Revert `catalog/skills/socratic-method/`, `catalog/catalog.json`, `test/adapters/catalog/bundled-catalog.test.ts`, regen docs |

## Phase 1: RED — Bundled catalog guard (strict TDD)

- [x] 1.1 In `test/adapters/catalog/bundled-catalog.test.ts`, expect skills length 2 and both `example-skill` + `socratic-method` load with frontmatter/`SKILL.md`; run `pnpm run test -- test/adapters/catalog/bundled-catalog.test.ts` → RED

## Phase 2: GREEN — Skill + registration

- [x] 2.1 Create `catalog/skills/socratic-method/SKILL.md`: `name: socratic-method`, trigger-rich one-line `description` (≤250), skill-creator sections, fixed coaching Socratic body; omit `disable-model-invocation`; no `${VAR}`/tone variants
- [x] 2.2 Update `catalog/catalog.json` `items.skills` to `["example-skill", "socratic-method"]`
- [x] 2.3 Re-run `pnpm run test -- test/adapters/catalog/bundled-catalog.test.ts` → GREEN

## Phase 3: Docs sync

- [x] 3.1 Run `pnpm run docs:catalog` (updates `README.md`)
- [x] 3.2 Run `pnpm run docs:website-catalog` (creates `website/src/content/docs/{en,es}/catalog/skills/socratic-method.md`)
- [x] 3.3 Verify `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`

## Phase 4: Acceptance verification

- [x] 4.1 After `pnpm run build`, run `node dist/main.js init --skills socratic-method --scope project --dry-run` → plan `create`, no writes
- [x] 4.2 Inspect `catalog/skills/socratic-method/SKILL.md`: coaching tone; no `disable-model-invocation: true`; no tone templating
- [x] 4.3 Confirm authored diff leaves `src/` unchanged for tone/templating
- [x] 4.4 Run `pnpm run test` (full suite)
