# Design: Add refactoring Catalog Skill

## Technical Approach

Catalog-only change (proposal "Approach", exploration Approach A), mirroring the archived `2026-11-17-add-docs-writing-skill` and `2026-11-17-add-product-owner-skill` designs. One generic `catalog/skills/refactoring/SKILL.md` in the five-section layout shared by `docs-writing`, `pr-writing` and `product-owner`, registered in `catalog/catalog.json` under `items.skills`, guarded by `test/adapters/catalog/bundled-catalog.test.ts`, and surfaced through the two existing docs generators. No `src/` change: `FolderCatalogSource` loads the skill, `parseSkill` validates `name` against the directory and a non-empty `description`, and install is a byte-identical copy via `init --skills refactoring`.

No profile change: `catalog/profiles/*.json` and `items.profiles` stay as they are, so the existing `web`/`backend` profile-resolution assertions (`skills: []`) remain valid without edits.

The skill is the product. At run time it guides an agent through a safe refactoring: inspect the repository (test runner, coverage of the target code, commit conventions), secure a test safety net (characterization tests when coverage is missing), apply one named refactoring at a time with behavior unchanged, run tests after every step and revert a failing step, and record each coherent step as an atomic `refactor:` commit that never mixes in behavior changes.

## Architecture Decisions

### Decision: Single file, existing five-section layout

**Choice**: One `SKILL.md` with sections Activation Contract, Hard Rules, Decision Gates (table), Execution Steps, Output Contract; target 45-65 lines (`docs-writing` is 46 lines).
**Alternatives considered**: `SKILL.md` plus `references/` with a full refactoring catalog (exploration Approach B); free-form prose.
**Rationale**: Four catalog precedents use this shape and `expectSkillContract` asserts the five headings. Install stays one file (`files: ['SKILL.md']`). A `references/` folder changes the `files` assertion and departs from precedent with no proven need.

### Decision: Frontmatter is two single-line scalars, single-quoted description

**Choice**:

```yaml
---
name: refactoring
description: 'Trigger: refactor code, clean up code, restructure, extract function, rename, remove duplication, reduce complexity. Refactor safely: tests first, behavior unchanged, small named steps, test after each step, atomic refactor commits.'
---
```

Unquoted description is about 232 characters (limit 250). No `disable-model-invocation`, no other keys.
**Alternatives considered**: Unquoted or double-quoted value; multi-line `>` scalar; extra keys (`allowed-tools`); a triggers-only description.
**Rationale**: `expectSkillContract` requires exactly two frontmatter lines matching `name: refactoring` and `/^description: 'Trigger:.*'$/`. The domain `unquote` and the generators strip one outer quote pair without unescaping, so the value must contain no apostrophe, double quote or `|` (README table cell). The description avoids contractions and the literal `refactor:` (colon tokens are safe inside single quotes, but keeping it out avoids confusion with the commit type). Model-invocable by design so the agent auto-activates on refactoring requests and a future `refactorer` agent can preload it via `skills:`.

### Decision: Compact named-refactoring catalog inside Hard Rules

**Choice**: A short bullet list (11 entries, one line each, "Name: when to apply") after a `Named refactorings, one per step:` lead-in, placed at the end of the Hard Rules section. No extra `##` heading is added, so the section layout stays identical to the precedent skills:

| Refactoring                            | When to apply                                                     |
| -------------------------------------- | ----------------------------------------------------------------- |
| Extract Function                       | A block needs a comment to explain it, or is duplicated           |
| Inline Function                        | The body is as clear as the name, or the indirection adds nothing |
| Extract Variable                       | A complex expression is hard to read                              |
| Rename                                 | A name does not reveal intent                                     |
| Move Function or Field                 | It uses another module more than its own                          |
| Decompose Conditional                  | A condition or its branches are hard to read                      |
| Replace Conditional with Guard Clauses | Nested conditionals hide the normal path                          |
| Replace Conditional with Polymorphism  | The same type switch repeats in several places                    |
| Introduce Parameter Object             | The same group of parameters travels together                     |
| Replace Magic Number with Constant     | A literal carries unexplained meaning                             |
| Remove Dead Code                       | Code is unreachable or unused (confirm with search and tests)     |

