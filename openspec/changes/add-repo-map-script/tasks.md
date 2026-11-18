# Tasks: Catalog Repo-Map Script (`add-repo-map-script`, issue JSisques/shitaku#227)

Sources: proposal, `specs/**`, `design.md` (canonical; supersedes the specs where they differ), engram decisions `decisions`, `decisions-2`, `delivery`, `delivery-slices`.

## Review Workload Forecast

| Field                   | Value                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estimated changed lines | Slice 1: 1,700-2,100 (about 1,000 production + 800 tests + about 100 generated docs); Slice 2: 1,800-2,200 (about 1,000 production + 1,000 tests); Slice 3: 700-900 (about 300 renderer + 350 tests + 150 docs/args). Total about 4,200-5,200 |
| 400-line budget risk    | High (all three slices, slices 1 and 2 severely)                                                                                                                                                                                              |
| Chained PRs recommended | Yes                                                                                                                                                                                                                                           |
| Suggested split         | PR 1 (slice 1) -> PR 2 (slice 2) -> PR 3 (slice 3), each merged to main in order; optional further split of slices 1 and 2 (see below)                                                                                                        |
| Delivery strategy       | ask-on-risk (resolved to chained PRs)                                                                                                                                                                                                         |
| Chain strategy          | stacked-to-main                                                                                                                                                                                                                               |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Decision needed before apply (details): the user decided three slices, but slices 1 and 2 each exceed the 400-line review budget by roughly 4 to 5 times, and slice 3 by about 2 times. No `size:exception` is decided here; it is flagged for the user. The options are:

- A. Accept `size:exception` for slices 1, 2 and (probably) 3 as cut.
- B. Split further, keeping every PR registered and CI-green (recommended; the task order below already has clean boundaries):
  - 1a: registration skeleton, args, glob, jsonc, scan (walk + git), render-json, base build-map, `index.mjs` (tasks 1.1-1.9, 1.16-1.17; about 900-1,100 lines).
  - 1b: project detection (`project.mjs`, tasks 1.10-1.15; about 800-1,000 lines).
  - 2a: tokenizer + extractor (tasks 2.1-2.5; about 1,000-1,200 lines); 2b: resolver + wiring + graph (tasks 2.6-2.10; about 800-1,000 lines).
  - Even 1a/1b/2a/2b remain above 400 lines; they reduce but do not remove the need for an exception on dense modules (`project.mjs`, `extract-js.mjs`).
- C. Two-slice variant from the design (merge slices 1 and 2): about 3,500 lines, not recommended.

Per-task work-unit commits stay small (target near 400 authored lines each, planning heuristic only, never a reason to omit tests). Native review applies per work-unit commit or PR slice, never to the accumulated branch.

### Suggested Work Units

| Unit | Goal                                                                                                                                             | Likely PR                            | Focused test command                                                                                                                     | Runtime harness                                                                                                                          | Rollback boundary                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | Registered scanner foundation: JSON only; imports, exports and graph empty; stack/workspaces/commands/entry points/conventions; docs regenerated | PR 1 (base = main)                   | `pnpm exec vitest run test/catalog/scripts/repo-map test/catalog/scripts/repo-map.test.ts test/adapters/catalog/bundled-catalog.test.ts` | `cd <tmp repo> && node <repo>/catalog/scripts/repo-map/index.mjs` then inspect `.shitaku/repo-map.json` (also driven by the spawn tests) | Revert slice 1 commits: removes `catalog/scripts/repo-map/`, the `catalog.json` entry, tests, spec delta and regenerated docs |
| 2    | Tokenizer, extractor, resolver, graph, `relativeImportExtensions`                                                                                | PR 2 (base = main after PR 1 merges) | `pnpm exec vitest run test/catalog/scripts/repo-map`                                                                                     | Spawn run on `trickySyntax`, `aliases`, `workspaceMonorepo` in-memory fixtures; JSON `modules` and `graph` populated                     | Revert slice 2: modules return to empty `imports`/`exports`/graph; slice 1 stays valid                                        |
| 3    | Markdown renderer with cap, `--format markdown\|both`, `--max-depth`, default `both`, hand-written docs                                          | PR 3 (base = main after PR 2 merges) | `pnpm exec vitest run test/catalog/scripts/repo-map test/adapters/catalog/bundled-catalog.test.ts`                                       | Spawn default run writes `repo-map.json` and `repo-map.md`; synthetic 2,000-module map stays at or below 32,000 chars                    | Revert slice 3: back to JSON-only default; slices 1-2 stay valid                                                              |

## Standing Rules (apply to every task)

