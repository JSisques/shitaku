# Exploration: devops skill (issue #272)

Engram: `sdd/add-devops-skill/explore` (id 1796).

## Summary

Catalog-only change modeled on the archived `api-design-skill` change. Add one dense `catalog/skills/devops/SKILL.md`, one `catalog.json` entry and an extension of the bundled-catalog test. Regenerate README and website docs in a second commit. Strict TDD (RED first). No `src/` changes.

## Current state

- Skills live in `catalog/skills/<name>/SKILL.md`, listed alphabetically in `catalog/catalog.json` `items.skills` (9 today: `api-design`, `commit-writing`, `docs-writing`, `example-skill`, `pr-writing`, `product-owner`, `refactoring`, `socratic-method`, `test-writing`).
- `expectSkillContract` in `test/adapters/catalog/bundled-catalog.test.ts` enforces: exactly 2-line frontmatter (`name`, single-quoted `description: 'Trigger: ...'` of at most 250 chars, no `'`, `"` or `|` inside), no `disable-model-invocation`, and the sections `## Activation Contract`, `## Hard Rules`, `## Decision Gates` (table), `## Execution Steps`, `## Output Contract`. Forbidden text: `/shitaku/i`, `Co-Authored-By`.
- Avoid a bare `---` line in the SKILL.md body if the test splits frontmatter on raw `---`.
- `CHANGELOG.md` is release-generated: do not edit.

## Affected areas

Commit 1, `feat(catalog): add devops skill`:

- `test/adapters/catalog/bundled-catalog.test.ts` (RED first): rename the registration test title, update both exact name lists, `toHaveLength(9)` -> `toHaveLength(10)`, add a `byName['devops']` block and a new `expectSkillContract` test.
- `catalog/skills/devops/SKILL.md` (new).
- `catalog/catalog.json`: insert `"devops"` after `"commit-writing"` and before `"docs-writing"`.

Commit 2, `docs: list devops skill in README and website` (generated only): `README.md`, `website/src/content/docs/{en,es}/catalog/skills/devops.md` via `pnpm run docs:catalog` and `pnpm run docs:website-catalog`; verify with the `:check` variants.

## Scope from the issue

- In: Dockerfile best practices (layer caching, multi-stage builds, pinned base images, non-root user, `.dockerignore`, no secrets in layers), CI/CD pipelines (structure, caching, matrix builds, secrets handling, least privilege), deployment safety (health checks, rollbacks, environment parity).
- Out: Kubernetes, Terraform and cloud-provider-specific guidance.
- The skill must stay generic, tool-agnostic and standalone.

## Recommendation

Single dense SKILL.md mirroring api-design, one PR, two commits, no chaining. Forecast well under 400 authored lines (budget risk: Low).