Rendered in SKILL.md as a bullet list (`- Extract Function: ...`) to stay compact; 11 lines maximum.
**Alternatives considered**: A Markdown table (wider, Prettier pads it); a longer Fowler catalog; referencing an external catalog by URL only.
**Rationale**: Named steps are the core behavior; agents need the vocabulary and the trigger for each. One-line bullets keep the file within the 45-65 line budget and avoid Prettier table churn. Extras are deferred rather than adding `references/` (proposal risk "catalog inflates the skill").

### Decision: Safety net is a hard gate; commits stay separate, not authored

**Choice**: Hard Rules require running the existing tests before any edit; when the target code lacks coverage, write characterization tests that pin current behavior (including surprising behavior) first, or stop and ask. A found bug is reported, not fixed, inside the refactoring. Commits: one `refactor:` commit per coherent step, never mixed with `feat` or `fix`; the skill does not define commit-message format beyond that (owned by the conventional-commits rule) and does not write pull request text (owned by `pr-writing`).
**Alternatives considered**: Allow refactoring without tests when "obviously safe"; fix bugs found along the way; full commit-message rules in the skill.
**Rationale**: Untested large rewrites and mixed commits are the failure modes the issue targets. Keeping commit authoring and PR text out avoids overlap with existing catalog items (proposal risk "overlap").

### Decision: Content-contract test asserts few load-bearing tokens

**Choice**: Add `it('keeps the refactoring skill content contract')` after the product-owner one, calling the existing file-local `expectSkillContract` helper:

```ts
it('keeps the refactoring skill content contract', () => {
  expectSkillContract('refactoring', {
    required: [
      'characterization test',
      'behavior',
      'Extract Function',
      'Rename',
      'revert',
      'refactor:',
      'Not for new features',
    ],
    forbidden: [/shitaku/i, 'Co-Authored-By'],
  });
});
```

**Alternatives considered**: Assert every named refactoring; assert full sentences; no content test.
**Rationale**: Each token maps to one proposal behavior (safety net, unchanged behavior, named steps, per-step revert, atomic commit type, activation boundary). Few tokens keep the guard meaningful but not brittle to wording edits. The helper already exists (extracted in the product-owner change), so no refactor step is needed in this change.

## SKILL.md Section Outline

