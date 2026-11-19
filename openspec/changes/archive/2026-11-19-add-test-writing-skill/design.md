# Design: Add test-writing Catalog Skill

## Technical Approach

Exploration Approach 1, as accepted in the proposal: one generic, runner-agnostic `catalog/skills/test-writing/SKILL.md` that follows the same contract as `refactoring` and `docs-writing` (two-key frontmatter, five fixed sections, Decision Gates table, numbered Execution Steps). No `src/` change: the existing `FolderCatalogSource` loader and the `skills-install` copy path already handle a new single-file skill once it is registered in `catalog/catalog.json`. Correctness is pinned by `test/adapters/catalog/bundled-catalog.test.ts` (registration, loadability, `files: ['SKILL.md']`) and by `expectSkillContract` (frontmatter shape, headings, load-bearing tokens, forbidden tokens). README and website pages are regenerated, never hand-edited.

Strict TDD order: RED (test edits only) -> GREEN (SKILL.md + catalog.json) -> format -> docs generators -> full gates -> build and dry-run install.

## Architecture Decisions

### Decision: Single-file skill mirroring refactoring and docs-writing

**Choice**: Only `SKILL.md` in `catalog/skills/test-writing/`, ~50-60 lines, same five sections.
**Alternatives considered**: SKILL.md plus a `references/` folder with per-runner checklists (exploration Approach 2).
**Rationale**: Every bundled skill asserts `files: ['SKILL.md']`; extra files widen install surface and drift risk. The checklists are short enough to inline as lists under Hard Rules, the same way `refactoring` inlines its named refactorings.

### Decision: Description text (246 characters)

**Choice**:

```
Trigger: write tests, add unit tests, add test coverage, regression test, flaky test, what to mock. Write reliable tests: pick the right pyramid level, mock only boundaries, behavior-named cases, edge-case and regression checklists, no flakiness.
```

Manual count: `Trigger: ` 9, `write tests, ` 13 (22), `add unit tests, ` 16 (38), `add test coverage, ` 19 (57), `regression test, ` 17 (74), `flaky test, ` 12 (86), `what to mock. ` 14 (100), `Write reliable tests: ` 22 (122), `pick the right pyramid level, ` 30 (152), `mock only boundaries, ` 22 (174), `behavior-named cases, ` 22 (196), `edge-case and regression checklists, ` 37 (233), `no flakiness.` 13 (246). No `'`, `"` or `|`; no contractions.
**Alternatives considered**: Adding "follow repo conventions" (257 characters, over the limit); dropping trigger phrases to make room (weakens model invocation).
**Rationale**: Trigger phrases drive model invocation, so they keep priority. "Repository conventions first" lives in the body as the first Hard Rule. Margin is only 4 characters: apply must recheck the length with the contract test, not by eye.

### Decision: Boundary with refactoring stated in the Activation Contract and a Decision Gate

**Choice**: The Activation Contract ends with `Not for refactoring safety nets (characterization tests written during a refactor), production code changes, commit messages, or pull request text.` A Decision Gate row redirects a refactoring safety net request.
**Alternatives considered**: Editing `refactoring` to point at `test-writing` (out of scope: no change to existing skills); naming the other skill by catalog name (couples skills).
**Rationale**: Describes the excluded work generically, keeps both skills independent, and matches the established "Not for ..." pattern guarded by tests.

### Decision: Contract-test tokens, including a runner-name guard

**Choice**: Required tokens (exact substrings of `raw`): `Repository conventions first`, `test pyramid`, `Mock only at boundaries`, `Arrange-Act-Assert`, `Edge-case checklist`, `fails before the fix`, `No flakiness`, `Not for refactoring safety nets`. Forbidden: `/shitaku/i`, `'Co-Authored-By'`, `/\b(?:vitest|jest|pytest|mocha)\b/i`.
**Alternatives considered**: Only the two standard forbidden tokens; asserting many prose fragments.
**Rationale**: One token per proposal behavior (conventions, level, mocking, naming/AAA, edge cases, regression, flakiness, boundary) is load-bearing yet not brittle. The runner-name guard enforces the "runner-agnostic" out-of-scope line cheaply; the description and planned body contain none of those names.

### Decision: Two commits in one PR

