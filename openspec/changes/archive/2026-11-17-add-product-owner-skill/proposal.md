# Proposal: Add Product Owner skill

Source: GitHub issue #17 ("feat: add Product Owner skill"). Exploration: `exploration.md` and Engram `sdd/add-product-owner-skill/explore`.

## Intent

The catalog has no skill that guides an agent through product ownership work: defining vision and goals, shaping a backlog, writing user stories with testable acceptance criteria, prioritizing, scoping an MVP and planning releases. Users who install shitaku skills must write this guidance themselves. Issue #17 asks for a bundled, generic `product-owner` skill installable like the existing ones.

## Scope

### In Scope

- New `catalog/skills/product-owner/SKILL.md`: generic, concise English, no mention of "shitaku", model-invocable.
  - Frontmatter: exactly `name: product-owner` and `description: 'Trigger: ...'` (single-quoted, at most 250 characters, no quotes or pipes inside).
  - Body: the five standard sections (Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract).
  - Content: product vision and goals; backlog with epics and user stories; acceptance criteria in Given/When/Then; prioritization (value vs effort, MoSCoW); MVP definition and success metrics; roadmap and release planning; a generic handoff to a tech lead for feasibility and estimates, with no hard dependency on any other skill.
- Register `product-owner` in `catalog/catalog.json` under `items.skills` only (alphabetical: docs-writing, example-skill, pr-writing, product-owner, socratic-method).
- Install via the existing `init --skills product-owner` path; no CLI change.
- Tests first (strict TDD) in `test/adapters/catalog/bundled-catalog.test.ts`: skill list, count 4 to 5, entry `files: ['SKILL.md']`, and a content-contract test mirroring the docs-writing one (frontmatter shape, description constraints, five sections, no "shitaku", key topics present).
- Regenerate README skills table and website catalog pages (en, es) with `pnpm run docs:catalog` and `pnpm run docs:website-catalog`; never hand-edit generated output.

### Out of Scope

- **No profile change (deliberate deviation from issue #17).** The issue says "Include it in a profile". By explicit user decision, the skill is NOT added to any existing profile and NO new profile is created. Rationale: profiles are browse-only today (no `--profile` CLI flag) and the user expects profiles to be removed eventually. Issue #17 should be annotated to record this deviation.
- Any `src/` change (all hexagonal layers untouched: domain, ports, application, adapters, `main.ts`).
- A tech-lead skill or any cross-skill dependency.
- Changes to other skills, MCPs or profiles.

## Capabilities

### New Capabilities

- `product-owner-skill`: bundled generic `product-owner` skill: registration and frontmatter contract, required content (vision, backlog, user stories, Given/When/Then acceptance criteria, prioritization, MVP and metrics, roadmap, generic tech-lead handoff), model-invocable and generic, installable via existing skills-install, catalog-only surface with synced generated docs, no profile membership.

### Modified Capabilities

None. Installation behavior is covered by the existing `skills-install` and `catalog` specs without requirement changes; the new spec references them, following the `docs-writing-skill` precedent.

## Approach

Follow the `docs-writing` precedent (catalog data + tests + regenerated docs):

1. RED: extend `bundled-catalog.test.ts` with the new list, count and content-contract assertions; confirm they fail.
2. GREEN: add `catalog/skills/product-owner/SKILL.md` and the `items.skills` entry.
3. Run both docs generators and their check scripts so README and website en/es list the skill.
4. Verify with `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`.

Affected hexagonal layers: none. The change is catalog data, tests and generated docs only.

## Affected Areas

| Area                                                               | Impact               | Description                                   |
| ------------------------------------------------------------------ | -------------------- | --------------------------------------------- |
| `catalog/skills/product-owner/SKILL.md`                            | New                  | Skill content                                 |
| `catalog/catalog.json`                                             | Modified             | Add `product-owner` to `items.skills`         |
| `test/adapters/catalog/bundled-catalog.test.ts`                    | Modified             | List, count, entry and content-contract tests |
| `README.md`                                                        | Modified (generated) | Skills table between catalog markers          |
| `website/src/content/docs/{en,es}/catalog/skills/product-owner.md` | New (generated)      | Website catalog pages                         |
| `catalog/profiles/*.json`                                          | Unchanged            | Explicitly not touched                        |
| `src/`                                                             | Unchanged            | No layer affected                             |

## Risks

| Risk                                                     | Likelihood | Mitigation                                                            |
| -------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| Description violates constraints (length, quotes, pipes) | Med        | Content-contract test asserts the same regex rules as existing skills |
| Generated docs drift fails CI                            | Med        | Run both generators and their `:check` scripts before commit          |
| Issue acceptance mismatch on "Include it in a profile"   | Med        | Recorded deviation here; annotate issue #17 at delivery               |
| Skill grows verbose or project-specific                  | Low        | Test forbids "shitaku"; keep sections concise                         |

## Rollback Plan

Revert the change commit(s): delete `catalog/skills/product-owner/`, remove the `items.skills` entry, revert the test edits, and re-run `pnpm run docs:catalog` and `pnpm run docs:website-catalog` to drop the README row and website pages. No runtime code, manifest format or profile is affected, so users who installed the skill keep a standalone folder removable with `undo`.

## Dependencies

- Existing skills-install (`init --skills`) — already available.
- Docs generators `scripts/generate-*` — already available.

## Success Criteria

- [ ] `catalog/skills/product-owner/SKILL.md` exists with valid frontmatter and the five standard sections, generic English, no "shitaku".
- [ ] `product-owner` loads from the bundled catalog and `init --skills product-owner --dry-run` classifies it as `create`.
- [ ] No profile file and no `src/` file changed.
- [ ] New tests were observed failing before implementation and pass after.
- [ ] `pnpm test`, `typecheck`, `lint`, `format:check`, `docs:catalog:check` and the website catalog check pass.
- [ ] README and website en/es list `product-owner`.
