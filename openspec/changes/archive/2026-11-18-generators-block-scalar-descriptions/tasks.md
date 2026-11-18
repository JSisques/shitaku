# Tasks: Block-Scalar Descriptions in Catalog Doc Generators

## Review Workload Forecast

| Field                   | Value                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | ~250-320 (helper ~35, generator edits ~40 mostly deletions, tests ~130-160, workflow ~4, Node floor docs/config ~20) |
| 400-line budget risk    | Low                                                                                                                  |
| Chained PRs recommended | No                                                                                                                   |
| Suggested split         | Single PR, 4 commits (unit 1 is a spike with no commit)                                                              |
| Delivery strategy       | ask-on-risk                                                                                                          |
| Chain strategy          | pending (not needed)                                                                                                 |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal                                                                       | Likely PR        | Focused test command                                                  | Runtime harness                                                                                         | Rollback boundary                                               |
| ---- | -------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1    | Spike: plain Node 22.23.3 imports `frontmatter.ts` from `.mjs` (no commit) | PR 1 (no commit) | N/A (scratch commands)                                                | `node -e "import('./src/domain/catalog/frontmatter.ts')..."` and a scratch `.mjs` import; record stderr | Nothing committed                                               |
| 2    | Portability guard test                                                     | PR 1             | `pnpm vitest run test/domain/catalog/frontmatter-portability.test.ts` | The test spawns plain `node` without `NODE_OPTIONS`                                                     | Remove the new test file                                        |
| 3    | Shared helper, both generators wired, sandbox and fixtures                 | PR 1             | `pnpm vitest run test/generators.test.ts`                             | `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check` with no diff                    | Revert the commit: restores per-script decoders and old sandbox |
| 4    | `website.yml` path filter plus assertion                                   | PR 1             | `pnpm vitest run test/release-config.test.ts`                         | N/A: workflow YAML is read as text by the test                                                          | Revert the commit (workflow and assertion only)                 |
| 5    | Node floor `>=22.18` everywhere                                            | PR 1             | `pnpm vitest run test/release-config.test.ts`                         | `pnpm run build` and `pnpm run docs:catalog:check`                                                      | Revert the commit (manifest and docs text only)                 |

Threat matrix: all rows `N/A` in design (no git, PR, shell or classification boundary changes). No threat-matrix RED tasks.

TDD: strict. Test runner `pnpm run test` (vitest). Record each observed RED in the Evidence line of its task before the GREEN step.

## Phase 1: Spike (work unit 1, no commit)

- [x] 1.1 Switch to Node 22.23.3 (`.nvmrc`, `read-only` for `.nvmrc`): run `node -v` and confirm it matches `.nvmrc`.
- [x] 1.2 Run `node -e "import('./src/domain/catalog/frontmatter.ts').then(m => console.log(typeof m.readFrontmatter))"` from the repo root. Expect `function`. Record whether stderr shows an `ExperimentalWarning`.
- [x] 1.3 Create a scratch `.mjs` under the scratchpad directory (not in the repo) that statically imports the repo's `src/domain/catalog/frontmatter.ts` and decodes `description: |`. Run it with plain `node`. Record the result and stderr.
- [x] 1.4 Gate: if either import fails, STOP and report to the orchestrator before any other task. Otherwise record the warning observation under Evidence below and continue. Do not add `--no-warnings` or suppression (design decision).

Evidence (spike): Node 22.23.3 (installed via npm package `node@22.23.3` in the scratchpad; no fnm/nvm on host, host default is v26.7.0), `NODE_OPTIONS` empty. `import('./src/domain/catalog/frontmatter.ts')` via `node -e` printed `function`; a scratch `.mjs` outside the repo statically importing `frontmatter.ts` also loaded. Both with plain `node`, no flags; stderr empty (no ExperimentalWarning observed). Note: current `readFrontmatter` on `description: |` returns the issue "multi-line or empty value" (expected; block scalar support not yet added).

## Phase 2: Portability guard (work unit 2)

