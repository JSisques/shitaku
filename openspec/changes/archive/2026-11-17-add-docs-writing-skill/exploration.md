# Exploration: add-docs-writing-skill

Source: GitHub issue #125 (`feat(catalog): add docs-writing skill`). Engram: `sdd/add-docs-writing-skill/explore`.

## Findings

- Catalog-only change mirroring the archived `add-pr-writing-skill`. No `src/` changes.
- No existing docs-writing content. Bundled skills today: `example-skill`, `pr-writing`, `socratic-method`.

### Surfaces to touch

1. `catalog/skills/docs-writing/SKILL.md` (new).
2. `catalog/catalog.json`: `items.skills` becomes `["docs-writing","example-skill","pr-writing","socratic-method"]`.
3. `test/adapters/catalog/bundled-catalog.test.ts`: skill list, directory entries and count (3 to 4); add a `docs-writing` entry (`files: ['SKILL.md']`) and a content-contract test modeled on the pr-writing one.
4. Generated docs, in order: `pnpm run docs:catalog`, then `pnpm run docs:website-catalog`; verify with the matching `:check` scripts.
5. OpenSpec: new `docs-writing-skill` spec.

### Format conventions (pr-writing template)

- Frontmatter: `name` and a single-quoted, single-line `description` starting with `Trigger:`, at most 250 characters, no quotes or pipes. No `disable-model-invocation`.
- Sections: Activation Contract, Hard Rules, Decision Gates (table), Execution Steps, Output Contract. About 45-65 lines. English, generic.
- The pr-writing guard forbids the word "topic" and "Co-Authored-By"; keep the same restraint.

### Content outline

README structure; CHANGELOG conventions (Keep a Changelog, Conventional Commits, never hand-edit release-generated sections); code comments and JSDoc/TSDoc (why, not what); keeping docs in sync with code; tone and style.

### Scope boundaries

Exclude PR titles and bodies (pr-writing), commit messages, and agent behavior (#126).

## Approaches

| Approach                                              | Pros                                       | Cons                                             | Effort                             |
| ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ | ---------------------------------- |
| A. Single SKILL.md mirroring pr-writing (recommended) | Proven precedent, passes loader and guards | Tight wording needed to stay compact             | Low (about 130-200 authored lines) |
| B. SKILL.md plus `references/`                        | Room for detail                            | New `files` expectations, departs from precedent | Medium                             |

## Recommendation

Approach A, strict TDD, one PR with two commits: `feat(catalog): add docs-writing skill`, then `docs: list docs-writing skill in README and website`. Acceptance: `pnpm run build` and `node dist/main.js init --skills docs-writing --scope project --dry-run` plans a `create`.

## Risks

- pr-writing declares changelogs out of scope; define the boundary with docs-writing.
- Whether #15 is done is unverified.
- The 250-character description limit is tight for five areas.
- Content guard must assert only a few load-bearing tokens to avoid brittleness.
