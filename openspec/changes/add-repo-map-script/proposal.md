# Proposal: Catalog Repo-Map Script

## Intent

Issue #227: agents starting work in an unfamiliar repository spend many turns rediscovering its layout, stack, commands and module boundaries. Add a bundled `repo-map` catalog script that produces a deterministic, dependency-free structural map of a JS/TS repository (`shitaku run repo-map`), written as a complete JSON document plus a size-capped Markdown digest that can be handed to an agent as starting context. It is also the fixed input that `shitaku new` (#226) will consume later.

## Confirmed decisions (from the user; not re-opened here)

1. Output: `.shitaku/repo-map.json` and `.shitaku/repo-map.md` (loose files directly in `.shitaku/`).
2. No `generatedAt`; only the commit hash (`null` when git is unavailable). Output is byte-for-byte deterministic for the same tree.
3. v1 covers JS/TS only (`.ts .tsx .mts .cts .js .jsx .mjs .cjs`) behind a per-language extractor table; zero dependencies; heuristic scanner (exploration approach A); file listing via `git ls-files` with a walk fallback.
4. JSON is always complete; Markdown has a size cap (~8k tokens) with deterministic truncation (signatures of the least-imported files first, then deeper tree levels) and an explicit note of what was omitted.

## Assumed defaults (proposal-level; flag to the orchestrator if any should change)