**Choice**: `feat(catalog): add test-writing skill` (SKILL.md, catalog.json, test) then `docs: list test-writing skill in README and website` (generated files only).
**Alternatives considered**: One commit; chained PRs.
**Rationale**: Mirrors archived `add-refactoring-skill` / `add-docs-writing-skill`; authored diff ~110-140 lines, well under the 400-line budget. Note: `docs:catalog:check` runs in CI, not in hooks, so commit 1 passes `pre-push` on its own; the PR is only pushed after commit 2.

## Data Flow

    catalog/skills/test-writing/SKILL.md ──┐
    catalog/catalog.json (items.skills) ───┼──→ FolderCatalogSource.load() ──→ init --skills test-writing (byte copy)
                                           │
                                           ├──→ scripts/generate-catalog-table.mjs ──→ README.md skills table
                                           └──→ scripts/generate-website-catalog.mjs ──→ website/.../{en,es}/catalog/skills/test-writing.md

## File Changes

| File                                                         | Action             | Description                                                                                        |
| ------------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------- |
| `test/adapters/catalog/bundled-catalog.test.ts`              | Modify             | Skill lists, count 7, `byName` block, new contract test (RED first)                                |
| `catalog/skills/test-writing/SKILL.md`                       | Create             | Skill content (outline below)                                                                      |
| `catalog/catalog.json`                                       | Modify             | Append `"test-writing"` to `items.skills`; Prettier makes the array multi-line (130 > 120 columns) |
| `README.md`                                                  | Modify (generated) | Skills table row via `pnpm run docs:catalog`                                                       |
| `website/src/content/docs/en/catalog/skills/test-writing.md` | Create (generated) | `pnpm run docs:website-catalog`                                                                    |
| `website/src/content/docs/es/catalog/skills/test-writing.md` | Create (generated) | Same generator; skill pages need no translation input                                              |

No `src/`, profile, agent, rule, CONTRIBUTING or CHANGELOG change.

## Interfaces / Contracts

### SKILL.md outline (target text; apply may polish wording but must keep every required token)

```markdown
---
name: test-writing
description: '<246-char description above>'
---

## Activation Contract

Use when asked to write, add, or fix tests, raise test coverage, reproduce a bug with a regression test, or remove flakiness from a test suite. Not for refactoring safety nets (characterization tests written during a refactor), production code changes, commit messages, or pull request text.

## Hard Rules

- Repository conventions first: inspect the test runner, file layout, naming, helpers, and fixtures before writing; they win over the defaults in this skill.
- Pick the cheapest level that proves the behavior, following the test pyramid: many unit tests, fewer integration tests, few end-to-end tests.
- Mock only at boundaries: fake I/O, network, filesystem, clock, and randomness. Never mock the unit under test or its internal collaborators.
- Test behavior, not implementation: assert observable outcomes (return values, state, output, errors), not private calls or internal structure.
- One behavior per test, named after that behavior and structured as Arrange-Act-Assert.
- A regression test reproduces the bug and fails before the fix; observe the failure before changing code.
- No flakiness: control time and randomness, never sleep on real time, isolate shared state, and keep tests independent of order.
- Never weaken, skip, or delete an existing test to make a suite pass.
- Stay generic: do not assume any repository-specific tool, runner, or path.

Edge-case checklist, applied to each behavior:

- Empty: empty strings and collections, missing optional values.
- Boundaries: zero, one, maximum, and off-by-one limits.
- Invalid: malformed data, wrong types, and rejected values.
- Errors: failing dependencies, timeouts, and thrown errors.
- Ordering and concurrency, when the behavior depends on them.

## Decision Gates

| Condition                                                    | Action                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| The repository has a test runner and test conventions        | Follow them over the defaults in this skill                            |
| No test runner is configured                                 | Stop and ask before adding one                                         |
| The behavior is pure logic                                   | Write a unit test                                                      |
| The behavior crosses a module, database, or process boundary | Write an integration test; fake only external services                 |
| A user flow can only be proven end to end                    | Add one end-to-end test; cover details at lower levels                 |
| The code cannot be tested without mocking internals          | Test through the public interface, or report the design issue and ask  |
| A bug is being fixed                                         | Write the regression test first and see it fail                        |
| A test is flaky                                              | Remove the source of nondeterminism; never add retries or longer waits |
| The request is a safety net for a refactoring                | Out of scope; leave it to the refactoring workflow                     |

## Execution Steps

1. Confirm the behavior to test and why (new feature, bug, coverage gap, flaky test).
2. Inspect the runner, test layout, naming, helpers, and existing tests near the target code.
3. Choose the test level and the boundaries to fake.
4. List the cases: the main behavior, the edge-case checklist, and a regression case for each bug.
5. Write one behavior-named Arrange-Act-Assert test per case.
6. Run the new tests; a regression test must fail before the fix and pass after it.
7. Run the relevant suite and confirm the new tests pass in isolation and in any order.
8. Report the outcome.

## Output Contract

Return the tests added or changed with the behavior each covers, the level chosen and why, the boundaries faked, test results (including the failing run of each regression test), edge cases left untested with the reason, and production code issues found but not fixed.
```

