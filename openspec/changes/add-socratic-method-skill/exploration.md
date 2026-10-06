## Exploration: add-socratic-method-skill (issue #182)

**Verdict:** Catalog skill install path is ready (byte-identical copy, `example-skill` pattern). True install-time tone substitution does **not** exist today — `${VAR}` is MCP-secret only; profiles list skill names and are not installable via `init`. Ready for proposal after choosing a tone strategy among the approaches below.

### Current State

#### How catalog skills are added today

| Step          | Evidence                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| Layout        | `catalog/skills/<name>/SKILL.md` (+ optional resources); CONTRIBUTING “Add a skill”                        |
| Index         | `catalog/catalog.json` → `items.skills` (today: `["example-skill"]` only)                                  |
| Load/validate | `FolderCatalogSource` + `parseSkill` (`src/domain/catalog/skill.ts`)                                       |
| Plan/install  | `buildSkillPlan` → `init-mcps` writes `skill.files` bytes as-is; tree hash for create/skip/update/conflict |
| Spec contract | `openspec/specs/skills-install`: “Every file … MUST be installed … **byte-identical**”                     |
| Guard test    | `test/adapters/catalog/bundled-catalog.test.ts` asserts exact skill list/count and frontmatter             |
| Reference     | `catalog/skills/example-skill/SKILL.md` (minimal name + description + short body)                          |

#### Placeholders / prompt stubs / install-time substitution

| Mechanism                                         | Status for skills                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `${VAR}` / `${VAR:-default}`                      | Domain module `src/domain/placeholders.ts` + zod MCP schema — **MCP headers/env only**. Not applied to skill trees. |
| Skill file transform at install                   | **None.** Install copies catalog bytes; plan hashes the same bytes.                                                 |
| Prompt stubs / mustache / `{{TONE}}`              | **None** in skill path.                                                                                             |
| Interactive skill options beyond name multiselect | `clack-prompter.selectSkills` only picks skill **names** (label + description hint).                                |

Implication: leaving `${TONE}` (or similar) inside `SKILL.md` would install literally, not substitute — unless this change also adds a new product feature.

#### Profiles and tone options

| Concern          | Status                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Profile schema   | `name`, `description?`, `extends`, `mcps`, `skills`, `scripts` — **no options map**                                           |
| Resolution       | Merges parent skill **names** only (`resolveProfile`)                                                                         |
| Install via CLI  | Spec: “Applying profiles in `init` is **out of scope**; resolution only.” CONTRIBUTING: “The CLI cannot select a profile yet” |
| Current profiles | `base` / `web` / `backend` — skills arrays empty                                                                              |

Implication: “catalog/profile option” for tone is **not available** without new schema + init UX (+ likely profile install work).

#### Docs regeneration

After adding/changing a skill:

```sh
pnpm run docs:catalog          # README tables (CI: docs:catalog:check)
pnpm run docs:website-catalog  # website/src/content/docs/{en,es}/catalog/ (CI website workflow + :check)
```

Generators read `catalog.json` and skill frontmatter `description:` (single-line). No code changes expected for a new skill unless tables/pages need regen commit.

#### Frontmatter constraints (tone encoding)

From `parseSkill` / CONTRIBUTING / catalog spec:

- Required: single-line `name` (must match directory) and non-empty `description`.
- Only single-line `key: value` scalars; multi-line (`|`, `>`, indented) **rejected**.
- Extra keys are read into a map; zod validates only `name`+`description` — **extra single-line keys stay in the file bytes** (byte-identical install). Safe to omit `disable-model-invocation` entirely (required: do **not** set `true`).
- Description for website emitter must remain one physical line.
- No repo `docs/skill-style-guide.md`; follow skill-creator inline rules: concise body, trigger words in `description`, imperative instructions.

#### Related issue dependency

- #15 installable skills — shipped (skills-install + example-skill).
- #183 `socratic-challenger` — consumer that preloads this skill; out of scope for content, but skill must remain model-invocable (no `disable-model-invocation: true`).

### Affected Areas