| Section             | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activation Contract | Use when asked to refactor, clean up, restructure or simplify existing code without changing what it does. Not for new features, bug fixes, commit-message authoring, or pull request titles and descriptions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Hard Rules          | Inspect first (test runner, coverage of the target code, commit conventions). Safety net first: run existing tests before touching code; when coverage is missing, write characterization tests that pin current behavior, or stop and ask. Keep behavior unchanged: no new features, bug fixes, or public contract changes; report bugs found instead of fixing them. One named refactoring per step, smallest useful step. Run tests after every step; revert the step when they fail. One `refactor:` commit per coherent step, never mixed with behavior changes; no scope creep beyond the requested code. Stay generic. Then the named-refactoring bullet list (lead-in "Named refactorings, one per step:"). |
| Decision Gates      | Table (below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Execution Steps     | 1 confirm the target code and goal (readability, duplication, complexity); 2 inspect the test runner, coverage and commit conventions; 3 run the tests and record a green baseline; 4 add characterization tests where coverage is missing and commit them separately; 5 pick one named refactoring and apply it; 6 run the tests, revert on failure, otherwise commit as `refactor:`; 7 repeat 5-6 until the goal is met or the next step would change behavior; 8 report.                                                                                                                                                                                                                                         |
| Output Contract     | Return the named refactorings applied in order, the commits created, test results after each step, characterization tests added, reverted steps with the reason, bugs or behavior questions found but not fixed, and remaining refactoring opportunities.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Decision Gates table content:

| Condition                                           | Action                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| No tests cover the target code                      | Write characterization tests first, or stop and ask                         |
| Baseline tests fail before any change               | Stop and report; do not refactor on a red baseline                          |
| Tests fail after a step                             | Revert the step and try a smaller one                                       |
| A bug is found while refactoring                    | Report it; fix it later in a separate `fix` change, not in this refactoring |
| The change would alter a public API or contract     | Stop and ask; treat it as a behavior change                                 |
| The request mixes refactoring with a feature        | Refactor first in `refactor:` commits, then hand off the feature            |
| The repository has refactoring or style conventions | Follow them over the defaults in this skill                                 |

Restraint carried from earlier skills: no `Co-Authored-By`, no repository-specific names (`shitaku`, specific runners, labels or paths). Line budget check: frontmatter 4 + Activation 3 + Hard Rules about 20 (8 rules + 11 named refactorings + lead-in) + Gates 11 + Steps 10 + Output 3 + blank lines, about 60 lines.

## Data Flow

    user request ──→ agent activates refactoring
                          │
        test runner, coverage, conventions ──→ green baseline
        missing coverage ──→ characterization tests (or stop and ask)
                          ▼
        ┌──→ pick one named refactoring ──→ apply ──→ run tests
        │                                              │
        │                  fail ──→ revert step ◀──────┤
        │                                              ▼ pass
        └────────────────────────────────── refactor: commit
                          ▼
                       report (applied, commits, reverts, findings)

Install-time flow is unchanged: `catalog.json` → `FolderCatalogSource` → `parseSkill` → byte copy to the agent skills dir.

## File Changes

| File                                                        | Action | Description                                                                                                                              |
| ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `test/adapters/catalog/bundled-catalog.test.ts`             | Modify | Six skills in title, index list, sorted dir entries, `toHaveLength(6)`, `refactoring` entry block; new refactoring content-contract test |
| `catalog/skills/refactoring/SKILL.md`                       | Create | Frontmatter and body per outline above                                                                                                   |
| `catalog/catalog.json`                                      | Modify | Line 21 becomes `"skills": ["docs-writing", "example-skill", "pr-writing", "product-owner", "refactoring", "socratic-method"],`          |
| `README.md`                                                 | Modify | Skills table, generated by `pnpm run docs:catalog`                                                                                       |
| `website/src/content/docs/en/catalog/skills/refactoring.md` | Create | Generated by `pnpm run docs:website-catalog`                                                                                             |
| `website/src/content/docs/es/catalog/skills/refactoring.md` | Create | Generated by `pnpm run docs:website-catalog`                                                                                             |

Unchanged by design: `catalog/profiles/*.json`, all other skills, rules and agents, all of `src/`, and `CHANGELOG.md`. `items.skills` stays alphabetical, matching the sorted `readdirSync` assertion. The `catalog.json` line stays within Prettier's 120 columns (about 117), but run `pnpm run format` if Prettier wraps it.

### Exact test edits (`bundled-catalog.test.ts`)

1. Line 256 title: `'ships docs-writing, example-skill, pr-writing, product-owner, refactoring and socratic-method as registered loadable bundled skills'`.
2. Lines 260-266 `index.items.skills` expectation: insert `'refactoring',` between `'product-owner',` and `'socratic-method',`.
3. Line 273 dir entries: `['docs-writing', 'example-skill', 'pr-writing', 'product-owner', 'refactoring', 'socratic-method']` (Prettier may wrap it at 120 columns).
4. Line 277: `expect(catalog.skills).toHaveLength(6);`.
5. After the product-owner block (line 294), add:

   ```ts
   expect(byName['refactoring']).toMatchObject({ name: 'refactoring' });
   expect(byName['refactoring']?.description.length).toBeGreaterThan(0);
   expect(byName['refactoring']?.files.map((f) => f.path)).toEqual(['SKILL.md']);
   ```

6. After `it('keeps the product-owner skill content contract')` (line 332), add the refactoring content-contract test from the decision above.

The `keeps every bundled agent skill registered` test is unaffected (no agent references `refactoring` yet).

## Interfaces / Contracts

No TypeScript interface changes. The contract is the frontmatter above and the loaded catalog entry:

```ts
// existing shape from src/domain/catalog/skill.ts
{ name: 'refactoring', description: 'Trigger: ...', files: [{ path: 'SKILL.md', ... }] }
```

`expectSkillContract` (existing, file-local) asserts: exactly two frontmatter lines; `name: refactoring`; `description: 'Trigger:...'`; unquoted length <= 250; no `'`, `"` or `|` in the description; no `disable-model-invocation`; the five `## ` headings; each required token present in the raw file; each forbidden string or pattern absent.

## Testing Strategy

Strict TDD, runner `pnpm test` (Vitest).

| Layer        | What to test                                                                                                                                                                                       | Approach                                                                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (RED)   | `items.skills` and sorted skills dir entries equal the six-name list; `catalog.skills` length 6; `refactoring` loads with non-empty description and `files` `['SKILL.md']`; `catalog.issues` empty | Edit the existing skills `it`; run `pnpm test`; observe list mismatch failure                                                                                              |
| Unit (RED)   | Raw `refactoring/SKILL.md` frontmatter shape, headings, required tokens, forbidden tokens                                                                                                          | New content-contract `it`; observe `ENOENT` failure before the file exists                                                                                                 |
| Unit (GREEN) | Same two tests pass                                                                                                                                                                                | Create SKILL.md and the `catalog.json` entry; `pnpm test` green                                                                                                            |
| Unchanged    | Profile resolution `skills: []`; other content contracts; dangling-agent-skill guard                                                                                                               | Existing tests pass untouched                                                                                                                                              |
| Integration  | Install plan                                                                                                                                                                                       | `pnpm run build`, then `node dist/main.js init --skills refactoring --scope project --dry-run` plans a `create` for the skill from the bundled catalog (manual, at verify) |
| Docs         | README and website pages in sync                                                                                                                                                                   | `pnpm run docs:catalog:check`, `pnpm run docs:website-catalog:check`                                                                                                       |

Full gate: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`.

## Task Ordering and Commit Plan

1. RED: apply the test edits above; run `pnpm test`; record the two failures (list mismatch, `ENOENT`).
2. GREEN: create `catalog/skills/refactoring/SKILL.md`; edit `catalog/catalog.json`; run `pnpm test` until green.
3. Gate: `pnpm run format` (if needed), `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`.
4. Commit 1: `feat(catalog): add refactoring skill` (test, SKILL.md, catalog.json).
5. Run `pnpm run docs:catalog`, then `pnpm run docs:website-catalog`; run both `:check` scripts and `pnpm run format:check`.
6. Commit 2: `docs: list refactoring skill in README and website` (README.md, two website pages).
7. Acceptance: `pnpm run build` and the dry-run smoke check.

Single PR. Authored lines: about 60 (SKILL.md) + 1 (catalog.json) + about 20 (tests), well under 400; generated docs excluded.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The change adds catalog data, tests and generated docs only. The skill text instructs agents to run tests and commit, but shitaku itself executes nothing new.

## Migration / Rollout

No migration required. Existing installs are unaffected; users opt in with `init --skills refactoring`. The follow-up `refactorer` agent will add `refactoring` to its `skills:` frontmatter, and the existing dangling-skill guard will then verify the registration.

## Open Questions

- [ ] Final description wording must stay free of apostrophes, double quotes and pipes and at most 250 characters; enforced by the content-contract test, non-blocking.
- [ ] If the spec phase adds required tokens, align the content-contract `required` list with the spec (non-blocking).
