# Catalog Scripts Repo-Map Specification

## Purpose

CLI, file listing, JS/TS extraction, import resolution, graph, envelope, Markdown digest, determinism, outputs, and exit codes for `repo-map`. Test fixtures are in-memory trees in `test/helpers/repo-map.ts`, not on-disk fixture directories.

## Requirements

### Requirement: Repo-map CLI

`shitaku run repo-map` MUST produce a structural map of the cwd repository. MUST support `--format json|markdown|both` (default `both`), `--out <dir>` (default `.shitaku`, relative to cwd), `--max-depth <n>` (default `4`), and repeatable `--ignore <glob>`. Unknown flags, unsupported `--format` values, and non-positive-integer or non-numeric `--max-depth` MUST exit 2. `--format` selects which files are written. `--max-depth` MUST affect only the Markdown tree.

Delivery is staged. In the first two slices only `--format json` is accepted and it is the default; `markdown` and `both`, `--max-depth` and the default of `both` arrive in the third slice. Until then, `--format markdown` and `--format both` MUST exit 2 as unsupported values.

#### Scenario: Defaults write both files

- GIVEN a JS/TS repository
- WHEN run with no flags
- THEN `.shitaku/repo-map.json` and `.shitaku/repo-map.md` exist and exit is 0

#### Scenario: Format json only

- GIVEN a JS/TS repository
- WHEN run with `--format json`
- THEN only `repo-map.json` is written in the output directory

#### Scenario: Format markdown only

- GIVEN a JS/TS repository
- WHEN run with `--format markdown`
- THEN only `repo-map.md` is written in the output directory

#### Scenario: Custom out dir

- GIVEN a JS/TS repository
- WHEN run with `--out maps`
- THEN `maps/repo-map.json` and `maps/repo-map.md` are written and `.shitaku/repo-map.*` are not

#### Scenario: Unknown flag

- GIVEN any repository
- WHEN run with `--bogus`
- THEN exit 2 and no output files are written

#### Scenario: Invalid max-depth

- GIVEN any repository
- WHEN run with `--max-depth 0` or `--max-depth abc`
- THEN exit 2

#### Scenario: Max-depth limits only Markdown

- GIVEN nested directories deeper than 2 levels
- WHEN run with `--max-depth 2`
- THEN the Markdown tree has no directory deeper than 2 and the JSON `tree` still lists full depth

### Requirement: Exit codes

Exit MUST be 0 when the map is written, and 2 for CLI, IO, or fatal failure. Exit 1 MUST NOT be emitted. Per-file extraction problems MUST be recorded in the output (`unresolved` imports, `skipped` files) and MUST NOT change the exit code.

#### Scenario: Success

- GIVEN a valid repository
- WHEN run
- THEN exit 0

#### Scenario: Unwritable output

- GIVEN `--out` points to a path that cannot be created or written
- WHEN run
- THEN exit 2

#### Scenario: Per-file problems do not fail

- GIVEN a file with unparsable syntax and an import that cannot be resolved
- WHEN run
- THEN exit 0, the import has `status: 'unresolved'` with `resolved: null`, and the run completes without crash

### Requirement: File listing and guards

Inside a git repository, files MUST be listed via `git ls-files` (tracked plus untracked-not-ignored). Otherwise a deterministic directory walk with built-in ignores MUST be used. Built-in ignores MUST include `node_modules`, `dist`, `build`, `coverage`, and VCS directories; `--ignore` globs MUST be added to them. The scanner MUST always exclude the `--out` directory and `.shitaku/`. Files above 1 MiB MUST be omitted from extraction and listed in `skipped[]` with a reason. Git MUST be optional and not a declared tool. Git MUST be spawned only with a fixed argument array, without a shell, with the working directory as its `cwd`; `--ignore` and `--out` values MUST NOT be forwarded to git and MUST NOT be interpreted by a shell. Paths returned by git that contain a `..` segment MUST be dropped. Tracked files deleted from the work tree, submodule gitlinks and symlinks MUST NOT be listed as files (symlinks are recorded in `skipped[]`). The script MUST NOT modify the git index or `HEAD`.

#### Scenario: Git repository listing

- GIVEN a git repo with a tracked file, an untracked non-ignored file, and a gitignored file
- WHEN run
- THEN the tracked and untracked files appear in the map and the gitignored file does not