- **Strict TDD** (`pnpm test` = vitest). Every task: write the failing test first and observe RED (record the failing assertion), then the minimal GREEN, then refactor. Never invent evidence.
- **Checks (C)** before every commit: `pnpm run typecheck && pnpm run lint && pnpm run format:check && pnpm run test && pnpm run build`. Tasks that change `script.json` or `catalog.json` also run `pnpm run docs:catalog && pnpm run docs:website-catalog` and then `pnpm run docs:catalog:check`.
- **Commit** (work-unit-commits skill, resolved by registry name): one Conventional Commit per task with its tests and docs, for example `feat(repo-map): ...`, `test(repo-map): ...`, `docs(openspec): ...`. No `Co-Authored-By`, no `--no-verify`. Record the commit hash beside the task when checked off.
- **Always-green catalog**: `bundled-catalog.test.ts` asserts the exact flat file list of `catalog/scripts/repo-map/`. Every task that adds or removes a file in that directory updates the file-list assertion in the same commit, so each commit passes CI.
- **Test layout**: unit tests in `test/catalog/scripts/repo-map/<module>.test.ts` import `.mjs` modules through `loadRepoMapModule<T>()` from `test/helpers/repo-map.ts`; spawn tests live in `test/catalog/scripts/repo-map.test.ts`. Use `@/` and `@test/` aliases, `.js` extension on relative `.ts` imports, no `../`. Fixtures are in-memory trees in `test/helpers/repo-map.ts` (not `test/fixtures`). Git cases use `it.skipIf(!hasGit)` and fixed `GIT_AUTHOR_*`/`GIT_COMMITTER_*` (names, emails, dates).
- Script modules are plain ESM, zero dependencies; only `scan.mjs` and `index.mjs` may touch `node:fs`, `node:child_process` or `process`. All string comparisons use `<`/`>` (never `localeCompare`).
- Do not read or write the real home directory; `test/setup.ts` sandboxes `HOME`.
- Paths marked `(read-only)` are only read by the task.

---

# Slice 1: Scanner foundation and registration (PR 1, JSON only)

## Phase 1.A: Spec alignment and registration

- [ ] 1.1 **Patch delta specs to match design.md** (docs-only commit `docs(openspec): align repo-map specs with design`).
  - Files: `openspec/changes/add-repo-map-script/specs/catalog-scripts-repo-map/spec.md`, `openspec/changes/add-repo-map-script/specs/scripts-install/spec.md`.
  - Edits in the repo-map spec: per-import `status` (`internal|external|unresolved`) added to the module `imports[]` shape and to the resolution scenarios; `root` is `{ packageName: string | null }`, never an absolute path; `entryPoints` entries carry `path`, `package`, `field`, `key`, `file`; `skipped[].reason` fixed to `too-large|unreadable|symlink|invalid-json`; `bun.lock` added to lockfile detection; the Scenario "Per-file problems" asserts `status: 'unresolved'` with `resolved: null`; fixtures are in-memory trees in `test/helpers/repo-map.ts`; the staged rollout (default `--format` is `json` in slices 1-2, `both` after slice 3) noted under the CLI requirement; the "Catalog registration" requirement states that registration lands in slice 1 and prose lands in slice 3. Add scenarios for the threat matrix: subdirectory run, git missing from `PATH`, `--ignore` shell metacharacters, git state read-only, deleted tracked file excluded.
  - In the `scripts-install` spec: the `repo-map` file list is `index.mjs` plus the flat helper `.mjs` modules (no `lib/`).
  - RED: `rg -n "status|packageName|bun.lock|bun.lockb" openspec/changes/add-repo-map-script/specs` shows the gaps (record the missing matches). GREEN: the patched specs contain all items.
  - Checks: `pnpm run format:check` (Prettier covers Markdown if configured) and `pnpm run lint`.