Body length ~55 lines, within the proposal's 45-65. The Decision Gates table is shown unaligned; `pnpm run format` (Prettier, markdown included) aligns it as in the sibling skills.

### Test edits (`test/adapters/catalog/bundled-catalog.test.ts`)

1. Rename the registration test to `ships docs-writing, example-skill, pr-writing, product-owner, refactoring, socratic-method and test-writing as registered loadable bundled skills`.
2. Append `'test-writing'` to both exact lists (`index.items.skills` and the sorted `readdirSync` entries).
3. `expect(catalog.skills).toHaveLength(7);`
4. After the `socratic-method` block:

```ts
expect(byName['test-writing']).toMatchObject({ name: 'test-writing' });
expect(byName['test-writing']?.description.length).toBeGreaterThan(0);
expect(byName['test-writing']?.files.map((f) => f.path)).toEqual(['SKILL.md']);
```

5. New test after `keeps the refactoring skill content contract`:

```ts
it('keeps the test-writing skill content contract', () => {
  expectSkillContract('test-writing', {
    required: [
      'Repository conventions first',
      'test pyramid',
      'Mock only at boundaries',
      'Arrange-Act-Assert',
      'Edge-case checklist',
      'fails before the fix',
      'No flakiness',
      'Not for refactoring safety nets',
    ],
    forbidden: [/shitaku/i, 'Co-Authored-By', /\b(?:vitest|jest|pytest|mocha)\b/i],
  });
});
```

Expected RED: the list/count assertions fail (6 skills, missing entry) and `expectSkillContract` throws ENOENT on the missing SKILL.md.

### catalog.json edit

Append `"test-writing"` after `"socratic-method"` in `items.skills`, then `pnpm run format`; Prettier rewrites the array to one item per line. No other key changes.

### Command sequence

```sh
pnpm test                          # RED observed after test edits
# add SKILL.md + catalog.json entry
pnpm run format
pnpm test                          # GREEN
pnpm run docs:catalog
pnpm run docs:website-catalog
pnpm run docs:catalog:check
pnpm run docs:website-catalog:check
pnpm run typecheck && pnpm run lint && pnpm run format:check
pnpm run build && node dist/main.js init --skills test-writing --scope project --dry-run   # expect a create for the skill
```

Run `docs:catalog` before `docs:website-catalog` (proposal order); run `format:check` after the generators in case generated files need formatting.

## Testing Strategy

| Layer            | What to Test                                                                           | Approach                                                         |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Unit / adapter   | Registration, loadability, `files: ['SKILL.md']`, count 7                              | Extend existing bundled-catalog test (RED first)                 |
| Content contract | Frontmatter shape, 250-char description, headings, 8 required tokens, forbidden tokens | `expectSkillContract('test-writing', ...)`                       |
| Repo checks      | README and website drift                                                               | `docs:catalog:check`, `docs:website-catalog:check`               |
| Smoke            | Install plan                                                                           | Built CLI `init --skills test-writing --scope project --dry-run` |
| E2E              | N/A                                                                                    | Not configured in this project                                   |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The change adds static catalog data and a test.

## Migration / Rollout

No migration required. Skill is opt-in via `init --skills test-writing`; not added to any profile.

## Open Questions

None blocking.