#### Scenario: Non-git fallback

- GIVEN a directory without git metadata
- WHEN run
- THEN the map is produced via the walk, built-in ignores apply, and `commit` is `null`

#### Scenario: Built-in and custom ignores

- GIVEN files under `node_modules`, `dist`, and a path matching `--ignore "**/generated/**"`
- WHEN run with that flag
- THEN none of those files appear in `modules` or `tree`

#### Scenario: Own output excluded

- GIVEN a previous run wrote `.shitaku/repo-map.json` and `.shitaku/repo-map.md`
- WHEN run again, including with a custom `--out`
- THEN neither the output directory nor `.shitaku/` contents appear in the map

#### Scenario: Oversized file

- GIVEN a source file larger than 1 MiB
- WHEN run
- THEN it is absent from `modules` and present in `skipped[]` with reason `too-large`

#### Scenario: Run from a subdirectory

- GIVEN a git repository and a run from one of its subdirectories
- WHEN run
- THEN only the files of that subtree are listed, with paths relative to it

#### Scenario: Git missing from PATH

- GIVEN a git repository and a `PATH` without git
- WHEN run
- THEN the walk is used, `commit` is `null` and the run does not fail

#### Scenario: Ignore values with shell metacharacters

- GIVEN `--ignore ';touch pwned'`
- WHEN run
- THEN the value is treated as a glob, no command runs and no `pwned` file is created

#### Scenario: Git state is read-only

- GIVEN a git repository with staged, unstaged and untracked changes
- WHEN run
- THEN `HEAD`, the index and the work tree status are identical before and after the run

#### Scenario: Deleted tracked file excluded

- GIVEN a tracked file deleted from the work tree
- WHEN run
- THEN it does not appear in the map

#### Scenario: Symlink skipped

- GIVEN a symbolic link to a file or directory
- WHEN run
- THEN it is not followed and is recorded in `skipped[]` with reason `symlink`

#### Scenario: Invalid manifest

- GIVEN a `package.json` that is not valid JSON
- WHEN run
- THEN it is recorded in `skipped[]` with reason `invalid-json`, ignored for detection and the run exits 0

### Requirement: Determinism

Output MUST be byte-for-byte identical for the same tree and flags. The JSON MUST NOT contain a timestamp. It MUST contain `commit` as the HEAD hash, or `null` when git is unavailable or there is no commit. All object keys and arrays MUST be sorted, paths MUST be POSIX, and each file MUST end with a trailing newline. Output MUST NOT depend on filesystem or git listing order.

#### Scenario: Two runs identical

- GIVEN an unchanged tree
- WHEN run twice
- THEN `repo-map.json` and `repo-map.md` are byte-identical across runs, including the second run seeing the first run's output on disk

#### Scenario: No timestamp

- GIVEN any run
- WHEN the JSON is inspected
- THEN it has no `generatedAt` or other time-dependent field

#### Scenario: Commit hash

- GIVEN a git repo with at least one commit
- WHEN run
- THEN `commit` equals the HEAD hash

#### Scenario: Commit null without git

- GIVEN a directory outside any git repository
- WHEN run
- THEN `commit` is `null`

#### Scenario: Listing order independence

- GIVEN the same files created in different orders
- WHEN run on each
- THEN the JSON files are byte-identical

### Requirement: JSON envelope

JSON MUST use `schema` = `"shitaku.catalog.repo-map/v1"` and MUST contain `commit`, `root`, `stack`, `workspaces`, `commands`, `entryPoints`, `tree`, `modules`, `graph`, `conventions`, and `skipped`. `root` MUST be `{ packageName: string | null }` taken from the root `package.json` `name`; it MUST NOT contain an absolute path. Each module MUST have `path`, `language`, `imports[{specifier, kind, status, resolved | null}]` where `status` is `internal`, `external` or `unresolved`, and `exports[{name, kind, signature}]`. `skipped[]` entries MUST be `{ path, reason }` with `reason` one of `too-large`, `unreadable`, `symlink` or `invalid-json`. `graph` MUST contain `edges` and `importedByCount`. The JSON MUST always be complete, regardless of the Markdown cap.

#### Scenario: Shape

- GIVEN a simple app fixture
- WHEN JSON emits
- THEN schema is `shitaku.catalog.repo-map/v1` and every listed top-level key is present with the specified element shapes

