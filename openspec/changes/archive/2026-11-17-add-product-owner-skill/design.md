# Design: Add product-owner Catalog Skill

## Technical Approach

Catalog-only change (proposal "Approach"), mirroring the archived `2026-11-17-add-docs-writing-skill` design. One generic `catalog/skills/product-owner/SKILL.md` in the same five-section layout as `docs-writing` and `pr-writing`, registered in `catalog/catalog.json` under `items.skills`, guarded by `test/adapters/catalog/bundled-catalog.test.ts`, and surfaced through the two existing docs generators. No `src/` change: `FolderCatalogSource` loads the skill, `parseSkill` (`src/domain/catalog/skill.ts`) validates `name` against the directory and a non-empty `description`, and install is a byte-identical copy via `init --skills product-owner`.

No profile change (user decision recorded in the proposal): `catalog/profiles/*.json` and `items.profiles` stay as they are, so the existing `web`/`backend` profile-resolution assertions (`skills: []`) remain valid without edits.

The skill is the product. At run time it guides an agent through product ownership work: understand the product context first, then state vision and goals, shape a backlog of epics and user stories, write Given/When/Then acceptance criteria, prioritize (value vs effort, MoSCoW), scope an MVP with success metrics, plan a roadmap and releases, and hand off to a tech lead for feasibility and estimates.

## Architecture Decisions

### Decision: Single file, existing five-section layout

**Choice**: One `SKILL.md` with sections Activation Contract, Hard Rules, Decision Gates (table), Execution Steps, Output Contract; target 45-65 lines, matching `docs-writing` (46 lines).
**Alternatives considered**: `SKILL.md` plus `references/` (story template, prioritization worksheet); free-form prose.
**Rationale**: Three catalog precedents use this shape; install stays one file (`files: ['SKILL.md']`); the review surface stays small. A `references/` folder changes the `files` expectation and departs from precedent with no proven need.

### Decision: Frontmatter is two single-line scalars, single-quoted description

**Choice**:

```yaml
---
name: product-owner
description: 'Trigger: product vision, backlog, user stories, acceptance criteria, prioritize features, define MVP, roadmap, release plan. Act as product owner: goals, epics, Given/When/Then criteria, MoSCoW and value vs effort, success metrics.'
---
```

Unquoted description is about 231 characters (limit 250). No `disable-model-invocation`, no other keys.
**Alternatives considered**: Unquoted or double-quoted value; multi-line `>` scalar; extra keys; a description listing only triggers.
**Rationale**: `readFrontmatter` rejects multi-line and empty values. The domain `unquote` and the generators' `frontmatterDescription` strip one outer quote pair without unescaping, so the description must contain no apostrophe, no double quote, and no `|` (README table cell). Slashes, colons and commas inside the single-quoted scalar are safe. Model-invocable by design so the agent auto-activates on product requests.

### Decision: Generic tech-lead handoff, no cross-skill dependency

**Choice**: The skill ends product work with a handoff section in its output: open questions for a tech lead (feasibility, technical risks, estimates, dependencies), phrased as a role, not a skill name. Activation Contract excludes technical design, architecture, implementation and code review.
**Alternatives considered**: Reference a `tech-lead` skill by name; produce estimates itself.
**Rationale**: No tech-lead skill exists in the catalog; naming one would create a dangling dependency. A product owner owns the what and why; sizing and feasibility belong to engineering, so the skill must not invent estimates.

### Decision: Context first, no invented facts

**Choice**: Hard rules require gathering product context (users, problem, constraints, existing backlog or roadmap) before writing artifacts, following any existing backlog format or tracker conventions, and marking assumptions explicitly instead of inventing user research, metrics baselines or dates. Ask at most one focused question at a time when a product decision is missing.
**Alternatives considered**: Always emit a full fixed template regardless of context.
**Rationale**: The main failure mode of generic product skills is confident fabrication (fake personas, fake numbers). A generic skill cannot know a team's tracker or format, so discovery drives behavior and defaults apply only when nothing exists.

### Decision: Third content-contract test triggers a file-local helper (REFACTOR step)

**Choice**: RED adds `it('keeps the product-owner skill content contract')` written inline in the existing pattern. After GREEN, a REFACTOR step extracts a file-local helper in `bundled-catalog.test.ts` that the three content-contract tests (`pr-writing`, `docs-writing`, `product-owner`) call, keeping every existing assertion and per-skill token list identical. No new file under `test/helpers/`.
**Alternatives considered**: Keep three inline copies (no refactor); move the helper to `test/helpers/`.
**Rationale**: The `docs-writing` design explicitly deferred the helper "when a third content-contract test appears"; this is that change. A file-local function keeps the scope inside one already-modified file. Behavior preservation is verified by the same test count and all tests green before and after. If the reviewer prefers zero churn on existing tests, the REFACTOR step can be dropped without affecting any other task.

