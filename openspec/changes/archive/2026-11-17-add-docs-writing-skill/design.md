# Design: Add docs-writing Catalog Skill

## Technical Approach

Catalog-only change (exploration Approach A, proposal "Approach"), mirroring the archived `2026-11-17-add-pr-writing-skill` design. One generic `catalog/skills/docs-writing/SKILL.md` in the same five-section layout as `pr-writing`, registered in `catalog/catalog.json`, guarded by `test/adapters/catalog/bundled-catalog.test.ts`, and surfaced through the two existing docs generators. No `src/` change: `FolderCatalogSource` loads the skill, `parseSkill` (`src/domain/catalog/skill.ts`) validates `name` against the directory and a non-empty `description`, and install is a byte-identical copy.

The skill is the product. At run time, in any repository, it tells the agent to inspect the repository first (README layout, CHANGELOG origin and release config, docs generators, style guides) and then write or update documentation across five areas: README, CHANGELOG, comments and JSDoc/TSDoc, docs sync, and tone.

## Architecture Decisions

### Decision: Single file, pr-writing section layout

**Choice**: One `SKILL.md` with sections Activation Contract, Hard Rules, Decision Gates (table), Execution Steps, Output Contract; target 45-65 lines.
**Alternatives considered**: `SKILL.md` plus `references/` (exploration Approach B); free-form prose.
**Rationale**: Two catalog precedents (`pr-writing`, `socratic-method`) use this shape; install stays one file (`files: ['SKILL.md']`); the review surface stays small. A `references/` folder changes `files` expectations and departs from precedent for no proven need.

### Decision: Frontmatter is two single-line scalars, single-quoted description

**Choice**:

```yaml
---
name: docs-writing
description: 'Trigger: write docs, update README, edit CHANGELOG, add JSDoc or TSDoc, code comments. Write and maintain project docs: README structure, Keep a Changelog, why-not-what comments, docs in sync with code, concise neutral tone.'
---
```

Unquoted description is about 224 characters (limit 250). No `disable-model-invocation`, no other keys.
**Alternatives considered**: Unquoted or double-quoted value; multi-line `>` scalar; extra keys (`license`, `metadata`); a description listing only triggers.
**Rationale**: `readFrontmatter` rejects multi-line and empty values. The domain `unquote` and the generators' `frontmatterDescription` strip one outer quote pair but do not unescape, so the description must contain no apostrophe, no double quote, and no `|` (README table cell). Colons and commas inside a quoted scalar are safe. Single quotes match `pr-writing` and survive Prettier. The trigger phrases cover all five areas compactly; the summary clause states the behavior. Model-invocable by design so the agent auto-activates on documentation requests.

### Decision: Leave pr-writing unchanged; reciprocal exclusion lives in docs-writing

**Choice**: `docs-writing` Activation Contract says "Not for pull request titles or descriptions, commit messages, or agent instruction files." `catalog/skills/pr-writing/SKILL.md` is not touched.
**Alternatives considered**: Edit pr-writing to point at docs-writing for changelogs.
**Rationale**: pr-writing already excludes changelogs and release notes, which is the correct split. Leaving it untouched keeps the change additive and avoids churn in the pr-writing content-contract test and spec. Agent instruction files (AGENTS.md conventions) are excluded because #126 owns them.

### Decision: Inspect first, follow the repository, never hand-edit generated output

**Choice**: The skill requires discovering the repository's existing conventions before writing, and treats three cases as hard gates: release-generated CHANGELOG (do not edit; change commit messages instead), existing docs generator (run it and its check script; do not hand-edit output), existing style guide or template (follow it over the skill defaults).
**Alternatives considered**: Prescribe a fixed README and CHANGELOG template regardless of the repository.
**Rationale**: The main failure modes from #125 are hand edits to release-generated changelog sections and drift from existing structure. A generic skill cannot know a repository's tooling, so detection drives behavior; defaults apply only when nothing is discovered.

### Decision: Test assertions guard registration and a minimal content contract