#### Scenario: No absolute paths

- GIVEN any run
- WHEN the JSON is inspected
- THEN it contains no machine-specific absolute path

### Requirement: JS/TS extraction

The extractor MUST handle `.ts .tsx .mts .cts .js .jsx .mjs .cjs` through a per-language extractor table keyed by extension, and MUST NOT extract other languages in v1. It MUST record static `import`, `export ... from`, `export * from`, re-exports, `require()` with a literal specifier, and dynamic `import()` with a literal specifier, each with a `kind`. Exported declarations (functions, classes, consts, types, interfaces, enums) MUST be recorded with a signature only, never the body. The tokenizer MUST be comment-, string-, template-, and regex-aware so that import-like text in those contexts is not extracted. Unknown constructs MUST degrade to omission, never a crash. The module granularity MUST be a file.

#### Scenario: Import kinds

- GIVEN a file with static import, `export * from`, a re-export, `require('x')`, and `import('y')`
- WHEN run
- THEN each appears in `imports` with its distinct `kind`

#### Scenario: Dynamic non-literal ignored

- GIVEN `import(variable)` or `require(expr)`
- WHEN run
- THEN no import is recorded for it and no crash occurs

#### Scenario: Signatures without bodies

- GIVEN an exported function, class, const, type, interface, and enum
- WHEN run
- THEN each export has `name`, `kind`, and a `signature` that excludes the body

#### Scenario: Tricky syntax

- GIVEN import-like text inside comments, string literals, template literals, and regex literals, plus JSX
- WHEN run
- THEN only real imports and exports are recorded

#### Scenario: Non-JS/TS files

- GIVEN `.py`, `.go`, and `.md` files
- WHEN run
- THEN they are not extracted as modules

#### Scenario: Unparsable file

- GIVEN a file with broken syntax
- WHEN run
- THEN exit 0 and the file yields only what could be extracted, without crashing the run

### Requirement: Import resolution and graph

Relative specifiers MUST be resolved with extension and `index` probing, including `.js` to `.ts` mapping. `tsconfig.json` `compilerOptions.paths` and `baseUrl` MUST be honored (full `extends` chains beyond one level are not required). A package-name specifier that matches a detected workspace name MUST resolve to that workspace's path; any other bare specifier MUST have `status: 'external'` and `resolved: null`. Resolved specifiers MUST have `status: 'internal'`. Unresolvable relative or alias specifiers, `#imports`, absolute paths and URLs MUST have `resolved: null` and `status: 'unresolved'`. `graph.edges` MUST list resolved module-to-module imports and `graph.importedByCount` MUST count inbound edges per module.

#### Scenario: Relative with extension probing

- GIVEN `import './util'` and `import './helper.js'` where `helper.ts` exists
- WHEN run
- THEN the first resolves to `util.ts` (or matching extension or index) and the second to `helper.ts`

#### Scenario: Index resolution

- GIVEN `import './lib'` where only `lib/index.ts` exists
- WHEN run
- THEN `resolved` is `lib/index.ts`

#### Scenario: Path alias

- GIVEN `tsconfig.json` with `paths` mapping `@/*` to `src/*`
- WHEN run
- THEN `import '@/foo'` resolves to the matching `src/foo` module

#### Scenario: Workspace package import

- GIVEN a workspace package named `@acme/core` and a file importing `@acme/core`
- WHEN run
- THEN `resolved` points at that workspace's path

#### Scenario: External package

- GIVEN `import 'lodash'` with no matching workspace
- WHEN run
- THEN `status` is `external`, `resolved` is `null` and no graph edge is created

#### Scenario: Unresolved relative

- GIVEN `import './missing'`
- WHEN run
- THEN `resolved` is `null`, `status` is `unresolved`, and exit is 0

#### Scenario: Imported-by count

- GIVEN module A imported by B and C
- WHEN run
- THEN `importedByCount` for A is 2

### Requirement: Stack, commands, entry points, workspaces, conventions