## SKILL.md Section Outline

| Section             | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activation Contract | Use when asked to define product vision or goals, build or refine a backlog, write user stories or acceptance criteria, prioritize features, scope an MVP, or plan a roadmap or releases. Not for technical design, architecture, implementation, estimation, or code review.                                                                                                                                                                                                                                                            |
| Hard Rules          | Gather context first (users, problem, constraints, existing backlog, roadmap or tracker) and follow existing formats. Own the what and why, never the how. Vision: target users, problem, outcome, measurable goals. Stories: "As a <role>, I want <capability>, so that <benefit>", small and independent (INVEST). Every story has acceptance criteria in Given/When/Then, testable and unambiguous. Never invent research, metrics baselines, estimates or dates; mark assumptions. Ask one focused question at a time. Stay generic. |
| Decision Gates      | Table (below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Execution Steps     | 1 clarify the problem, users and constraints; 2 state vision and measurable goals; 3 group work into epics and split into user stories; 4 write Given/When/Then acceptance criteria per story; 5 prioritize with value vs effort and MoSCoW, recording rationale; 6 define the MVP (Must haves) and success metrics; 7 sequence a roadmap and release plan by outcome; 8 prepare the tech lead handoff (feasibility, risks, estimates, dependencies).                                                                                    |
| Output Contract     | Return vision and goals, the prioritized backlog (epics, stories, acceptance criteria, MoSCoW label and rationale), MVP scope with success metrics, roadmap and release plan, assumptions, and open questions for the tech lead.                                                                                                                                                                                                                                                                                                         |

Decision Gates table content:

| Condition                             | Action                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------ |
| Problem, users or goal unclear        | Ask one focused question before writing stories                          |
| Existing backlog, tracker or template | Follow its format and fields over the defaults in this skill             |
| Story too large for one iteration     | Split by workflow step, rule or data variation; keep each slice valuable |
| Acceptance criterion not testable     | Rewrite as Given/When/Then with an observable outcome                    |
| Effort unknown                        | Mark it unknown and route to the tech lead; do not guess                 |
| MVP grows beyond Must haves           | Move extras to Should or Could and to a later release                    |
| No success metric for a goal          | Propose a measurable metric and mark the baseline as an assumption       |

Restraint carried from earlier skills: no `Co-Authored-By`, no repository-specific names (`shitaku`, specific trackers, labels or paths).

## Data Flow

    user request ──→ agent activates product-owner
                          │
        problem, users, constraints ──→ vision + measurable goals
        existing backlog / tracker ───→ format to follow
                          ▼
         epics ──→ user stories ──→ Given/When/Then criteria
                          ▼
         value vs effort + MoSCoW ──→ MVP + success metrics
                          ▼
              roadmap + release plan ──→ tech lead handoff (open questions)

Install-time flow is unchanged: `catalog.json` → `FolderCatalogSource` → `parseSkill` → byte copy to the agent skills dir.

## File Changes

| File                                                          | Action | Description                                                                                                          |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `test/adapters/catalog/bundled-catalog.test.ts`               | Modify | Five skills in index, dir entries and load; new product-owner content-contract test; REFACTOR to a file-local helper |
| `catalog/skills/product-owner/SKILL.md`                       | Create | Frontmatter and body per outline above                                                                               |
| `catalog/catalog.json`                                        | Modify | `items.skills`: `["docs-writing", "example-skill", "pr-writing", "product-owner", "socratic-method"]`                |
| `README.md`                                                   | Modify | Skills table, generated by `pnpm run docs:catalog`                                                                   |
| `website/src/content/docs/en/catalog/skills/product-owner.md` | Create | Generated by `pnpm run docs:website-catalog`                                                                         |
| `website/src/content/docs/es/catalog/skills/product-owner.md` | Create | Generated by `pnpm run docs:website-catalog`                                                                         |

Unchanged by design: `catalog/profiles/*.json`, `items.profiles`, all other skills, and all of `src/`. `items.skills` stays alphabetical, matching the sorted `readdirSync` assertion.

## Interfaces / Contracts

No TypeScript interface changes. The contract is the frontmatter above and the loaded catalog entry:

```ts
// existing shape from src/domain/catalog/skill.ts
{ name: 'product-owner', description: 'Trigger: ...', files: [{ path: 'SKILL.md', ... }] }
```

Planned file-local test helper (REFACTOR step only; signature indicative):

```ts
function expectSkillContract(
  name: string,
  { required, forbidden }: { required: readonly string[]; forbidden: readonly (string | RegExp)[] },
): void;
```

It asserts: exactly two frontmatter lines; `name: <name>`; `description: 'Trigger:...'`; unquoted length <= 250; no `'`, `"` or `|`; no `disable-model-invocation`; the five `## ` headings; each `required` token present; each `forbidden` string or pattern absent. Existing per-skill lists are preserved: pr-writing forbids `/topic/i` and `Co-Authored-By`; docs-writing forbids `/shitaku/i` and `Co-Authored-By`.

## Testing Strategy

Strict TDD, runner `pnpm test` (Vitest).

| Layer           | What to test                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Approach                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Unit (RED)      | `items.skills` and sorted skills dir entries equal `['docs-writing', 'example-skill', 'pr-writing', 'product-owner', 'socratic-method']`; `catalog.skills` length 5; `product-owner` loads with non-empty description and `files` `['SKILL.md']`; `catalog.issues` empty                                                                                                                                                                                     | Edit the existing skills `it` (title lists five skills); observe failure                                           |
| Unit (RED)      | Raw `product-owner/SKILL.md`: exactly two frontmatter lines, `name: product-owner` and `description: 'Trigger:...'`; unquoted length <= 250; no `'`, `"` or `\|`; no `disable-model-invocation`; five `## ` headings; raw contains `Given`, `When`, `Then`, `acceptance criteria`, `user stor`, `MoSCoW`, `MVP`, `success metric`, `roadmap`, `tech lead`, `Not for technical design`; raw does not contain `Co-Authored-By` or `shitaku` (case-insensitive) | New `it('keeps the product-owner skill content contract')` after the docs-writing one; `readFileSync`              |
| Unit (REFACTOR) | Three content-contract tests share one file-local helper with identical assertions                                                                                                                                                                                                                                                                                                                                                                           | Same test count, all green before and after                                                                        |
| Unchanged       | `web` and `backend` profile resolution still `skills: []`                                                                                                                                                                                                                                                                                                                                                                                                    | Existing tests pass untouched (proves no profile change)                                                           |
| Integration     | `init --skills product-owner --scope project --dry-run` plans `create`                                                                                                                                                                                                                                                                                                                                                                                       | Manual at verify: `pnpm run build`, then `node dist/main.js init --skills product-owner --scope project --dry-run` |
| Docs            | README and website pages in sync                                                                                                                                                                                                                                                                                                                                                                                                                             | `pnpm run docs:catalog:check`, `pnpm run docs:website-catalog:check`                                               |

RED expectation: the skills test fails on the list mismatch and the content test fails with `ENOENT` before the skill exists. Full gate: `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`. `test/generators.test.ts` uses a sandboxed catalog and is unaffected.

## Task Ordering and Commit Plan

1. RED: update `bundled-catalog.test.ts` (skills list test and new content test); run `pnpm test`; record failures.
2. GREEN: create `catalog/skills/product-owner/SKILL.md`; add the `catalog.json` entry; `pnpm test` passes.
3. REFACTOR: extract the file-local content-contract helper; `pnpm test` still green with the same test count.
4. `pnpm run format:check` and `pnpm run lint` (fix touched files only).
5. Commit 1: `feat(catalog): add product-owner skill` (test, SKILL.md, catalog.json).
6. Run `pnpm run docs:catalog`, then `pnpm run docs:website-catalog`; run both `:check` scripts.
7. Commit 2: `docs: list product-owner skill in README and website` (README.md, two website pages).
8. Dry-run acceptance (manual, at verify).

Single PR. Authored lines: about 50-65 (SKILL.md) + 1 (catalog.json) + about 40-60 (tests, including refactor deletions), well under 400; generated docs excluded. At delivery, annotate issue #17 with the profile deviation.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The change adds catalog data, tests and generated docs only.

## Migration / Rollout

No migration required. Existing installs are unaffected; users opt in with `init --skills product-owner`.

## Open Questions

- [ ] Final description wording must stay free of apostrophes, double quotes and pipes and at most 250 characters; enforced by the content-contract test, non-blocking.
- [ ] REFACTOR helper extraction is optional; drop it if zero churn on existing tests is preferred (non-blocking).