**Choice**: Extend the existing skills test (rename to cover four skills) and add one new `it` that reads `catalog/skills/docs-writing/SKILL.md` raw and asserts frontmatter shape plus a few load-bearing tokens. The new test copies the frontmatter-splitting pattern of the pr-writing test inline; the pr-writing test is not modified.
**Alternatives considered**: Registration-only assertions; full-file snapshot; extracting a shared helper used by both content tests.
**Rationale**: Registration alone does not prove the frontmatter and coverage success criteria. A snapshot turns wording edits into churn. A shared helper would modify the pr-writing test for a five-line saving; keeping the change additive was a proposal decision. Revisit the helper when a third content-contract test appears.

## SKILL.md Section Outline

| Section             | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Activation Contract | Use when asked to write, update, or review project documentation: README, CHANGELOG, code comments, JSDoc/TSDoc, or other docs that describe behavior. Not for pull request titles or descriptions, commit messages, or agent instruction files.                                                                                                                                                                                                                                                                                                                                                             |
| Hard Rules          | Inspect existing docs and conventions before writing; follow existing structure, style guide and language. README: purpose first, then install, usage, configuration, contributing and license links. CHANGELOG: Keep a Changelog format with Conventional Commits mapping; never hand-edit sections generated by a release tool (for example semantic-release). Comments explain why, not what; document public API contracts (params, returns, throws); no commented-out code or stale TODOs. Update docs in the same change as the behavior. Concise, neutral, second person or imperative. Stay generic. |
| Decision Gates      | Table (below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Execution Steps     | 1 identify what changed and which docs describe it; 2 inspect README layout, CHANGELOG origin and release config, docs generators and their check scripts, style guide or templates; 3 update README sections affected; 4 update CHANGELOG only when it is hand-maintained (Unreleased section, Keep a Changelog categories); 5 add or fix comments and JSDoc/TSDoc on touched public API; 6 run generators and check scripts; 7 present changes and any doc gaps.                                                                                                                                           |
| Output Contract     | Return the edited or proposed docs, a list of files changed, generators or checks run with results, and anything skipped with the reason (for example release-generated CHANGELOG) or still out of sync.                                                                                                                                                                                                                                                                                                                                                                                                     |

Decision Gates table content:

| Condition                                  | Action                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| CHANGELOG generated by a release tool      | Do not edit it; make commit messages carry the change, and say so               |
| CHANGELOG maintained by hand               | Add entries under Unreleased using Keep a Changelog categories                  |
| Repository has a docs generator            | Run it and its check script; never hand-edit generated output                   |
| Repository has a style guide or template   | Follow it over the defaults in this skill                                       |
| No README, or README missing core sections | Use purpose, install, usage, configuration, then contributing and license links |
| Public API changed                         | Update its JSDoc/TSDoc (params, returns, throws) in the same change             |
| Docs language differs from English         | Write in the existing docs language and register                                |

Mapping for Conventional Commits to Keep a Changelog (for hand-maintained changelogs): `feat` to Added, `fix` to Fixed, removals to Removed, deprecations to Deprecated, security fixes to Security, other user-visible behavior changes to Changed; internal types (`chore`, `test`, `ci`, `build`, `style`, `refactor`) are omitted unless user visible.

Restraint carried from pr-writing: no `Co-Authored-By`, no repository-specific names (`shitaku`, specific labels, paths unique to this repo).

## Data Flow

    user request ──→ agent activates docs-writing
                          │
        git diff / task ──┼──→ which behavior changed, which docs describe it
        README layout ────┼──→ section structure to follow
        CHANGELOG + release config ──→ hand-maintained? edit : leave alone
        docs generators ──┼──→ run + check, never hand-edit output
        style guide ──────┼──→ tone, language, templates
                          ▼
              updated docs + checks run ──→ summary with skipped items

Install-time flow is unchanged: `catalog.json` → `FolderCatalogSource` → `parseSkill` → byte copy to the agent skills dir.

## File Changes

| File                                                         | Action | Description                                                                          |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------ |
| `test/adapters/catalog/bundled-catalog.test.ts`              | Modify | Four skills in index, dir entries and load; new docs-writing content-contract test   |
| `catalog/skills/docs-writing/SKILL.md`                       | Create | Frontmatter and body per outline above                                               |
| `catalog/catalog.json`                                       | Modify | `items.skills`: `["docs-writing", "example-skill", "pr-writing", "socratic-method"]` |
| `README.md`                                                  | Modify | Skills table, generated by `pnpm run docs:catalog`                                   |
| `website/src/content/docs/en/catalog/skills/docs-writing.md` | Create | Generated by `pnpm run docs:website-catalog`                                         |
| `website/src/content/docs/es/catalog/skills/docs-writing.md` | Create | Generated by `pnpm run docs:website-catalog`                                         |

`items.skills` stays alphabetical, matching the sorted `readdirSync` assertion. `catalog/skills/pr-writing/SKILL.md` and all of `src/` are unchanged.

## Interfaces / Contracts

No TypeScript interface changes. The contract is the frontmatter above and the loaded catalog entry:

```ts
// existing shape from src/domain/catalog/skill.ts
{ name: 'docs-writing', description: 'Trigger: ...', files: [{ path: 'SKILL.md', ... }] }
```

## Testing Strategy

Strict TDD, runner `pnpm test` (Vitest).

| Layer       | What to test                                                                                                                                                                                                                                                                                                                                                                               | Approach                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Unit (RED)  | `items.skills` and sorted skills dir entries equal `['docs-writing', 'example-skill', 'pr-writing', 'socratic-method']`; `catalog.skills` length 4; `docs-writing` loads with non-empty description and `files` `['SKILL.md']`; `catalog.issues` empty                                                                                                                                     | Edit the existing skills `it` (rename title to list four skills); observe failure                                |
| Unit (RED)  | Raw `docs-writing/SKILL.md`: exactly two frontmatter lines, `name: docs-writing` and `description: 'Trigger:...'`; unquoted length <= 250; no `'`, `"` or `\|` in it; no `disable-model-invocation`; body has the five `## ` headings; raw contains `Keep a Changelog`, `JSDoc`, `not what`, `Not for pull request`; raw does not contain `Co-Authored-By` or `shitaku` (case-insensitive) | New `it('keeps the docs-writing skill content contract')` after the pr-writing one; `readFileSync`               |
| Integration | `init --skills docs-writing --scope project --dry-run` plans `create`                                                                                                                                                                                                                                                                                                                      | Manual at verify: `pnpm run build` then `node dist/main.js init --skills docs-writing --scope project --dry-run` |
| Docs        | README and website pages in sync                                                                                                                                                                                                                                                                                                                                                           | `pnpm run docs:catalog:check`, `pnpm run docs:website-catalog:check`                                             |

RED expectation: both tests fail before the skill exists (list mismatch, `ENOENT` on the raw read). Full gate: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`. `test/generators.test.ts` uses a sandboxed catalog and is unaffected.

## Task Ordering and Commit Plan

1. RED: update `bundled-catalog.test.ts` (both tests); run `pnpm test`; record the failures.
2. GREEN: create `catalog/skills/docs-writing/SKILL.md`; add the `catalog.json` entry; `pnpm test` passes.
3. `pnpm run format:check` and `pnpm run lint` (fix with `format` / `lint:fix` on touched files only).
4. Commit 1: `feat(catalog): add docs-writing skill` (test, SKILL.md, catalog.json).
5. Run `pnpm run docs:catalog`, then `pnpm run docs:website-catalog`; run both `:check` scripts.
6. Commit 2: `docs: list docs-writing skill in README and website` (README.md, two website pages).
7. Dry-run acceptance (manual, at verify): `pnpm run build`, then `node dist/main.js init --skills docs-writing --scope project --dry-run` shows a `create` for the skill from the bundled catalog.

Single PR. Authored lines: about 50-65 (SKILL.md) + 1 (catalog.json) + about 35 (test), well under 400; generated docs excluded.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The skill text may tell an agent to run a repository's docs generators at run time, but shitaku adds no code that spawns processes or classifies files for this change.

## Migration / Rollout

No migration required. Existing installs are unaffected; users opt in with `shitaku init --skills docs-writing`.

## Open Questions

- [ ] Final SKILL.md wording must keep the description free of apostrophes (for example avoid "repo's"); enforced by the content-contract test, non-blocking.