- [ ] 1.2 **Register `repo-map` with a minimal skeleton** (commit `feat(catalog): register repo-map script`).
  - Files: `test/adapters/catalog/bundled-catalog.test.ts`, `catalog/catalog.json`, `catalog/scripts/repo-map/script.json`, `catalog/scripts/repo-map/index.mjs` (skeleton), README generated block, website generated pages.
  - RED first, in `bundled-catalog.test.ts`: `items.scripts` equals `['complexity','dead-code','duplication','repo-map']`; script directory entries equal the same four; `catalog.scripts` `toHaveLength(4)`; `repo-map` has `tools: []`, file list exactly `['index.mjs','script.json']` (adjust to the loader's actual file-list shape; check how `complexity` is asserted), no `package.json`, no `node_modules`. Move `repo-map` out of the "exactly two files" loop (about line 217) into its own no-bootstrap assertion, so the loop covers `dead-code` and `duplication` only. Add a `scripts-install` delta test or assertion for the project install tree of `repo-map` if the existing install tests have a per-script loop (extend it; do not duplicate).
  - GREEN: `script.json` with name `repo-map`, description, `tools: []`, args (`--out`, `--ignore`, `--format` json only), output description (`.shitaku/repo-map.json`), `exitCodes` `{0, 2}`; `catalog.json` entry; `index.mjs` skeleton that prints a `repo-map: not implemented` message and exits 2 (replaced in 1.16).
  - Run `pnpm run docs:catalog && pnpm run docs:website-catalog`; then `pnpm run docs:catalog:check`.
  - Checks: C plus docs check. Covers spec "Catalog registration" (Registered with metadata, Docs generated).

## Phase 1.B: Test helpers, CLI arguments, glob, JSONC

- [ ] 1.3 **`args.mjs` plus the shared test helper** (commit `feat(repo-map): parse CLI arguments`).
  - Files: `test/helpers/repo-map.ts` (create: `SCRIPT_DIR`, `loadRepoMapModule<T>()`, `runRepoMap()`, `writeTree()`, `initGitRepo()`, `hasGit`; typed module API stubs for `args`), `test/catalog/scripts/repo-map/args.test.ts`, `catalog/scripts/repo-map/args.mjs`, `test/adapters/catalog/bundled-catalog.test.ts` (file list).
  - RED: defaults (`format: 'json'`, `out: '.shitaku'`, `ignore: []`); `--out <dir>`; repeated `--ignore`; `--format json`; missing value, unknown option, positional argument and unsupported `--format` (including `markdown`/`both` in this slice) each throw an error with `exitCode: 2` and a `repo-map: ...` message. (`--max-depth` and `markdown|both` arrive in slice 3.)
  - GREEN: `parseArgs(argv)`; refactor error construction.
  - Checks: C. Spec: Repo-map CLI (Unknown flag, Format json only, Custom out dir).

- [ ] 1.4 **`glob.mjs`** (commit `feat(repo-map): add glob matcher`).
  - Files: `test/catalog/scripts/repo-map/glob.test.ts`, `catalog/scripts/repo-map/glob.mjs`, bundled-catalog file list.
  - RED: `**` spans segments; `*` stays in a segment; `?` matches one char; a pattern without `/` matches any single segment; a pattern with `/` is anchored at the root; a path is ignored when it or any ancestor matches; leading `!` negation for workspace globs; regex metacharacters are literal (`a.b`, `(x)`, `;rm -rf`).
  - GREEN: `globToRegExp`, `isIgnored`, `matchAny`.
  - Checks: C. Spec: Built-in and custom ignores.

- [ ] 1.5 **`jsonc.mjs`** (commit `feat(repo-map): add JSONC parser`).
  - Files: `test/catalog/scripts/repo-map/jsonc.test.ts`, `catalog/scripts/repo-map/jsonc.mjs`, bundled-catalog file list.
  - RED: line and block comments, trailing commas, `//` and `/*` inside strings preserved, BOM, invalid input throws a plain `Error` the caller can catch.
  - GREEN: `parseJsonc`.
  - Checks: C.

## Phase 1.C: Scanner

- [ ] 1.6 **`scan.mjs` walk path, guards, ignores** (commit `feat(repo-map): scan files with a deterministic walk`).
  - Files: `test/catalog/scripts/repo-map/scan-walk.test.ts`, `catalog/scripts/repo-map/scan.mjs`, `test/helpers/repo-map.ts` (add `nonGit`, `simpleApp` fixtures), bundled-catalog file list.
  - RED (temp dirs via `writeTree`, `GIT_CEILING_DIRECTORIES` set to force non-git): sorted code-unit order independent of creation order; built-in ignores (`node_modules`, `dist`, `build`, `coverage`, `.git`, `.hg`, `.svn`, `.shitaku`) as any path segment; `--ignore "**/generated/**"`; `--out` directory inside the root excluded; file over 1 MiB in `skipped` as `too-large` and absent from `sources`; symlink (file and directory) in `skipped` as `symlink`, directory symlinks not followed; unreadable source in `skipped` as `unreadable` (`skipIf` win32 or root); invalid `package.json` in `skipped` as `invalid-json`; snapshot shape `{ commit, files, sources, manifests, tsconfigs, skipped, textFiles }` with `commit: null`; `pnpm-workspace.yaml` captured in `textFiles`; `tsconfig.json` parsed through `jsonc` (null when invalid); the installed script's own directory under `.shitaku/` is never scanned.
  - GREEN: `scan(root, { ignore, outRel })` walk, `lstat`, size guard, reads of sources (extractor-table extensions) and manifests.
  - Checks: C. Spec: Non-git fallback, Built-in and custom ignores, Own output excluded, Oversized file.

- [ ] 1.7 **`scan.mjs` git listing, commit, threat matrix** (commit `feat(repo-map): list files via git with walk fallback`).
  - Files: `test/catalog/scripts/repo-map/scan-git.test.ts`, `catalog/scripts/repo-map/scan.mjs`, `test/helpers/repo-map.ts` (`initGitRepo` with fixed identity and dates), bundled-catalog (no list change).
  - Threat-matrix RED tests, carried unchanged from design.md (all `skipIf(!hasGit)` except the no-git ones):
    - Git repository selection:
      1. run from a subdirectory of a git repository lists only the subtree, with paths relative to it;
      2. a non-git directory (`GIT_CEILING_DIRECTORIES`) uses the walk;
      3. git missing from `PATH` uses the walk with `commit: null` and does not throw;
      4. `--ignore` values with shell metacharacters (`;rm -rf`) are treated as globs, run nothing (a sentinel file is not created) and are never forwarded to git;
      5. any path git returns containing a `..` segment is dropped; git is spawned with a fixed argument array, `shell: false`, `cwd` = realpath (no `-C`).
    - Commit state (read-only): 6. an empty repository (no commits) gives `commit: null` and files are still listed; 7. an untracked new file is included; 8. a tracked file deleted from the work tree is excluded (`lstat`); 9. a submodule gitlink is excluded; 10. staged-only, `commit -a` and an empty index states do not change the output beyond the listing; 11. the git index and `HEAD` are byte-identical before and after a run (compare `git rev-parse HEAD`, `git status --porcelain=v1`, and the `.git/index` bytes).
    - Plus: a tracked file, an untracked non-ignored file and a gitignored file (only the first two listed); `commit` equals the fixed HEAD hash; git and walk listings produce identical `files` on a tree without `.gitignore`.
  - GREEN: `spawnSync('git', ['ls-files','-z','--cached','--others','--exclude-standard'], { cwd: root, shell: false })`, `git rev-parse HEAD`, same ignore filter on both paths, fallback on any git failure.
  - Checks: C. Spec: Git repository listing, Commit hash, Commit null without git.

## Phase 1.D: Document core and canonical JSON

- [ ] 1.8 **`render-json.mjs`** (commit `feat(repo-map): render canonical JSON`).
  - Files: `test/catalog/scripts/repo-map/render-json.test.ts`, `catalog/scripts/repo-map/render-json.mjs`, bundled-catalog file list.
  - RED: keys sorted recursively by code-unit order; 2-space indent; trailing newline; same object with different insertion order gives identical bytes; no `generatedAt` or other time field; numbers are integers; non-ASCII keys sort by code unit.
  - GREEN: `renderJson`.
  - Checks: C. Spec: Determinism (No timestamp), JSON envelope.

- [ ] 1.9 **`extractors.mjs` and base `build-map.mjs`** (commit `feat(repo-map): build the base document`).
  - Files: `test/catalog/scripts/repo-map/build-map.test.ts`, `catalog/scripts/repo-map/extractors.mjs` (frozen table: `.ts .mts .cts` typescript, `.tsx` tsx, `.js .mjs .cjs` javascript, `.jsx` jsx; language only, no `extract` yet), `catalog/scripts/repo-map/build-map.mjs`, bundled-catalog file list.
  - RED: `buildRepoMap(snapshot)` returns `schema: 'shitaku.catalog.repo-map/v1'`, `commit`, `root: { packageName }` (null when the root manifest is absent), `tree` with every directory (`.` root, `files` direct count, `totalFiles` recursive), `modules` as `[{ path, language, imports: [], exports: [] }]` only for extension-table files and sorted by `path`, `graph: { edges: [], importedByCount }` with a zero entry per module, `skipped` sorted by `path`; non-table files (`.py`, `.go`, `.md`) count in `tree` but are not modules; no absolute path appears anywhere in the output (`JSON.stringify(doc)` does not contain the temp dir).
  - GREEN: implement with placeholders for `stack`, `workspaces`, `commands`, `entryPoints`, `conventions` (empty shapes; filled in 1.15).
  - Checks: C. Spec: Tree in JSON, Non-JS/TS files, No absolute paths.

## Phase 1.E: Project detection (`project.mjs`)

- [ ] 1.10 **`detectWorkspaces`** (commit `feat(repo-map): detect workspaces`).
  - Files: `test/catalog/scripts/repo-map/project.test.ts`, `catalog/scripts/repo-map/project.mjs` (create), bundled-catalog file list, `test/helpers/repo-map.ts` (add `workspaceMonorepo` manifests only; extended in slice 2).
  - RED: `pnpm-workspace.yaml` `packages:` list (quoted, unquoted, `!` negation, comments, CRLF); `package.json` `workspaces` as array and as `{ packages }`; globs matched against directories that hold a listed `package.json`; result `[{ name, path }]` sorted by `path`; manifest without `name` gives `name: null`; invalid manifest ignored.
  - GREEN. Checks: C. Spec: Workspace monorepo.

- [ ] 1.11 **`detectCommands` and package manager** (commit `feat(repo-map): detect commands and package manager`).
  - Files: `test/catalog/scripts/repo-map/project.test.ts`, `catalog/scripts/repo-map/project.mjs`.
  - RED: `packageManager` field wins (`pnpm@9` gives `pnpm`); lockfile order `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`, `bun.lock`; no signal gives `null`; scripts from root and workspace manifests as `{ path, name, command }` sorted by `(path, name)`.
  - GREEN. Checks: C. Spec: Package manager from field, Package manager from lockfile, Commands.

- [ ] 1.12 **`detectEntryPoints`** (commit `feat(repo-map): detect entry points`).
  - Files: `test/catalog/scripts/repo-map/project.test.ts`, `catalog/scripts/repo-map/project.mjs`.
  - RED: `main`, `module`, `types`, `bin` (string and map; `key` is the bin name), `exports` (string leaves flattened with condition and subpath keys joined by `>`, stored in `key`); target normalized to a repository-relative `file`; targets into ignored dirs such as `dist` are kept; entries `{ path, package, field, key, file }` sorted by `(path, field, key)`; workspace manifests included with their path.
  - GREEN. Checks: C. Spec: Entry points.

- [ ] 1.13 **`detectStack`** (commit `feat(repo-map): detect the project stack`).
  - Files: `test/catalog/scripts/repo-map/project.test.ts`, `catalog/scripts/repo-map/project.mjs`.
  - RED: `languages` with file counts per extractor language (sorted by `name`); `packageManager`; `node` from `engines.node`; `typescript: { config, version }` (config present via `tsconfig.json`; version from dependencies); frameworks, test runners, linters, formatters and bundlers from fixed dependency-name tables and config presence (`vitest.config.*`, `jest.config.*`, `eslint.config.*`, `.eslintrc*`, `.prettierrc*`, `biome.json*`); dependency names from root and workspace `dependencies`, `devDependencies`, `peerDependencies`; lists sorted and deduplicated.
  - GREEN. Checks: C. Spec: Conventions by presence.

- [ ] 1.14 **`detectConventions` (without `relativeImportExtensions`)** (commit `feat(repo-map): detect conventions`).
  - Files: `test/catalog/scripts/repo-map/project.test.ts`, `catalog/scripts/repo-map/project.mjs`.
  - RED: `moduleSystem` `esm|commonjs|mixed` from root `type` and extension counts; `testFiles` `{ pattern: 'test'|'spec'|'mixed'|null, dirs }`; `pathAliases` as the sorted tsconfig `paths` keys (JSONC supported; `extends` is not followed for this field in slice 1); `tsStrict` `boolean|null`; `relativeImportExtensions` is `null` in this slice (populated in 2.9).
  - GREEN. Checks: C.

- [ ] 1.15 **Wire project detection into `build-map.mjs`** (commit `feat(repo-map): include project detection in the document`).
  - Files: `test/catalog/scripts/repo-map/build-map.test.ts`, `catalog/scripts/repo-map/build-map.mjs`.
  - RED: end-to-end `buildRepoMap` on `simpleApp` and `workspaceMonorepo` (manifests only) includes `stack`, `workspaces`, `commands`, `entryPoints`, `conventions`; invalid manifest yields an `invalid-json` skipped entry and no crash; every collection obeys the design's sort table.
  - GREEN. Checks: C. Spec: Shape.

## Phase 1.F: CLI shell

- [ ] 1.16 **`index.mjs` real CLI, `script.json` update, spawn tests** (commit `feat(repo-map): write repo-map.json from the CLI`).
  - Files: `test/catalog/scripts/repo-map.test.ts`, `catalog/scripts/repo-map/index.mjs`, `catalog/scripts/repo-map/script.json` (only if args/output wording changes), regenerated README and website pages.
  - RED (spawn with the script copied to a temp dir, as in `duplication.test.ts`): default run writes `.shitaku/repo-map.json` and prints `wrote <relative path>`, exit 0; `--out maps` writes `maps/repo-map.json` and not `.shitaku/`; bad flag and missing value exit 2 with no files written; unwritable `--out` exits 2; atomic write leaves no `.tmp` file; `.gitignore` byte-identical after a run; two runs in the same dir are byte-identical, including the second run seeing the first run's output; the same tree in two temp dirs (non-git) is byte-identical; creation-order independence; a git fixture with fixed dates gives an identical commit and bytes; `--ignore ';touch pwned'` creates no file; unparsable-looking or unresolved content gives exit 0; JSON contains none of the temp dir path.
  - GREEN: `realpath` cwd, scan, build, render all, `mkdirSync`, write `<name>.tmp` then `renameSync`, errors print `repo-map: <message>` and exit 2.
  - Checks: C plus docs regeneration and `docs:catalog:check` if `script.json` changed. Spec: Defaults write (JSON part), Exit codes, Determinism.

- [ ] 1.17 **Slice 1 closure** (no new code unless fixes are needed).
  - Run the full C set, `pnpm run docs:catalog:check`, and a manual runtime check: run the script against this repository and inspect `.shitaku/repo-map.json` (do not commit `.shitaku/`). Confirm `git status` shows no stray files, then record per-commit evidence and the `review assess` outcome per the ODD protocol. Prepare PR 1 (base = main) with the title and body per the chained-pr skill. Tell the user about the size-exception decision before opening the PR (see Decision needed).

---

# Slice 2: Tokenizer, extractor, resolver, graph (PR 2)

Prerequisite: PR 1 merged to main (stacked-to-main); branch from updated main.

## Phase 2.A: Tokenizer

- [ ] 2.1 **`tokenize-js.mjs` core** (commit `feat(repo-map): add a JS/TS tokenizer`).
  - Files: `test/catalog/scripts/repo-map/tokenize-js.test.ts`, `catalog/scripts/repo-map/tokenize-js.mjs`, bundled-catalog file list.
  - RED: token shape `{ type, value, start, end, line }`; types `ident|punct|string|template|number`; line and block comments are not emitted but flag the gap before the next token; strings with escapes; template literals with `${}` and nested templates via a mode stack; numbers; the tokenizer never throws on arbitrary input (property-style loop over random byte strings with a fixed seed); unknown characters become `punct`.
  - GREEN. Checks: C.

- [ ] 2.2 **Tokenizer regex versus division and recovery** (commit `feat(repo-map): tokenizer regex and recovery rules`).
  - Files: `test/catalog/scripts/repo-map/tokenize-js.test.ts`, `catalog/scripts/repo-map/tokenize-js.mjs`.
  - RED: `/` starts a regex unless the previous significant token is an identifier, number, `)`, `]` or `}`, or it is one of `return typeof instanceof in of new delete void throw case do else yield await`; regex containing `import x from 'y'` is one token; an unterminated quoted string ends at end of line; JSX apostrophe (`<p>Don't</p>`) damages only that line; CRLF line counting; known residuals (`/*` in JSX text, `/` after `)` in `if (x) /re/`) degrade without a crash.
  - GREEN. Checks: C. Spec: Tricky syntax.

## Phase 2.B: Extractor

- [ ] 2.3 **`extract-js.mjs` imports** (commit `feat(repo-map): extract imports`).
  - Files: `test/catalog/scripts/repo-map/extract-js.test.ts`, `catalog/scripts/repo-map/extract-js.mjs`, bundled-catalog file list.
  - RED: `import ... from`, `import 's'` (static), `import type` (type), `export ... from`, `export * from`, `export * as ns from` (reexport); `require('s')` at any depth; `import('s')` at any depth (dynamic); non-literal `import(x)` and `require(x)` ignored; `import.meta` ignored; text inside comments, strings, templates and regex yields nothing; imports nested inside functions at depth greater than 0 ignored except `require` and `import()`; broken syntax returns what was found without throwing; dedupe by `(specifier, kind)`.
  - GREEN. Checks: C. Spec: Import kinds, Dynamic non-literal ignored, Tricky syntax, Unparsable file.

- [ ] 2.4 **`extract-js.mjs` exports** (commit `feat(repo-map): extract exports`).
  - Files: `test/catalog/scripts/repo-map/extract-js.test.ts`, `catalog/scripts/repo-map/extract-js.mjs`.
  - RED: `export function|class|const|let|var|type|interface|enum|namespace` with `async`, `declare`, `abstract`, `const enum`; destructured `const { a, b }`; `export default` (function, class, expression); `export { a, b as c }`; `export * from` gives `{ name: '*', kind: 'reexport-all' }`; `module.exports =`, `exports.x =`, `module.exports.x =` with `kind: 'commonjs'`; nested exports in function bodies and `declare module`/`namespace` blocks ignored; sorted by `(name, kind)`.
  - GREEN. Checks: C. Spec: Signatures without bodies (kinds).

- [ ] 2.5 **`extract-js.mjs` signatures** (commit `feat(repo-map): build export signatures`).
  - Files: `test/catalog/scripts/repo-map/extract-js.test.ts`, `catalog/scripts/repo-map/extract-js.mjs`.
  - RED: headers end at body `{` at paren and angle depth 0 (functions, classes, interfaces, enums, namespaces), at `=` (const/let/var), at the statement end (type alias); comments never leak and a single space replaces whitespace or comment gaps; CRLF does not matter; signatures over 200 chars are clipped and end in `...`; `export { a }` copies the signature of the local declaration when found, else `null`; no body text ever appears.
  - GREEN. Checks: C. Spec: Signatures without bodies.

## Phase 2.C: Resolver

- [ ] 2.6 **`resolve.mjs` relative resolution** (commit `feat(repo-map): resolve relative imports`).
  - Files: `test/catalog/scripts/repo-map/resolve.test.ts`, `catalog/scripts/repo-map/resolve.mjs`, bundled-catalog file list.
  - RED (in-memory file sets only; assert no `fs` call): probe order exact, `.js/.jsx/.mjs/.cjs` to `.ts/.tsx/.mts/.cts`, extension order `.ts .tsx .mts .cts .js .jsx .mjs .cjs`, then `<path>/index.*`; a JSON or CSS target in the listing resolves to that file; no match gives `{ resolved: null, status: 'unresolved' }`; resolved gives `status: 'internal'`; case-sensitive matching (`./Foo` does not match `foo.ts`).
  - GREEN. Checks: C. Spec: Relative with extension probing, Index resolution, Unresolved relative.

- [ ] 2.7 **`resolve.mjs` tsconfig `paths`** (commit `feat(repo-map): resolve tsconfig path aliases`).
  - Files: `test/catalog/scripts/repo-map/resolve.test.ts`, `catalog/scripts/repo-map/resolve.mjs`, `test/helpers/repo-map.ts` (add `aliases` fixture).
  - RED: nearest `tsconfig.json` among the importer's workspace directory and the root; JSONC; `extends` followed one level and only for relative files; `baseUrl` relative to the declaring tsconfig; longest-prefix pattern first; candidates probed as relative; matching pattern with no candidate gives `unresolved`.
  - GREEN. Checks: C. Spec: Path alias.

- [ ] 2.8 **`resolve.mjs` workspaces, externals, unresolved** (commit `feat(repo-map): resolve workspace and external specifiers`).
  - Files: `test/catalog/scripts/repo-map/resolve.test.ts`, `catalog/scripts/repo-map/resolve.mjs`.
  - RED: `pkg` and `@scope/pkg` equal to a workspace name; subpath probed under the workspace directory; no subpath tries `exports['.']` string leaf (`import`, then `default`), `module`, `main`, `src/index.*`, `index.*`; no hit gives `unresolved`; `node:fs` and other bare specifiers give `{ resolved: null, status: 'external' }`; `#imports`, absolute paths and URLs give `unresolved`.
  - GREEN. Checks: C. Spec: Workspace package import, External package.

## Phase 2.D: Wiring and integration

- [ ] 2.9 **Wire extraction and graph into `build-map.mjs`** (commit `feat(repo-map): populate imports, exports and the graph`).
  - Files: `test/catalog/scripts/repo-map/build-map.test.ts`, `catalog/scripts/repo-map/extractors.mjs` (add `extract: extractJs`), `catalog/scripts/repo-map/build-map.mjs`, `catalog/scripts/repo-map/project.mjs` (`relativeImportExtensions` `js|none|mixed|null` by majority over relative specifiers in TypeScript files), `test/helpers/repo-map.ts` (add `trickySyntax` fixture; complete `workspaceMonorepo` with sources).
  - RED: module `imports[{ specifier, kind, status, resolved }]` and `exports[{ name, kind, signature }]` populated; `graph.edges` only internal resolved edges, deduplicated, sorted by `(from, to)`; `importedByCount` counts inbound edges and holds a zero for every module; A imported by B and C gives 2; external imports create no edge; sort table obeyed; `relativeImportExtensions` majority tests; a module whose extraction throws is recorded with empty arrays (never crashes the run).
  - GREEN. Checks: C. Spec: Imported-by count, Tricky syntax, Unparsable file.

- [ ] 2.10 **Slice 2 spawn and determinism tests** (commit `test(repo-map): cover extraction through the CLI`).
  - Files: `test/catalog/scripts/repo-map.test.ts`.
  - RED/GREEN as coverage: run on `trickySyntax`, `aliases` and `workspaceMonorepo`; exit 0 with an unparsable file and an unresolved import (`resolved: null`, `status: 'unresolved'`); two-run byte equality still holds with populated modules; JSON complete; git and walk produce identical `modules` on a tree without `.gitignore`.
  - If a test passes immediately because behavior already exists, record that no RED was possible and why. Checks: C.

- [ ] 2.11 **Slice 2 closure.** Run C, runtime check on this repository (`modules`, `graph`, `importedByCount` look sane; compare a few known imports), record evidence, `review assess` outcome, and prepare PR 2.

---

# Slice 3: Markdown renderer, `both` default, `--max-depth`, docs (PR 3)

Prerequisite: PR 2 merged to main.

## Phase 3.A: Renderer

- [ ] 3.1 **`render-markdown.mjs` sections and ordering** (commit `feat(repo-map): render the Markdown digest`).
  - Files: `test/catalog/scripts/repo-map/render-markdown.test.ts`, `catalog/scripts/repo-map/render-markdown.mjs`, bundled-catalog file list.
  - RED: header with schema, commit (`none` when null), package and a pointer to `repo-map.json`; sections in order Stack, Commands, Workspaces, Entry points, Conventions, Tree (directories only, depth up to `maxDepth`), Modules; modules ordered by `importedByCount` descending then `path`; each block has a heading with the path and imported-by count, a `deps:` line of internal resolved imports, and one line per export signature; a small repo has no omission note; output is a pure function (same input gives identical string); ends with a trailing newline.
  - GREEN. Checks: C. Spec: Under cap.

- [ ] 3.2 **Cap and truncation stages** (commit `feat(repo-map): cap the Markdown at about 8k tokens`).
  - Files: `test/catalog/scripts/repo-map/render-markdown.test.ts`, `catalog/scripts/repo-map/render-markdown.mjs`.
  - RED: `MAX_TOKENS = 8000`, `CHARS_PER_TOKEN = 4` (32,000 chars including the note); stage order: (1) collapse signatures to an `exports: a, b, c` names line, least important first (ascending `importedByCount`, then descending path); (2) lower tree depth one level at a time from `maxDepth` toward 1; (3) drop whole module blocks, least important first; (4) safety net cut at the last line boundary that fits; the `## Omitted` section states each stage's count and that `repo-map.json` is complete, with 512 chars reserved up front; a synthetic 2,000-module map gives `length <= 32000` and identical bytes on two renders; fixed sections alone over budget hit stage 4; measure blocks once (no re-render loop; assert completion time under a generous bound).
  - GREEN. Checks: C. Spec: Over cap truncation, Tree reduction after signatures, JSON stays complete, Deterministic truncation.

## Phase 3.B: CLI and metadata

- [ ] 3.3 **`--format markdown|both`, `--max-depth`, default `both`** (commit `feat(repo-map): write Markdown and default to both formats`).
  - Files: `test/catalog/scripts/repo-map/args.test.ts`, `test/catalog/scripts/repo-map.test.ts`, `catalog/scripts/repo-map/args.mjs`, `catalog/scripts/repo-map/index.mjs`, `catalog/scripts/repo-map/script.json`, regenerated README and website pages.
  - RED: args default `format: 'both'`, `maxDepth: 4`; `--max-depth 0`, `abc`, `-1`, `1.5` exit 2; spawn: default writes both files; `--format json` writes only JSON and `--format markdown` only Markdown (an unselected file is neither written nor deleted, so a pre-existing one survives); `--out maps`; bad argument writes no files; `--max-depth 2` limits only the Markdown tree and JSON `tree` stays full depth; two runs byte-identical for both files, including a second run that sees the first run's output; truncated Markdown leaves the JSON complete; render-all-before-write (a render failure leaves old files untouched).
  - GREEN: update `script.json` args (`--format json|markdown|both`, `--max-depth`) and the output description. Run `docs:catalog`, `docs:website-catalog`, `docs:catalog:check`.
  - Checks: C plus docs check. Spec: Defaults write both files, Format json/markdown only, Invalid max-depth, Max-depth limits only Markdown.

## Phase 3.C: Hand-written documentation

- [ ] 3.4 **Update prose that enumerates bundled scripts** (commit `docs(repo-map): list repo-map in the hand-written docs`).
  - Files: `README.md` (prose outside generated markers), `website/src/content/docs/en/overview.md` and `website/src/content/docs/es/overview.md` (confirm the exact paths with `fd overview.md website`), `CONTRIBUTING.md`, `test/adapters/catalog/bundled-catalog.test.ts` (README assertion).
  - RED: extend the README/docs assertions in `bundled-catalog.test.ts` (and any existing doc guard such as `test/tooling.test.ts`; check with `rg -n "duplication" test`) so each hand-written enumeration of `complexity`, `dead-code`, `duplication` must also contain `repo-map`; observe RED, then GREEN by editing the prose. Spanish text is neutral/professional; docs say "no timestamps, deterministic, `.shitaku/` output, git optional".
  - Checks: C plus `docs:catalog:check`. Spec: Prose updated, Gitignore untouched (documented: the script never edits `.gitignore`).

- [ ] 3.5 **Slice 3 closure and change verification.** Run C and docs checks; run the script on this repository and verify `.shitaku/repo-map.md` is within 32,000 chars and states omissions when applicable; confirm every spec scenario has a passing test (build a scenario-to-test map for `sdd-verify`); record evidence, `review assess` outcome, and prepare PR 3. Next step: `sdd-verify`, then `sdd-archive`.

---

## Threat-Matrix Traceability

| Design row                                                                                                                      | Task                                                     |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Git repository selection (subdirectory, non-git, git missing, metacharacter `--ignore`, `..` paths, fixed argv, `shell: false`) | 1.7 (cases 1-5), 1.16 (spawn: `--ignore ';touch pwned'`) |
| Commit state (empty repo, untracked, deleted tracked, gitlink, staged / `commit -a` / empty index, index and HEAD unchanged)    | 1.7 (cases 6-11)                                         |
| Documentation-like paths, Push state, PR commands                                                                               | N/A in the design; omitted                               |
