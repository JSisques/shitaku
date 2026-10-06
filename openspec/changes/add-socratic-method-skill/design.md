# Design: Add socratic-method Catalog Skill

## Technical Approach

Ship one catalog skill via the existing CONTRIBUTING “Add a skill” path: `SKILL.md` + `catalog.json` registration + bundled-catalog guard + docs regen. No `src/` changes. Reuses `FolderCatalogSource` / `parseSkill` / byte-identical skills-install. Maps to proposal scope and `socratic-method-skill` requirements (registration, generic method, fixed coaching tone, model-invocable, dry-run create, catalog-only surface).

## Architecture Decisions

| Decision         | Options                                                              | Tradeoff                                                                                             | Choice                                                                                                                            |
| ---------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Tone strategy    | Dual skills / runtime gate / install templating / single fixed coach | Dual = maintenance; templating = `src/` + breaks byte-identical; runtime alone weakens fixed-tone AC | **Single skill, fixed question-first coaching tone in body** (install tone deferred)                                              |
| Surface          | Catalog-only vs product tone UX                                      | Product needs plan/prompter/schema work                                                              | **Catalog data + test + docs only**                                                                                               |
| Model invocation | Omit key vs `disable-model-invocation: false` vs `true`              | `true` blocks #183 preload                                                                           | **Omit key** (never `true`)                                                                                                       |
| Skill shape      | Minimal like `example-skill` vs skill-creator sections               | Example is too thin for method guidance                                                              | **skill-creator sections** (Activation, Hard Rules, Decision Gates, Execution Steps, Output Contract); English; ≤~700 body tokens |
| Supporting files | `assets/` / `references/` vs SKILL-only                              | Extra files raise tree size with little install value                                                | **SKILL.md only** (mirror `example-skill` file set)                                                                               |
| Delivery         | One PR vs chained                                                    | Authored diff expected well under 400 lines                                                          | **One PR** (`auto-chain` / stacked-to-main ready if docs bloat)                                                                   |

## Data Flow

```
catalog/skills/socratic-method/SKILL.md
        │
        ▼
catalog.json items.skills ──► FolderCatalogSource.load()
        │                              │
        │                              ▼
        │                       parseSkill(dir, files)
        │                              │
        ▼                              ▼
bundled-catalog.test.ts          init --skills socratic-method
                                           │
                     dry-run → plan action create (no writes)
                     apply   → byte-identical skill tree + manifest
```

Docs: `docs:catalog` → README tables; `docs:website-catalog` → `website/.../catalog/skills/socratic-method.md` (en/es).

## File Changes

| File                                                                 | Action | Description                                                                                                                      |
| -------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `catalog/skills/socratic-method/SKILL.md`                            | Create | Frontmatter `name: socratic-method` + trigger-rich one-line `description`; coaching Socratic body; no `disable-model-invocation` |
| `catalog/catalog.json`                                               | Modify | `items.skills`: `["example-skill", "socratic-method"]`                                                                           |
| `test/adapters/catalog/bundled-catalog.test.ts`                      | Modify | Expect length 2; assert both skills load with frontmatter                                                                        |
| `README.md`                                                          | Modify | Via `pnpm run docs:catalog`                                                                                                      |
| `website/src/content/docs/{en,es}/catalog/skills/socratic-method.md` | Create | Via `pnpm run docs:website-catalog`                                                                                              |
| `src/**`                                                             | None   | Catalog-only                                                                                                                     |

## Interfaces / Contracts

No new TypeScript types. Existing contracts:

- Frontmatter: single-line `name` + non-empty `description`; `name ===` directory (`parseSkill`).
- Install: skills-install byte-identical copy (unchanged).
- Description: one physical line, ≤250 chars, trigger words first (skill-creator + website emitter).

Skill body contracts (content, not code):

1. Question assumptions / gaps before implement or rewrite.
2. Do not silently change user artifacts; wait for explicit go-ahead.
3. Fixed coaching tone (guide via questions, not adversarial rewrite).

## Testing Strategy

| Layer        | What to Test                                        | Approach                                                                                                     |
| ------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Unit/adapter | Bundled load lists both skills; frontmatter present | Extend `bundled-catalog.test.ts` (strict TDD: fail count/list first)                                         |
| Integration  | Dry-run create when absent                          | Manual/CI: `node dist/main.js init --skills socratic-method --scope project --dry-run` → `create`, no writes |
| Docs         | README + website catalog in sync                    | `docs:catalog:check`, `docs:website-catalog:check`                                                           |
| E2E          | —                                                   | N/A (project e2e off); rely on existing skills-install                                                       |

Content ACs (no `disable-model-invocation: true`, coaching tone, no templating) verified by review + file inspection in apply/verify.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Catalog markdown + index + guard test only.

## Migration / Rollout

No migration. New optional catalog item. Rollback: revert skill dir, `catalog.json`, test, regen docs. Installed copies: `undo` or delete target skill dir.

## Open Questions

None — tone strategy and catalog-only scope confirmed.
