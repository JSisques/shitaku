# Exploration: add-refactoring-skill (issue #274)

Full version: Engram `sdd/add-refactoring-skill/explore` (observation 1750).

## Current State

- Catalog-only change; no `src/` changes.
- `items.skills` in `catalog/catalog.json`: docs-writing, example-skill, pr-writing, product-owner, socratic-method.
- Precedents: `add-docs-writing-skill` and `add-product-owner-skill` (one SKILL.md, a test edit plus a content-contract test, two commits, about 150-200 authored lines).

## Affected Areas

- `catalog/skills/refactoring/SKILL.md` (new, about 45-65 lines).
- `catalog/catalog.json`: add `refactoring` in alphabetical order.
- `test/adapters/catalog/bundled-catalog.test.ts`: update the coupled skill assertions (list, dir entries, count 5 to 6, per-skill files) and add a content-contract test via `expectSkillContract`.
- Generated, never hand-edited: README skills table (`pnpm run docs:catalog`) and website pages en/es (`pnpm run docs:website-catalog`); verify with the `:check` scripts.
- `CHANGELOG.md` is release-generated; do not edit.

## Format Rules

- Frontmatter: `name: refactoring` and a single-line `description: 'Trigger: ...'` of at most 250 characters, with no `'`, `"` or `|` inside.
- Headings: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract.
- English, imperative, generic (no repository-specific names), no `shitaku`, no `Co-Authored-By`, model-invocable.

## Approaches

- A (recommended): single SKILL.md mirroring precedent. Low effort.
- B: SKILL.md plus `references/`. Departs from precedent and changes the `files` assertion. Medium effort.

## Recommendation

Approach A with strict TDD (RED test update, GREEN skill and registration, gate, commit `feat(catalog): add refactoring skill`, regenerate docs, commit docs). Forecast about 150-200 lines, single PR, Low budget risk. The `refactorer` agent stays a follow-up.