- `catalog/skills/socratic-method/SKILL.md` — new skill (and possibly a second tone variant)
- `catalog/catalog.json` — register skill name(s) under `items.skills`
- `test/adapters/catalog/bundled-catalog.test.ts` — expect new skill(s) loaded
- `README.md` + `website/src/content/docs/{en,es}/catalog/skills/*` — regenerated via docs scripts
- `CONTRIBUTING.md` — only if tone mechanism needs documented install UX (optional)
- **If install-time stubs chosen:** `src/domain/plan/skill-plan.ts`, `src/application/init-mcps.ts`, `src/adapters/cli/clack-prompter.ts`, ports/prompter, catalog skill schema, skills-install + catalog specs, many tests — **product change**, not catalog-only

**Not affected for catalog-only path:** MCP placeholder domain, hexagonal layers beyond catalog data, profile install.

### Approaches

1. **Dual catalog skills (tone = which skill you install)** — Ship `socratic-method` (e.g. coach default) and `socratic-method-advocate` (devil’s advocate), same method body, different Tone section. User picks via `init --skills` / multiselect.
   - Pros: Satisfies “configurable at install” with **zero** product code; byte-identical contract intact; preloadable by #183 by name; stays inside catalog change budget.
   - Cons: Two near-duplicate files to maintain; catalog noise; spectrum is discrete, not continuous.
   - Effort: **Low**

2. **Single skill + runtime tone protocol** — One `SKILL.md`; default tone in body; Decision Gate: user/agent may say “devil’s advocate” / “coach” per session. No install transform.
   - Pros: Minimal catalog surface; matches “generic method”; easy for #183 to preload one name.
   - Cons: **Does not meet AC #3 as written** (“at install” / installed file reflects choice) unless AC is renegotiated.
   - Effort: **Low**

3. **Install-time prompt stub / skill templating** — Catalog ships `SKILL.md` with a stub (e.g. `{{TONE_BLOCK}}` or `${SOCRATIC_TONE}`); `init` prompts for tone (or flag) and writes substituted bytes; hash/manifest track post-render content.
   - Pros: Full AC #3; installed file carries tone; single skill name for #183.
   - Cons: Breaks today’s “byte-identical to catalog” assumption unless catalog stores template + rendered hash rules; touches plan/apply/prompter/docs/specs; high review-budget risk; likely needs chained PRs (foundation then skill).
   - Effort: **High**

4. **Profile option field** — Extend `ProfileSchema` with per-skill options / tone; resolve at profile apply time.
   - Pros: Matches issue’s “profile option” wording.
   - Cons: Profiles are **not installable** yet; no options schema; larger than #182; blocked on profile-init work.
   - Effort: **High** (plus dependency)

### Recommendation

Prefer **Approach 1 (dual skills)** if AC #3 must stay literal without expanding product scope; prefer **Approach 2 (single skill + runtime tone)** if the user accepts renegotiating AC #3 to “tone selectable when the skill runs / when preloaded.”

Do **not** start Approach 3/4 inside the same PR as first skill content unless proposal explicitly scopes a **chained** delivery: (A) skill templating/options foundation → (B) `socratic-method` content. Session preflight already chose `auto-chain` / stacked-to-main / 400-line budget — catalog-only dual or single skill fits one small PR; templating does not.

Skill content (either path): English, concise, generic Socratic method only; forbid implementing features or silently rewriting the artifact; optional short decision summary after a question round; omit `disable-model-invocation`.

### Risks

- **AC #3 vs product reality:** Install-time tone is not implementable as catalog-only; proposal must pick dual-skill, runtime tone (AC amend), or scoped product work.
- **Byte-identical / hash semantics:** Any post-catalog rewrite changes conflict/update/undo behavior and needs explicit design.
- **Duplicate maintenance (dual skills):** Drift between coach/advocate copies.
- **#183 coupling:** Challenger agent must know which skill name(s) to preload if dual.
- **Frontmatter description length:** Keep one line, trigger-rich, ≤250 chars for skill-creator hygiene and website emitter.

### Ready for Proposal

**Yes** — after the orchestrator confirms the tone strategy (dual skills vs runtime tone vs chained templating). No further codebase research required for a catalog-only proposal; templating would need a design phase with explicit scope.