The map MUST detect the package manager from the `packageManager` field or lockfile (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`, `bun.lock`). `commands` MUST come from root and workspace `package.json` `scripts`. `entryPoints` MUST come from `package.json` `main`, `module`, `types`, `bin`, and `exports`, as entries with `path`, `package`, `field`, `key` and `file`. Workspaces MUST be detected from `pnpm-workspace.yaml` and `package.json` `workspaces` and recorded as `workspaces[{name, path}]`. `stack` and `conventions` MUST be detected by file presence and `package.json` dependency names (for example `tsconfig.json`, framework, test-runner, lint, and format configs) with no content heuristics beyond reading JSON configs. One map MUST be produced per repository root, with repo-relative module paths and no per-package output files.

#### Scenario: Package manager from field

- GIVEN `packageManager: "pnpm@9"`
- WHEN run
- THEN the stack records pnpm

#### Scenario: Package manager from lockfile

- GIVEN no `packageManager` field and a `yarn.lock`
- WHEN run
- THEN the stack records yarn

#### Scenario: Commands

- GIVEN root and workspace `package.json` files with `scripts`
- WHEN run
- THEN `commands` includes them, attributed to their package

#### Scenario: Entry points

- GIVEN `package.json` with `main`, `bin`, and `exports`
- WHEN run
- THEN `entryPoints` lists the referenced files

#### Scenario: Workspace monorepo

- GIVEN `pnpm-workspace.yaml` or `package.json` `workspaces` declaring two packages
- WHEN run
- THEN `workspaces` lists both with name and path, modules keep repo-relative paths, and only one map is produced at the root

#### Scenario: Conventions by presence

- GIVEN `tsconfig.json`, an ESLint config, a Prettier config, and a Vitest dependency
- WHEN run
- THEN `stack` and `conventions` reflect them

#### Scenario: Tree in JSON

- GIVEN nested directories
- WHEN run
- THEN `tree` lists each directory with its file count at full depth

### Requirement: Markdown digest and size cap

The Markdown MUST be a pure function of the JSON document. It MUST render the folder tree at directory level limited by `--max-depth`, the stack, commands, entry points, and signatures of exported symbols. Its size MUST NOT exceed approximately 8k tokens, estimated as characters divided by 4. When over the cap, truncation MUST be deterministic: first drop signatures of the least-imported files (ties broken by path), then reduce deeper tree levels. The Markdown MUST state explicitly what was omitted. The JSON MUST NOT be affected by truncation.

#### Scenario: Under cap

- GIVEN a small repository
- WHEN run
- THEN the Markdown contains no omission note and includes tree, stack, commands, entry points, and signatures

#### Scenario: Over cap truncation

- GIVEN a repository whose full Markdown exceeds the cap
- WHEN run
- THEN the Markdown is within the cap, least-imported files' signatures were dropped first, and an omission note states what was omitted

#### Scenario: Tree reduction after signatures

- GIVEN signatures already fully dropped and the output still over the cap
- WHEN rendered
- THEN deeper tree levels are removed deterministically and the omission note reflects it

#### Scenario: JSON stays complete

- GIVEN a truncated Markdown
- WHEN the JSON is inspected
- THEN all modules, exports, and tree levels are present

#### Scenario: Deterministic truncation

- GIVEN the same over-cap repository
- WHEN run twice
- THEN the Markdown is byte-identical

### Requirement: Catalog registration and documentation

`repo-map` MUST be registered in `catalog/catalog.json` `items.scripts` with valid `script.json` metadata declaring `tools: []`, and MUST ship no dependencies or script-root `package.json`. Registration lands in the first slice, because an unlisted script directory is a catalog issue; the hand-written prose lands in the third slice. The generated README script table and website catalog pages (en/es) MUST include `repo-map`, and hand-written prose that enumerates the bundled scripts (README, website overview en/es, `CONTRIBUTING.md`) MUST list it. The script MUST NOT edit `.gitignore`.

#### Scenario: Registered with metadata

- GIVEN the bundled catalog
- WHEN loaded
- THEN `repo-map` is present with `tools: []` and validates

#### Scenario: Docs generated

- GIVEN the catalog registration
- WHEN `docs:catalog:check` runs
- THEN it passes and the README table and website pages include `repo-map`

#### Scenario: Prose updated

- GIVEN hand-written script enumerations in README, website overview, and `CONTRIBUTING.md`
- WHEN reviewed
- THEN each lists `repo-map` with the other bundled scripts

#### Scenario: Gitignore untouched

- GIVEN a repository with a `.gitignore`
- WHEN run
- THEN `.gitignore` is unchanged
