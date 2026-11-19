# Exploration: add test-writing skill (issue #268)

## Current State

Bundled skills live in `catalog/skills/<name>/SKILL.md` and are listed alphabetically in `catalog/catalog.json` `items.skills`. The newest skills (docs-writing, refactoring) follow a strict shape enforced by `expectSkillContract` in `test/adapters/catalog/bundled-catalog.test.ts`:

- Frontmatter has exactly 2 lines: `name: <dir>` and `description: 'Trigger: ...'` (single-quoted, 250 characters or fewer, no `'`, `"` or `|`, no `disable-model-invocation`).
- Body contains `## Activation Contract`, `## Hard Rules`, `## Decision Gates` (table), `## Execution Steps` (numbered) and `## Output Contract`.
- Forbidden content: `/shitaku/i` and `Co-Authored-By`. The Activation Contract ends with a "Not for ..." sentence.
- Loader accepts only single-line frontmatter values and 1 MiB per file.

Generated docs: README skills table (`pnpm run docs:catalog`, CI runs `docs:catalog:check`) and website pages `website/src/content/docs/{en,es}/catalog/skills/<name>.md` (`pnpm run docs:website-catalog`). The CHANGELOG is release-generated.

## Affected Areas

- `catalog/skills/test-writing/SKILL.md` (new, only file in the directory).
- `catalog/catalog.json`: add `"test-writing"` after `socratic-method`; run `pnpm run format` (array becomes multi-line).
- `test/adapters/catalog/bundled-catalog.test.ts`: extend both exact skill lists, count 6 -> 7, add `byName['test-writing']` block and a content-contract test.
- Generated: README row, website en/es pages.
- Not affected: profiles, other tests, CHANGELOG, CONTRIBUTING.

## Approaches

1. Mirror refactoring/docs-writing: single SKILL.md under the strict contract. Effort low. (Recommended)
2. SKILL.md plus supporting files: breaks the single-file convention (`files` equals `['SKILL.md']`), adds install surface. Effort medium.

## Recommendation

Approach 1. Content (generic, runner-agnostic): test pyramid and level choice; mock only at boundaries; naming and structure (Arrange-Act-Assert); edge-case checklist; regression checklist; flakiness avoidance. Boundary with refactoring: refactoring owns characterization tests during a refactor; test-writing owns authoring tests generally; the repo's runner and conventions win.

Suggested description (verify <= 250 chars): `Trigger: write tests, add unit tests, add test coverage, regression test, flaky test, what to mock. Write reliable tests: pick the right pyramid level, mock only boundaries, behavior-named cases, edge-case and regression checklists, no flakiness.`

Strict TDD order: RED (test changes) -> GREEN (SKILL.md + catalog.json) -> format, docs:catalog, docs:website-catalog, checks, lint, typecheck, tests -> dry-run `init --skills test-writing`.

## Risks

- 250-char limit and forbidden quote/pipe characters in the description.
- Prettier reformatting of catalog.json and the Decision Gates table.
- Any mention of the project name fails the guard.
- Generated docs must not be hand-edited.
- Scope creep: no `test-writer` agent, profile entry or CHANGELOG edit.

## Ready for Proposal

Yes.