| Topic                         | Default                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepos / workspaces        | One map per repository root. Workspaces are detected from `pnpm-workspace.yaml` and `package.json` `workspaces` and recorded as `workspaces[] {name, path}`. Modules keep repo-relative paths; no per-package output files. Cross-workspace imports by package name resolve to the workspace path when it matches a detected workspace name, otherwise they are external. |
| Module granularity            | A module is a file. The JSON `tree` lists directories with file counts (full depth). The Markdown tree is rendered at directory level, depth-limited by `--max-depth`.                                                                                                                                                                                                    |
| Flags                         | `--format json\|markdown\|both` (default `both`, selects which files are written); `--out <dir>` (default `.shitaku`, relative to cwd); `--max-depth <n>` (Markdown tree depth only, default `4`; JSON stays complete); `--ignore <glob>` (repeatable, added to built-in ignores). Unknown flags are a CLI error.                                                         |
| Exit codes                    | `0` map written; `2` CLI, IO or fatal failure. Exit `1` is reserved (future `--check` for a stale map) and not emitted in v1. Per-file extraction problems are recorded in the output (`unresolved` imports, `skipped` files), never a non-zero exit.                                                                                                                     |
| Command detection             | Root and workspace `package.json` `scripts`, plus the package manager from the `packageManager` field or lockfile (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`). Makefile, Cargo and other sources are deferred.                                                                                                                                      |
| Stack / conventions detection | Plain file-presence checks (e.g. `tsconfig.json`, framework/test-runner/lint/format configs and `package.json` dependency names). No content heuristics beyond reading JSON configs.                                                                                                                                                                                      |
| Envelope                      | `shitaku.catalog.repo-map/v1`: `{schema, commit, root, stack, workspaces, commands, entryPoints, tree, modules[{path, language, imports[{specifier, resolved \| null, kind}], exports[{name, kind, signature}]}], graph{edges, importedByCount}, conventions, skipped[]}`. Keys and arrays are sorted; paths are POSIX.                                                   |
| Self-exclusion and guards     | The scanner always ignores the `--out` directory and `.shitaku/`, plus built-in ignores (`node_modules`, `dist`, `build`, `coverage`, VCS dirs). Files above a size limit (default 1 MiB) are listed in `skipped[]` with a reason.                                                                                                                                        |
| `script.json` tools           | `tools: []`; git is optional (walk fallback), so it is not a declared tool.                                                                                                                                                                                                                                                                                               |
| Gitignore                     | The script does not edit `.gitignore`; committing or ignoring the map is the user's choice.                                                                                                                                                                                                                                                                               |

## Scope

### In Scope

- `catalog/scripts/repo-map/index.mjs`, `script.json` and helper `.mjs` modules (walk/list, stack, extract-js, resolve/graph, render-json, render-markdown), plain ESM, no script-root `package.json`, no shipped dependencies (#144 policy).
- File listing: `git ls-files` (tracked plus untracked-not-ignored) when inside a git repo, otherwise a deterministic directory walk with built-in ignores.
- JS/TS heuristic extractor: static `import`/`export`, `export * from`, re-exports, `require()`, dynamic `import()` with a literal specifier, and exported declaration signatures (functions, classes, consts, types, interfaces, enums) with comment/string/template-aware tokenizing.
- Import resolution: relative specifiers with extension and `index` probing (including `.js`→`.ts` mapping), `tsconfig.json` `compilerOptions.paths`/`baseUrl` (no `extends` chains beyond one level is an accepted limitation), workspace package names; anything else is external or `unresolved`.
- Import graph and `importedByCount` per module; entry points from `package.json` `main`/`module`/`bin`/`exports`.
- JSON writer (complete, sorted, deterministic) and Markdown renderer as a pure function of the JSON, with the ~8k-token cap (estimated as characters/4), deterministic truncation order and an omission note.
- Registration in `catalog/catalog.json` `items.scripts`.
- Tests first (strict TDD): unit-style spawn tests in `test/catalog/scripts/repo-map.test.ts`, in-memory fixture trees in `test/helpers/repo-map.ts` (simple app, tricky syntax, aliases, workspace monorepo, non-git directory), and a determinism test (two runs, identical bytes).
- `test/adapters/catalog/bundled-catalog.test.ts` updates (script list, length, files) while keeping `repo-map` out of the exactly-two-files loop.
- Docs: regenerate README script table (`pnpm run docs:catalog`) and website pages (`pnpm run docs:website-catalog`, en/es); fix the stale hand-written prose that enumerates scripts (README, website overview en/es, `CONTRIBUTING.md`).

### Out of Scope

- Incremental cache / reuse of a previous map (#290).
- AI-generated summaries of modules (#291).
- `shitaku new` and its consumption of the map (#226, #292).
- Languages other than JS/TS (the extractor table only leaves room for them).
- TypeScript compiler API or any bundled parser (exploration approaches B-E).
- `--check` stale-map mode and exit `1`.
- Makefile/Cargo/other command sources; full `tsconfig` `extends` resolution; package `exports` subpath resolution for external packages.
- Any hexagonal `src/` change; `shitaku run` and install are reused as-is.

## Capabilities

### New Capabilities

- `catalog-scripts-repo-map`: CLI flags, file listing (git and walk fallback), ignores and guards, JS/TS extraction, import resolution, graph, stack/command/workspace detection, JSON envelope `shitaku.catalog.repo-map/v1`, Markdown rendering with size cap and omission note, determinism, output location and exit codes.

### Modified Capabilities

- `scripts-install`: requirement "Bundled catalog scripts" MUST list and ship `repo-map` alongside `complexity`, `dead-code` and `duplication` (no script-root npm bootstrap, multi-file script directory copied as-is).

## Approach

Follow the `dead-code`/`duplication` sibling pattern (own argument parsing, plain ESM, envelope versioning, script-owned exit codes) but with no external tool. The pipeline is a sequence of pure stages: list files → read and extract per language via an extractor table keyed by extension → resolve imports → build graph → assemble the sorted JSON document → render Markdown from the JSON. Only the list/read/write stages touch the filesystem or spawn git, so extraction, resolution and rendering are testable on in-memory inputs as well as through spawn tests. Determinism comes from sorting every collection, POSIX paths, no timestamps, stable number formatting and a trailing newline.

## Affected Areas

| Area                                                               | Impact           | Description                                                              |
| ------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------ |
| `catalog/scripts/repo-map/`                                        | New              | `index.mjs`, `script.json`, helper `.mjs` modules                        |
| `catalog/catalog.json`                                             | Modified         | Add `repo-map` to `items.scripts`                                        |
| `test/catalog/scripts/repo-map.test.ts`                            | New              | Extraction, resolution, rendering, CLI, exit codes, determinism          |
| `test/helpers/repo-map.ts`                                         | New              | Simple, tricky-syntax, alias, workspace and non-git fixtures             |
| `test/adapters/catalog/bundled-catalog.test.ts`                    | Modified         | Script list, length 4, `repo-map` file list; excluded from two-file loop |
| `test/application/init-mcps.test.ts`                               | Optional         | Install block for `repo-map` if siblings have one                        |
| `openspec/specs/scripts-install/spec.md`                           | Modified (delta) | Bundled list includes `repo-map`                                         |
| README script table, website `catalog/scripts/repo-map.md` (en/es) | Generated        | `docs:catalog`, `docs:website-catalog`                                   |
| README prose, website `overview.md` (en/es), `CONTRIBUTING.md`     | Modified         | Stale script enumerations                                                |
| Hexagonal `src/`                                                   | None             | Reuse install/run/doctor                                                 |

## Risks

| Risk                                                                               | Likelihood | Mitigation                                                                                                            |
| ---------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| Heuristic extraction misreads strings, regex literals, templates or JSX            | Med        | Comment/string/template-aware tokenizer; tricky-syntax fixture; unknown constructs degrade to omission, never a crash |
| Alias/barrel/`export *` resolution gaps                                            | Med        | Explicit `resolved: null` plus `unresolved` markers; alias fixture; documented limitations                            |
| Non-determinism (fs order, git output, platform paths, `.shitaku/` self-inclusion) | Med        | Sort everything, POSIX normalize, exclude output dir, byte-equality test                                              |
| Large repositories (time, memory, Markdown size)                                   | Med        | Per-file size limit, `skipped[]`, Markdown cap; JSON size unbounded by decision 4                                     |
| `bundled-catalog.test.ts` hard asserts and CI `docs:catalog:check`                 | High       | Update asserts in the registration slice; regenerate docs in the same slice                                           |
| Review budget exceeded (estimated 900-1300 authored lines incl. tests/fixtures)    | High       | Chained slices (below); chain strategy is an orchestrator/user decision                                               |
| Assumed defaults diverge from user intent                                          | Low-Med    | Listed explicitly above for confirmation before spec                                                                  |

## Review Workload Note

Forecast clearly exceeds the 400-line budget. Suggested slice split (each independently verifiable):

1. **Slice 1, scanner core + JSON**: listing (git/walk), ignores/guards, JS/TS extractor, resolution, graph, stack/commands/workspaces, JSON writer, CLI flags and exit codes; tests and fixtures. Script directory exists but is not yet registered in the catalog.
2. **Slice 2, Markdown + registration + docs**: Markdown renderer with cap and omission note, `catalog.json` registration, `bundled-catalog.test.ts`, `scripts-install` delta, generated and hand-written docs.

Slice 1 may itself exceed 400 lines; a three-way split (1a listing + stack + JSON skeleton, 1b extractor + resolution + graph) is a fallback. The chain strategy (`stacked-to-main` vs `feature-branch-chain`) is NOT decided here; delivery is `ask-on-risk`, so the orchestrator must ask the user.

## Rollback Plan

Delete `catalog/scripts/repo-map/`, remove the `repo-map` entry from `catalog/catalog.json`, revert the test, fixture, spec delta and docs changes, and regenerate docs. No `src/` or state migration. Users who installed it can remove `.shitaku/scripts/repo-map/` via `shitaku undo`, and delete `.shitaku/repo-map.{json,md}` manually.

## Dependencies

- Existing `shitaku run` and script install (`src/application/run-script.ts`, `src/domain/catalog/script.ts`, which allows `tools: []` and extra files).
- #144 no-shipped-dependencies policy; sibling scripts `dead-code`/`duplication` as patterns.
- Node >= 22.13 built-ins only; `git` optional at runtime.

## Success Criteria

- [ ] `shitaku run repo-map` writes `.shitaku/repo-map.json` and `.shitaku/repo-map.md` on Linux/macOS/Windows with no extra dependencies.
- [ ] Two consecutive runs on the same tree produce byte-identical files; `commit` is the HEAD hash or `null` without git.
- [ ] JSON validates against the `shitaku.catalog.repo-map/v1` shape and is complete; Markdown stays within the cap and reports what was omitted.
- [ ] Fixtures cover tricky syntax, aliases, workspaces and non-git directories; unresolved imports are explicit, not crashes.
- [ ] `repo-map` is registered and installable; `bundled-catalog`, `docs:catalog:check` and all repo checks pass.
- [ ] `scripts-install` spec lists `repo-map`; README and website docs are regenerated and stale prose updated.
