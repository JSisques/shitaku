# Exploration: api-design skill (issue #266)

Engram: `sdd/api-design-skill/explore` (id 1787).

## Summary

Catalog-only change. Add one dense `catalog/skills/api-design/SKILL.md` (about 100-140 lines, one inline OpenAPI YAML fence), one `catalog.json` entry and an extension of the bundled-catalog test. Regenerate README and website docs in a second commit. Strict TDD (RED first).

## Current state

- Skills live in `catalog/skills/<name>/SKILL.md`, listed alphabetically in `catalog/catalog.json` `items.skills` (8 today).
- `expectSkillContract` in `test/adapters/catalog/bundled-catalog.test.ts` enforces: 2-line frontmatter (`name`, single-quoted `description: 'Trigger:...'` of at most 250 chars, no `'`, `"` or `|`), no `disable-model-invocation`, and the sections `## Activation Contract`, `## Hard Rules`, `## Decision Gates`, `## Execution Steps`, `## Output Contract`. Forbidden text: `/shitaku/i`, `Co-Authored-By`.
- Sibling skills are 45-70 lines, single SKILL.md, no code fences.
- `CHANGELOG.md` is release-generated: do not edit.

## Affected areas

Commit 1, `feat(catalog): add api-design skill`:

- `test/adapters/catalog/bundled-catalog.test.ts` (RED first): update both exact name lists, `toHaveLength(9)`, add `byName['api-design']` and a contract test.
- `catalog/skills/api-design/SKILL.md` (new).
- `catalog/catalog.json`: insert `"api-design"` before `"commit-writing"`.

Commit 2, `docs: list api-design skill in README and website` (generated only): `README.md`, `website/src/content/docs/{en,es}/catalog/skills/api-design.md` via `pnpm run docs:catalog` and `pnpm run docs:website-catalog`; verify with the `:check` variants.

## Approaches

1. Single dense SKILL.md with inline OpenAPI YAML example (recommended).
2. SKILL.md plus supporting files (breaks `files == ['SKILL.md']` precedent).
3. Split into two skills (contradicts the issue).

## Recommendation

Approach 1, one PR, two commits, no chaining. Forecast about 160 authored lines (400-line budget risk: Low).

Proposed required tokens: `Repository conventions first`, `OpenAPI`, `Idempotency-Key`, `application/problem+json`, `cursor`, `backward-compatible`, `breaking change`, `Not for`.

## Risks

- First code fence in a catalog skill: verify Prettier and the website generator (`--check`).
- 250-char description limit.
- Skill about 2x sibling length: keep rules one-line.
- README table re-padding: accept generated output.
- Scope overlap with `api-designer` agent, `product-owner`, `docs-writing`: state exclusions in "Not for".
- RFC references (9457, 8594, 9745) must be verified in the design phase.

## Open questions

1. Versioning default: URI major `/v1` (recommended) or neutral.
2. Include the OpenAPI YAML fence (recommended) or prose only.
3. One PR with two commits (recommended).
