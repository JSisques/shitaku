# Exploration: add-product-owner-skill (issue #17)

Engram: `sdd/add-product-owner-skill/explore` (obs 1636).

## Current State

- Skills are folder items: `catalog/skills/<name>/SKILL.md`, listed in `catalog/catalog.json` under `items.skills`. Unlisted items are skipped with a warning by `src/adapters/catalog/folder-source.ts`.
- Install already works: `init --skills <name>`.
- Frontmatter is single-line `key: value`: `name` and `description: 'Trigger: ...'` (single-quoted, 250 characters or fewer, no quotes or pipes).
- Body uses five `##` sections: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract.
- Skills stay generic: no "shitaku" mention. No tech-lead skill exists, so the collaboration line is a generic handoff.
- Profiles `base`, `web` and `backend` contain only `mcps`. The schema supports `skills`. The CLI has no `--profile` flag, so profiles are browse-only.

## Affected Areas

- `catalog/skills/product-owner/SKILL.md` (new)
- `catalog/catalog.json` (`items.skills`, plus `items.profiles` if a new profile is added)
- `catalog/profiles/*.json` (depends on the profile decision)
- `test/adapters/catalog/bundled-catalog.test.ts` (skills list, length, content contract, profile resolve)
- `README.md` and `website/src/content/docs/{en,es}/catalog/...`, regenerated with `pnpm run docs:catalog` and `pnpm run docs:website-catalog`

## Approaches

1. New `product` profile with `skills: [product-owner]` (recommended). Existing profile tests are untouched.
2. Add to `base`. Changes web and backend expectations; the skill is not essential.
3. Skill only, no profile. Misses the issue's profile criterion.

## Risks

- Open decision: which profile gets the skill.
- Description constraints are easy to violate.
- Skipping the docs generators fails CI.
- Profiles are not installable, so do not promise install via profile.