Commit: `test(scripts): guard frontmatter reader portability`

- [x] 2.1 RED/GREEN setup: create `test/domain/catalog/frontmatter-portability.test.ts` with (a) a static scan asserting `src/domain/catalog/frontmatter.ts` has no module specifiers (same `from` / `import(` / `import '...'` regex shape as `test/architecture.test.ts`; failure message names the file and says the docs generators load it under plain Node), and (b) a `spawnSync(process.execPath, ['--input-type=module', '-e', script])` check with `env` equal to `process.env` minus `NODE_OPTIONS`. The inline script imports the file via `pathToFileURL(...).href`, calls `readFrontmatter('---\ndescription: |\n  a\n  b\n---\n', 'x.md', { allowNested: true })` and writes `JSON.stringify(result.data)`. Expect exit 0 and stdout `{"description":"a\nb\n"}`. Spec: "Guard passes".
- [x] 2.2 Run `pnpm vitest run test/domain/catalog/frontmatter-portability.test.ts`. Expect green immediately (the code is already portable).
- [x] 2.3 Scratch-mutation RED: temporarily add `import { x } from '@/domain/catalog/listing.js';` and then an `enum` to `src/domain/catalog/frontmatter.ts`, run the test, observe both checks fail, then revert with `git checkout -- src/domain/catalog/frontmatter.ts`. Record the failures as Evidence. Spec: "Guard fails on regression".
- [x] 2.4 Verify `git diff --stat -- src/` is empty, then run `pnpm run lint`, `pnpm run format:check`, `pnpm run typecheck`, `pnpm run test`. Commit with the message above.

Evidence (RED mutation): Test green first (2/2). With `import { x } from '@/domain/catalog/listing.js';` plus `enum Scratch { A }` prepended to `frontmatter.ts`, both checks failed: static scan got `['@/domain/catalog/listing.js']` with the named message; runtime check showed `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: TypeScript enum is not supported in strip-only mode`. Reverted via `git checkout`; `git diff --stat -- src/` empty. Commit 3c33575. Note: lint, typecheck and full suite (62 files, 1659 tests) green; `format:check` flags only the 3 untracked openspec change docs (design, proposal, tasks), not committed here. Worktree needed `pnpm install --frozen-lockfile` first.

## Phase 3: Shared helper and generators (work unit 3)

Commit: `refactor(scripts): read descriptions through domain frontmatter reader`

RED first (sandbox and fixtures):

- [x] 3.1 In `test/generators.test.ts`, update the sandbox: copy the two generators, `scripts/lib/` (recursive `cpSync`) and `src/domain/catalog/frontmatter.ts`; write a sandbox `package.json` containing `{"type":"module"}`; keep the `node_modules` symlink and `.prettierrc` copy. `scripts/lib/` does not exist until 3.4, so make the `cpSync` of `scripts/lib/` conditional on it existing for now; remove the condition in 3.4 once the directory exists. Run `pnpm vitest run test/generators.test.ts` and confirm the existing tests stay green.
- [x] 3.2 RED test, agent literal: add a case where an agent fixture has `description: |` with an indented two-line body (`Review code` / `carefully`). Assert the README table row and the en and es pages (frontmatter `description:` and body) contain `Review code carefully` and never a bare `|`. Run and observe RED (today renders `|`). Spec: "Agent literal block scalar".
- [x] 3.3 RED tests, agent folded, rule, strict failure: (a) agent with `description: >` folded single-line text in README and en/es; (b) rule with `description: >` (and one with `|`) rendered as collapsed single-line text in README and en/es; (c) command with `description: |` via `box.write` makes both generators exit 1 with `commands/<name>.md` and `multi-line` in stderr, and emits no row or page for it (RED: today exits 0); (d) strict-kind single-line skill and command descriptions render unchanged. Observe RED for (a), (b), (c). Specs: "Agent folded block scalar", "Rule block scalar", "Rejected skill", "Strict kinds".

GREEN:

