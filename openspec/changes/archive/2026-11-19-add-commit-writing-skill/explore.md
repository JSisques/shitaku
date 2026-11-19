# Exploration: add commit-writing skill (issue #276)

Full report: engram `sdd/add-commit-writing-skill/explore` (id 1778).

## Current state

- Skills live at `catalog/skills/<name>/SKILL.md` and are listed alphabetically in `catalog/catalog.json` under `items.skills` (7 today).
- `expectSkillContract` in `test/adapters/catalog/bundled-catalog.test.ts` enforces the format: 2-line frontmatter (`name`, single-quoted `description` starting with `Trigger:`, max 250 chars, no quotes or pipes) and the sections Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract. Forbidden text: `shitaku`, `Co-Authored-By`.
- Closest analogue: `openspec/changes/archive/2026-11-19-add-test-writing-skill` (one PR, two commits, strict TDD).
- Every existing skill already excludes commit messages, so there is no overlap. `catalog/rules/conventional-commits.md` is a 6-line rule; the skill goes deeper.

## Files to touch

Commit 1 (`feat(catalog): add commit-writing skill`): extend `bundled-catalog.test.ts` (both exact lists, count 7 -> 8, contract test) first (RED), then add `catalog/skills/commit-writing/SKILL.md` and the first `items.skills` entry in `catalog/catalog.json`, then `pnpm run format`.

Commit 2 (`docs: list commit-writing skill in README and website`): `pnpm run docs:catalog` and `pnpm run docs:website-catalog` (README row plus en/es website pages), then the two `:check` scripts.

## Recommendation

Single `SKILL.md` (no supporting files), about 110-150 authored lines, one PR, no chaining.

## Risks

- 250-char description limit; no quotes, apostrophes or pipes.
- Avoid the literal `Co-Authored-By` (say "co-author or AI attribution trailers").
- Prettier reformats the Decision Gates table and `catalog.json`.
- No agent, profile or CHANGELOG changes (the `commit-writer` agent is a separate issue).

## Open questions

1. Draft messages only, or also run `git commit`? Recommended: draft, commit only on explicit request.
2. Contract-test required tokens: `Conventional Commits`, `BREAKING CHANGE:`, `atomic`, `why`, `Not for pull request`.
3. Confirm one PR with two commits.
