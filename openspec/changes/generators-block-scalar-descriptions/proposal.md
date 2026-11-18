# Proposal: Block-Scalar Descriptions in Catalog Doc Generators

## Intent

`scripts/generate-catalog-table.mjs` (README tables) and `scripts/generate-website-catalog.mjs` (website pages, en and es) each carry their own line-based `frontmatterDescription()`: find the first line starting with `description:` and strip quotes. Since `agent-block-scalars` (#238/#293), agents may write `description: |` or `description: >`, and the domain reader decodes them. The generators would render the literal `|` or `>` instead of the text. No bundled agent uses a block scalar today, so no output is wrong yet, but the first such agent would ship broken docs and the check scripts would bless them.

Issue #301 (follow-up to SUGGESTION 2 of `agent-block-scalars`) asks the generators to read descriptions through the domain reader `src/domain/catalog/frontmatter.ts`, so there is one decoder, not three.

## Scope

### In Scope

- **Spike first (task 1)**: confirm that `node` from `.nvmrc` (22.23.3) imports `src/domain/catalog/frontmatter.ts` from an `.mjs` file via native type stripping, with no flag, and record whether an `ExperimentalWarning` appears on stderr and whether it affects `--check` runs or tests. If the spike fails, stop and return to the orchestrator before any other task.
- **Shared helper** `scripts/lib/frontmatter-description.mjs` (name final in design): imports `readFrontmatter` from `src/domain/catalog/frontmatter.ts` and exposes one description reader with a mode option:
  - `nested` (agents, rules): `readFrontmatter(..., { allowNested: true })`, then trim and collapse internal whitespace to single spaces, mirroring `parseAgent`.
  - `strict` (skills, commands): `readFrontmatter(...)` with default strict mode, same as the CLI loaders.
- Both generators replace their local `frontmatterDescription()` with the helper. No decoding logic remains in `scripts/`.
- **Byte-identical single-line output**: for every bundled catalog item (single-line descriptions), the README and website output stays unchanged; `docs:catalog:check` and `docs:website-catalog:check` pass with no regeneration diff.
- **Guard test** that keeps `src/domain/catalog/frontmatter.ts` import-free and erasable (no `import`/`export ... from` of other modules; no enums, namespaces, parameter properties or other non-erasable syntax), preferably by importing it under plain `node` in a spawned process, so a future edit that breaks the generators fails in `pnpm test` rather than in CI docs checks.
- **Sandbox update in `test/generators.test.ts`**: the sandbox copies only the two scripts today; it must also provide `scripts/lib/**` and `src/domain/catalog/frontmatter.ts`.
- **New generator fixtures** with `|` and `>` descriptions (agents, and rules where the generator renders them) asserting decoded, single-line text in the README table and website pages in en and es.
- **`.github/workflows/website.yml` path filter**: add `src/domain/catalog/frontmatter.ts` and `scripts/lib/**` to the `push` and `pull_request` `paths` lists.
- **Node floor alignment (user decision, 2026-11-18)**: raise the documented and enforced Node floor to `>=22.18` everywhere it is stated: `package.json` `engines.node` (replacing the invalid `v26.10.0` with `>=22.18`), `README.md` (badge and "Requires Node"), `CONTRIBUTING.md` (requirements, script entry notes, and the `.nvmrc` pin, which is verified against the real file), `AGENTS.md`, and `openspec/config.yaml`. Any test that guards these values (for example `test/tooling.test.ts`) is updated in the same change. This raises the CLI's published minimum, so the commit uses a visible message and the PR body calls it out.
- Strict TDD: RED fixtures and guard test before the helper and wiring.

### Out of Scope

- Changes to `src/domain/catalog/frontmatter.ts` behavior, `agent.ts`, `rule.ts`, `skill.ts`, `command.ts`, or any port, application or adapter code.
- Block-scalar support in strict mode (skills, commands).
- New dependencies (`tsx`, `yaml`, etc.) or a build step before the docs scripts; `ci.yml` step order stays as is.
- Importing from `dist/` (exploration approach B), reimplementing the decoder in `.mjs` (approach D).
- Reading other frontmatter fields (`name`, etc.) through the domain reader.

## Capabilities

### New Capabilities

- `catalog-docs-generators`: the README catalog table generator and the website catalog emitter read item descriptions through the domain frontmatter reader (nested mode with whitespace collapse for agents and rules, strict mode for skills and commands), with no decoder duplicated in `scripts/`, byte-identical output for single-line descriptions, and a guard keeping the domain reader importable by plain Node.

### Modified Capabilities

- `website`: "Catalog emitter and profiles" gains a scenario that block-scalar (`|`, `>`) descriptions render as decoded single-line text on en and es pages. "Isolated website workflow and root gates" keeps `src/` unchanged; the workflow `paths` filter now also covers `src/domain/catalog/frontmatter.ts` and `scripts/lib/**`.

## Approach

Exploration approach A, approved by the user: the generators import the TypeScript domain reader directly through Node native type stripping. `frontmatter.ts` has no imports and only erasable syntax, so plain `node` can load it with no build and no new dependency, and CI order (docs check before build) stays intact. A single helper under `scripts/lib/` owns the mode selection and whitespace collapse, which removes the duplicated function in both scripts.

Mode per kind follows the CLI loaders: agents and rules use nested mode (as `agent.ts` and `rule.ts` do) and collapse whitespace like `parseAgent`; skills and commands use strict mode (as `skill.ts` and `command.ts` do).

**Behavior change for skills and commands**: today the generators accept any file with a `description:` line; with strict mode they use the same parser as the CLI. A skill or command whose frontmatter the CLI rejects would now fail the generator instead of producing a row. Proposed behavior: the generator exits non-zero naming the file and the reader issue, because docs should not list an item the CLI cannot load. All bundled items already pass the CLI loaders, so no output changes. Design confirms the exact error format.

Order of work:

1. Spike (Node 22.23.3 import of `.ts` from `.mjs`; warning behavior).
2. RED: guard test, generator fixtures with `|`/`>` for README and en/es pages, sandbox update.
3. GREEN: helper in `scripts/lib/`, wire both generators, remove local decoders.
4. `website.yml` path filter.
5. Regenerate and confirm no diff in README and website catalog pages.

Suggested commits: `test(scripts): cover block-scalar descriptions in generators`, `refactor(scripts): read descriptions through domain frontmatter reader`, `ci(website): watch frontmatter reader and scripts lib`.

## Affected Areas

Hexagonal layers: none changed in `src/`. The domain reader `src/domain/catalog/frontmatter.ts` gains a new consumer (scripts) and a test guard, but its code does not change.

| Area                                                                                            | Impact   | Description                                                                         |
| ----------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `scripts/lib/frontmatter-description.mjs`                                                       | New      | Shared description reader (nested/strict modes) over the domain reader              |
| `scripts/generate-catalog-table.mjs`                                                            | Modified | Uses the helper; local `frontmatterDescription()` removed                           |
| `scripts/generate-website-catalog.mjs`                                                          | Modified | Uses the helper; local `frontmatterDescription()` removed                           |
| `test/generators.test.ts`                                                                       | Modified | Sandbox provides `scripts/lib/**` and `frontmatter.ts`; literal and folded fixtures |
| `test/` guard (file name in design, e.g. `test/domain/catalog/frontmatter-portability.test.ts`) | New      | Keeps `frontmatter.ts` import-free and loadable by plain Node                       |
| `.github/workflows/website.yml`                                                                 | Modified | `paths` filter adds `src/domain/catalog/frontmatter.ts` and `scripts/lib/**`        |
| `src/domain/catalog/frontmatter.ts`                                                             | None     | Consumed, not changed                                                               |
| `README.md`, `website/src/content/docs/**` generated pages                                      | None     | Must regenerate byte-identical                                                      |
| `openspec/changes/generators-block-scalar-descriptions/specs/...`                               | New      | Specs for `catalog-docs-generators` and delta for `website`                         |

## Risks

| Risk                                                                                                                                                                                                                                                                              | Likelihood | Mitigation                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native type stripping fails or behaves differently on Node 22.23.3                                                                                                                                                                                                                | Low        | Spike is task 1; stop and report before other work if it fails                                                                                                                                                                                                                                                                                   |
| `ExperimentalWarning` on stderr breaks tests that assert empty stderr or clutters CI                                                                                                                                                                                              | Med        | Spike records it; design decides between tolerating it in tests or suppressing it narrowly for the generator process                                                                                                                                                                                                                             |
| A future edit adds an import or non-erasable syntax to `frontmatter.ts`, breaking generators only in CI docs steps                                                                                                                                                                | Med        | Guard test in `pnpm test`                                                                                                                                                                                                                                                                                                                        |
| Strict mode makes the generators reject a skill or command they used to list                                                                                                                                                                                                      | Low        | Same parser as the CLI; bundled items already load; error names the file                                                                                                                                                                                                                                                                         |
| Whitespace collapse or unquoting differs from the old regex for single-line values, changing README or website bytes                                                                                                                                                              | Med        | Regenerate in `--check` mode on the full bundled catalog; byte-identical is a success criterion                                                                                                                                                                                                                                                  |
| Website workflow does not run when only the reader or helper changes                                                                                                                                                                                                              | Low        | `paths` filter update                                                                                                                                                                                                                                                                                                                            |
| **Node version floor inconsistency**: `.nvmrc` is 22.23.3, AGENTS.md and `openspec/config.yaml` say `>=22.13`, `package.json` `engines.node` is the exact string `v26.10.0`. Native type stripping is unflagged only from 22.18, so the docs scripts would not run on 22.13-22.17 | Med        | **Decided by the user**: align everything to `>=22.18` (see In Scope). Trade-off accepted: the CLI runtime (built `dist/`) does not need type stripping, but its published minimum rises from 22.13 to 22.18, dropping 22.13-22.17 users. Mitigate by calling it out in the commit and PR body, and by updating any guard test over these values |

## Rollback Plan

Revert the PR (or its commits). That restores the per-script `frontmatterDescription()` functions, the previous sandbox in `test/generators.test.ts`, and the previous `website.yml` filter, and removes `scripts/lib/` and the guard test. Generated README and website pages are byte-identical before and after, so no regeneration is needed on rollback. No `src/`, manifest, install-output, or published package impact (`scripts/` is a dev tool).

## Dependencies

- Shipped `agent-block-scalars` decoder in `src/domain/catalog/frontmatter.ts` (archived 2026-11-18).
- Node with unflagged type stripping (>= 22.18; `.nvmrc` 22.23.3 used by CI).
- No new runtime or dev dependency.

## Review Workload Forecast

Rough authored lines: helper ~30-45, generator edits ~20-40 (mostly deletions), tests ~80-130 (fixtures, sandbox, guard), workflow ~4, Node floor docs/config ~10-20, specs ~40-60. Total ~190-300, under the 400-line budget. 400-line budget risk: Low. Chained PRs recommended: No. Decision needed before apply: No (Node floor decided: `>=22.18` everywhere).

## Success Criteria

- [ ] Spike confirms plain `node` (`.nvmrc` 22.23.3) imports `frontmatter.ts` from an `.mjs` script, with warning behavior recorded
- [ ] Fixtures with `description: |` and `description: >` render decoded, single-line text in the README table and website pages in en and es
- [ ] For the bundled catalog, `docs:catalog:check` and `docs:website-catalog:check` pass with no diff (single-line output byte-identical)
- [ ] No description or block-scalar decoding logic exists in `scripts/` outside the shared helper's call to `readFrontmatter`; both local `frontmatterDescription()` functions are gone
- [ ] Agents and rules use nested mode with whitespace collapse; skills and commands use strict mode
- [ ] Guard test fails if `frontmatter.ts` gains an import or non-erasable syntax
- [ ] `test/generators.test.ts` sandbox includes `scripts/lib/**` and `src/domain/catalog/frontmatter.ts`
- [ ] `website.yml` `paths` includes `src/domain/catalog/frontmatter.ts` and `scripts/lib/**`
- [ ] RED observed before GREEN for the new fixtures and guard
- [ ] No new dependency in `package.json`; `src/` unchanged; architecture test passes
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run build` pass
- [ ] `package.json` `engines.node`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md` and `openspec/config.yaml` all state `>=22.18`; `.nvmrc` and CONTRIBUTING agree on the pinned version; no guard test fails