- [x] 3.4 Create `scripts/lib/frontmatter-description.mjs` exporting `itemDescription(catalogDir, kind, name)` per the design contract: static `import { readFrontmatter } from '../../src/domain/catalog/frontmatter.ts';`, kind table (skills/commands strict; agents/rules nested with `/\s+/g` collapse and trim), unknown kind throws `frontmatter-description: unknown kind '<kind>'`, reader issue throws `<label>: <issue>` (issue used as-is when it already starts with the label), blank or missing description throws `<label> has no description`.
- [x] 3.5 Modify `scripts/generate-catalog-table.mjs`: import `itemDescription`; delete `frontmatterDescription`, `skillDescription`, `commandDescription`, `agentDescription`, `ruleDescription`; `DESCRIBE` entries call `itemDescription(catalogDir, '<kind>', name)`. Keep the existing top-level `catch` (stderr `<script>: <message>`, exit 1) and the pipe-escape in table cells.
- [x] 3.6 Modify `scripts/generate-website-catalog.mjs`: same removals; `renderSkill`, `renderCommand`, `renderAgent`, `renderRule` call the helper. Keep the existing top-level `catch`.
- [x] 3.7 Run `pnpm vitest run test/generators.test.ts` and observe all new and existing cases GREEN (single-line, pipe-escape, drift, empty-catalog unchanged). Record whether stderr shows an `ExperimentalWarning` in the sandbox run.
- [x] 3.8 Byte-identity check: run `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check`; both must pass with no diff (`git status --short README.md website/` clean). Spec: "Bundled catalog unchanged".
- [x] 3.9 Verify no decoder remains: `rg "frontmatterDescription|Description\(" scripts/` finds none outside the helper. Run `pnpm run lint`, `pnpm run format:check`, `pnpm run typecheck`, `pnpm run build`, `pnpm run test` (includes `test/architecture.test.ts`). Commit with the message above.

Evidence (RED 3.2/3.3): with the sandbox updated (3.1, 40 existing cases green after adding the new fixtures that did not need the helper), `pnpm exec vitest run test/generators.test.ts` gave `7 failed | 33 passed (40)`. RED cases: agent literal `|`, agent folded `>`, rule `>`, rule `|` (README row and pages still rendered a bare `|`/`>`), pipe-escape inside a block scalar, and the strict command block scalar for both generators (`expected +0 to be 1`, exit was 0). The strict single-line unchanged case stayed green, as expected (regression guard). One fixture adjustment: the README is prettier-formatted, so the "unchanged" fixture avoids internal double spaces.

Evidence (GREEN 3.4-3.9): after adding `scripts/lib/frontmatter-description.mjs` and wiring both generators, `pnpm exec vitest run test/generators.test.ts` gave `40 passed (40)` and the conditional `cpSync` was removed. No `ExperimentalWarning` appeared in the spawned generator runs or the `docs:*` runs (host Node v26.7.0; Node 22.18+ not exercised locally). `docs:catalog:check` and `docs:website-catalog:check` both report up to date with no diff in `README.md` or `website/`. `rg "frontmatterDescription|Description\("` finds only the retained `scriptDescription` (script.json, not frontmatter) and the helper call sites.

## Phase 4: CI path filter (work unit 4)

Commit: `ci(website): watch frontmatter reader and scripts lib`

- [x] 4.1 RED: in `test/release-config.test.ts`, add an assertion that `.github/workflows/website.yml` lists `src/domain/catalog/frontmatter.ts` and `scripts/lib/**` in both the `push` and `pull_request` `paths` blocks. Run `pnpm vitest run test/release-config.test.ts` and observe RED. Spec: "Path filter covers emitter dependencies".
- [x] 4.2 GREEN: edit `.github/workflows/website.yml` adding both paths to the `push` and `pull_request` `paths` lists. Re-run the focused test and observe GREEN.
- [x] 4.3 Run `pnpm run lint`, `pnpm run format:check`, `pnpm run test`. Commit with the message above.

Evidence (RED 4.1): `pnpm exec vitest run test/release-config.test.ts` failed 1 of 39 (new path-filter test: block lacked `- 'src/domain/catalog/frontmatter.ts'`). GREEN after workflow edit: 39/39. Full suite 62 files / 1668 tests passed; lint, typecheck, format:check, build clean. Commit 95a28df.

## Phase 5: Node floor (work unit 5)

Commit: `fix(engines): require Node >=22.18 and fix invalid engines range` (NO `!`, NO `BREAKING CHANGE` footer; patch release). The commit body and the PR body state that the published minimum rises from 22.13 to 22.18.

- [x] 5.1 RED: in `test/release-config.test.ts`, add assertions that `package.json` `engines.node` equals `>=22.18` and that the version in `.nvmrc` (read-only) is at least 22.18. Run the focused test and observe RED (`v26.10.0`). Specs: "Consistent floor", "Pin agrees".
- [x] 5.2 GREEN: set `engines.node` to `>=22.18` in `package.json` (replacing invalid `v26.10.0`). Re-run the focused test and observe GREEN.
- [x] 5.3 Edit `README.md`: line 12 badge `%3E%3D22.13` to `%3E%3D22.18`; line 25 Quickstart and line 261 Scripts note `>=22.13` to `>=22.18`. Leave line 598 (contributor floor `>=22.22.1`) unchanged.
- [x] 5.4 Edit `CONTRIBUTING.md`: line 7 `>=22.13` to `>=22.18` and the `.nvmrc` pin text `22.22.1` to `22.23.3` (matches the real `.nvmrc`); line 128 script `index.mjs` note `>=22.13` to `>=22.18`.
- [x] 5.5 Edit `AGENTS.md` line 7 (`Node >= 22.13` to `Node >= 22.18`) and `openspec/config.yaml` lines 5 and 18 (`Node >=22.13` to `Node >=22.18`).
- [x] 5.6 Edit `website/src/content/docs/en/getting-started.md` line 12 and `website/src/content/docs/es/getting-started.md` line 8 (`>=22.13` to `>=22.18`). Do not edit `.nvmrc`, `catalog/scripts/complexity/package.json`, `openspec/specs/git-hooks/spec.md`, `pnpm-lock.yaml` or archived changes.
- [x] 5.7 Verify: `rg "22\.13|v26\.10\.0" README.md CONTRIBUTING.md AGENTS.md openspec/config.yaml package.json website/src/content/docs` returns no matches. Run `pnpm run docs:website-catalog:check` (website docs pages are hand-written, not generated, but confirm no drift), `pnpm run lint`, `pnpm run format:check`, `pnpm run typecheck`, `pnpm run build`, `pnpm run test`. Commit with the message above.

Evidence (Phase 5): RED observed with `Node floor` tests in `test/release-config.test.ts`: `engines.node` received `"v26.10.0"`, expected `">=22.18"` (the `.nvmrc` check passed, 22.23.3). GREEN after setting `engines.node` to `>=22.18`. Docs/config floors updated (README, CONTRIBUTING incl. `.nvmrc` pin 22.23.3, AGENTS.md, openspec/config.yaml, en/es getting-started). The `rg` for `22.13` and `v26.10.0` returns nothing. Node 22.18.0 (npm `node@22.18.0`) imports `src/domain/catalog/frontmatter.ts` with type stripping and no flags (`readFrontmatter` exported). Lint, typecheck, format:check, `docs:website-catalog:check` and build green; full suite result recorded below.

## Phase 6: Final verification (no commit)

- [x] 6.1 Run the full gate once more: `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run test`, `pnpm run build`, `pnpm run docs:catalog:check`, `pnpm run docs:website-catalog:check`.
- [x] 6.2 Confirm `git diff --stat main -- src/` is empty and `package.json` has no new dependency.
- [x] 6.3 Prepare the PR body noting the published Node minimum rises from 22.13 to 22.18 (and `engines.node` was an invalid `v26.10.0`). Push and PR creation remain the user's decision.
