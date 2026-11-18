# Design: Catalog Repo-Map Script

## Technical Approach

`catalog/scripts/repo-map/` is a plain-ESM, zero-dependency catalog script, like `dead-code` and `duplication`: it parses its own arguments, versions its envelope and owns its exit codes. Unlike those siblings it spawns no analysis tool. Its only optional subprocess is `git`.

The script is an **imperative shell around a pure core**:

1. `scan.mjs` (the shell) lists the files, reads source files and manifests within size guards, and asks git for `HEAD`. It returns an in-memory **snapshot**.
2. `build-map.mjs` (the pure core) turns the snapshot into the complete `shitaku.catalog.repo-map/v1` document. It uses the extractor table, the import resolver, project detection, the tree and the graph.
3. `render-json.mjs` and `render-markdown.mjs` are pure functions of the document.
4. `index.mjs` connects the stages, writes the files atomically and maps errors to exit codes.

Only `scan.mjs` and `index.mjs` touch `node:fs`, `node:child_process` or `process`. Every other module is a pure function. That keeps them unit-testable with in-memory inputs, which strict TDD needs, and makes determinism a property of pure code. This mirrors the repository's hexagonal rule (domain free of infrastructure) inside the script itself, with no `src/` change.

This follows the proposal's approach A (heuristic scanner) and its confirmed decisions 1 to 4. Proposal defaults are kept unless a decision below refines them.

## Architecture Decisions

### Decision: Flat helper modules in the script directory

**Choice**: Ship these flat files in `catalog/scripts/repo-map/`: `index.mjs`, `script.json`, `args.mjs`, `scan.mjs`, `glob.mjs`, `jsonc.mjs`, `tokenize-js.mjs`, `extract-js.mjs`, `extractors.mjs`, `resolve.mjs`, `project.mjs`, `build-map.mjs`, `render-json.mjs` and `render-markdown.mjs`.
**Alternatives considered**: A single `index.mjs` (more than 1,000 lines, impossible to unit test by stage); a `lib/` subdirectory (the installer copies trees, but this repo's multi-file script, `complexity`, uses flat files and `bundled-catalog.test.ts` asserts exact flat file lists).
**Rationale**: One module per pipeline stage matches the per-stage unit tests and the per-language extractor table. Flat layout follows the `complexity` precedent and keeps the `files` assertion a simple sorted list.

### Decision: Pure core, single IO shell, in-memory snapshot

**Choice**: `scan(root, options)` returns a snapshot:

```js
{
  commit,     // string | null
  files,      // POSIX paths, sorted
  sources,    // Map<path, text> for source files only
  manifests,  // Map<dirPath, parsed package.json | { invalid: true }>
  tsconfigs,  // Map<dirPath, parsed tsconfig | null>
  skipped,    // [{ path, reason }]
  textFiles,  // Map<path, text>; only pnpm-workspace.yaml
}
```

`buildRepoMap(snapshot, options)` is pure. Import resolution probes the **in-memory file set** only and never calls `fs.existsSync`.
**Alternatives considered**: Resolve imports with filesystem probes (`existsSync`) during extraction. This mixes IO into the core, is slower, and its result depends on the filesystem (case-insensitive volumes accept `./Foo` for `foo.ts`).
**Rationale**: The core is deterministic and testable, and resolution follows exactly what the listing saw, including ignores.

### Decision: File listing via `git ls-files -z`, walk fallback, uniform ignores

**Choice**:

- When the script runs in a git work tree, list files with `git ls-files -z --cached --others --exclude-standard`, using `spawnSync('git', [...], { cwd: root, shell: false })`. Paths come back relative to `cwd`. `-z` avoids `core.quotePath` quoting.
- Then drop entries that are not regular files (`lstat`): deleted-but-tracked files, submodule gitlinks and symlinks. Symlinks go to `skipped` with reason `symlink`.
- If git fails for any reason (ENOENT, not a repo, non-zero exit), use a deterministic recursive walk instead. The walk sorts `readdir` entries by code-unit order and does not follow symlinked directories (recorded as `symlink`). It does not read `.gitignore`, which is a documented limitation.
- The same ignore filter applies to both listings:
  - built-ins: `node_modules`, `dist`, `build`, `coverage`, `.git`, `.hg`, `.svn` and `.shitaku`, matched as any path segment;
  - the `--out` directory when it is inside the root;
  - user `--ignore` globs.
- `commit` comes from `git rev-parse HEAD` and is `null` on any failure, including a repository with no commits.

**Alternatives considered**: Parse `.gitignore` in the walk (reimplements git semantics poorly); walk only (misses `.gitignore`, so generated files leak in); git only (fails in non-git folders and in tarballs).
**Rationale**: `.gitignore` is respected when git exists, and the script still works without it. Uniform ignores keep the two listing paths equivalent on a tree without `.gitignore` rules, which a test checks.

### Decision: Glob dialect for `--ignore` and workspace patterns

**Choice**: One `globToRegExp` in `glob.mjs`:

- `**` matches any number of segments, `*` matches inside a segment, and `?` matches one character. Everything else is literal.
- A pattern without `/` matches any single path segment, like gitignore basenames.
- A pattern with `/` is anchored at the repository root.
- A path is ignored when the path itself or any ancestor directory matches.
- Workspace globs use the same matcher against directories that contain a listed `package.json`. Leading `!` negates the match.

**Alternatives considered**: Implement full minimatch or picomatch semantics (dependency or large code); use `path.matchesGlob` (experimental in Node 22, and its behavior varies between versions).
**Rationale**: It is small, deterministic and has no dependency. It covers `packages/*`, `apps/**` and `*.generated.ts`.

### Decision: Comment, string and template-aware tokenizer with line-bounded recovery

**Choice**: `tokenize-js.mjs` is a single pass that emits `{ type, value, start, end, line }` tokens. Token types are `ident`, `punct`, `string`, `template` and `number`. Comments are not emitted, but the whitespace and comment gap before each token is flagged.

- Template literals use a mode stack, so `${ ... }` expressions are tokenized and nested templates work.
- A `/` starts a regular expression when the previous significant token is not an identifier, number, `)`, `]` or `}`, or when it is a keyword from: `return`, `typeof`, `instanceof`, `in`, `of`, `new`, `delete`, `void`, `throw`, `case`, `do`, `else`, `yield`, `await`.
- An unterminated quoted string ends at the end of its line, as JavaScript requires.
- The tokenizer never throws. Unknown characters become `punct`.

**Alternatives considered**: Run regular expressions over raw text (comments and strings produce false imports); call `stripTypeScriptTypes` and then use regular expressions (no signatures, and it fails on JSX); use a full parser (violates the zero-dependency policy).
**Rationale**: Comments, strings and templates are the main sources of false matches. Line-bounded string recovery limits JSX text damage (for example, an apostrophe in `<p>Don't</p>`) to one line. Known residual risk: JSX text that contains `/*`, and `/` after `)` in `if (x) /re/`. Both degrade to missed or extra entries, never a crash.

### Decision: Extraction only at top level, plus calls at any depth

**Choice**: `extract-js.mjs` walks the tokens and tracks `{}` depth. It recognizes the following forms.

| Form                                                                                                | Where     | Result                                                                                                         |
| --------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `import ... from 's'`, `import 's'`                                                                 | depth 0   | import `kind: 'static'` (`'type'` for `import type`)                                                           |
| `export ... from 's'`, `export * from 's'`, `export * as ns from 's'`                               | depth 0   | import `kind: 'reexport'`, plus export entries: names, or `{ name: '*', kind: 'reexport-all' }`                |
| `export function` / `class` / `const` / `let` / `var` / `type` / `interface` / `enum` / `namespace` | depth 0   | export with that kind (`async`, `declare`, `abstract`, `const enum` and destructured `const { a, b }` handled) |
| `export default ...`                                                                                | depth 0   | `{ name: 'default', kind: 'function' \| 'class' \| 'expression' }`                                             |
| `export { a, b as c }`                                                                              | depth 0   | exports; the signature is copied from the local declaration when it is found                                   |
| `module.exports =`, `exports.x =`, `module.exports.x =`                                             | depth 0   | `default` or named export, `kind: 'commonjs'`                                                                  |
| `require('s')`                                                                                      | any depth | import `kind: 'require'`                                                                                       |
| `import('s')`                                                                                       | any depth | import `kind: 'dynamic'`                                                                                       |

`import.meta`, non-literal `require(x)` and `import(x)`, and exports nested in `declare module` or `namespace` blocks are ignored.
**Signatures** are rebuilt from the header tokens. One space is placed where the source had whitespace or a comment, so comments never leak and CRLF does not matter. The header ends at:

- the body `{` at paren and angle depth 0 for functions, classes, interfaces, enums and namespaces;
- the initializer `=` for `const`, `let` and `var`;
- the statement end for type aliases.

Signatures longer than 200 characters are clipped and end in `...`.
**Alternatives considered**: Extract nested and conditional exports (no real value, more false positives); record non-literal dynamic imports as `unresolved` (noise, because there is nothing to resolve).
**Rationale**: Module boundaries are defined at top level. Depth tracking avoids false exports in function bodies and in ambient module blocks.

### Decision: Per-language extractor table

**Choice**: `extractors.mjs` exports a frozen table that maps extension to `{ language, extract }`:

- `.ts .mts .cts` map to `typescript`;
- `.tsx` maps to `tsx`;
- `.js .mjs .cjs` map to `javascript`;
- `.jsx` maps to `jsx`.

Every entry points to `extractJs`. `build-map.mjs` only consults the table. A file whose extension is not in the table is listed in `tree` but is not a module.
**Alternatives considered**: Hard-code the extension checks in `build-map.mjs`.
**Rationale**: This is the extension point confirmed in decision 3. A future Python or Go extractor is one table row plus one module.

### Decision: Import resolution against the listed file set, with an explicit status

**Choice**: `createResolver({ files, tsconfigs, workspaces })` returns `resolve(importer, specifier)`, which gives `{ resolved: string | null, status: 'internal' | 'external' | 'unresolved' }`.

Each specifier is checked against these rules in order:

1. **Relative (`./`, `../`)**: probe in this order, keeping the first match:
   1. the exact path;
   2. for `.js`, `.jsx`, `.mjs` and `.cjs`: their TypeScript counterparts (`.ts`, `.tsx`, `.mts`, `.cts`);
   3. the path plus each extension in the fixed order `.ts .tsx .mts .cts .js .jsx .mjs .cjs`;
   4. `<path>/index` plus each extension, in the same order.

   No match gives `unresolved`. A non-source target that is in the listing, such as `./data.json` or `./x.css`, resolves to that file.

2. **tsconfig `paths`**: use the nearest `tsconfig.json` among the importer's workspace directory and the root.
   - JSONC is supported.
   - `extends` is followed for one level, and only for relative files.
   - `baseUrl` is resolved relative to the tsconfig that declares it.
   - Patterns are matched longest prefix first. Each candidate is probed as in rule 1.
   - When a pattern matches but no candidate exists, the result is `unresolved`.
3. **Workspace package name**: when the bare package name (`pkg` or `@scope/pkg`) equals a detected workspace name:
   - A subpath is probed under the workspace directory.
   - Without a subpath, these are tried in order: the `exports['.']` string leaf (conditions `import`, then `default`), then `module`, then `main`, then `src/index.*`, then `index.*`.
   - No hit gives `unresolved`.
4. **`node:` builtins and other bare specifiers**: `external`, with `resolved: null`.
5. **Anything else** (`#imports`, absolute paths, URLs): `unresolved`.

**Alternatives considered**: Return only `resolved | null`, as the proposal sketch does. Consumers would then have to tell "external package" apart from "broken alias" themselves. The other alternative was probing the real filesystem.
**Rationale**: An explicit `status` is the proposal's "explicit unresolved markers" made machine-readable. This adds the `status` field to each import in the proposal's envelope; the spec must include it.

### Decision: Canonical JSON writer with sorted keys and explicit array comparators

**Choice**:

- `render-json.mjs` sorts object keys recursively by code-unit order, then emits `JSON.stringify(sorted, null, 2) + '\n'`.
- Arrays are sorted where they are built, with explicit comparators. Every string comparison uses `<` and `>`, never `localeCompare`.

| Collection                                 | Sort order                           |
| ------------------------------------------ | ------------------------------------ |
| `modules`, `tree`, `skipped`, `workspaces` | by `path`                            |
| `imports`                                  | by `(specifier, kind)`, deduplicated |
| `exports`                                  | by `(name, kind)`                    |
| `graph.edges`                              | by `(from, to)`, deduplicated        |
| `commands.scripts`                         | by `(path, name)`                    |
| `entryPoints`                              | by `(path, field, key)`              |

**Alternatives considered**: A fixed top-level key order with `schema` first (readable, but every builder becomes order-sensitive and regressions are silent); `localeCompare` (depends on locale and ICU, so it is not byte-stable).
**Rationale**: One invariant enforced in one place. A byte-equality test proves it.

### Decision: No absolute paths and no timestamps in output

**Choice**:

- The output contains only repository-relative POSIX paths.
- The proposal's `root` field is `{ packageName: string | null }`, taken from the root `package.json` `name`. It is never the absolute working directory.
- `commit` is the only VCS datum.
- Numbers are integers only (counts), so float formatting never arises.

**Alternatives considered**: `root` as an absolute path or a directory basename.
**Rationale**: Absolute paths leak the user's home directory and break byte equality across checkouts and temporary test directories.

### Decision: Project detection is file presence plus JSON manifests only

**Choice**: `project.mjs` contains pure functions over the snapshot.

- **`detectWorkspaces`**:
  - Reads `pnpm-workspace.yaml`. A minimal line parser handles only the `packages:` list: `- 'glob'` or `- glob`, quoted or not, with `!` negation.
  - Reads `package.json` `workspaces`, as an array or as `{ packages }`.
  - Matches the patterns with the glob matcher against directories that contain a listed `package.json`.
  - Produces `[{ name: string | null, path }]`.
- **`detectCommands`**:
  - Package manager: the `packageManager` field (the name before `@`), or else lockfile presence, checked in the order `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`, `bun.lock`.
  - `scripts` from the root and workspace manifests.
- **`detectEntryPoints`**: reads `main`, `module`, `types`, `bin` (string or map) and `exports` (string leaves, flattened with condition and subpath keys joined by `>`) from the root and workspace manifests. Targets are normalized to repository-relative paths and kept even when they point into an ignored directory such as `dist`.
- **`detectStack`**:
  - Languages, with file counts per extractor language.
  - Node engine range.
  - TypeScript: whether a config exists and the version from the dependencies.
  - Frameworks, test runners, linters, formatters and bundlers, from fixed dependency-name lookup tables and config file presence (`vitest.config.*`, `jest.config.*`, `eslint.config.*`, `.eslintrc*`, `.prettierrc*`, `biome.json*`, and similar).
  - The dependency names come from root and workspace `dependencies`, `devDependencies` and `peerDependencies`.
- **`detectConventions`**:

  | Field                      | Values                                                                            |
  | -------------------------- | --------------------------------------------------------------------------------- |
  | `moduleSystem`             | `esm`, `commonjs` or `mixed`, from the root `type` and the extension counts       |
  | `testFiles`                | `{ pattern: 'test' \| 'spec' \| 'mixed' \| null, dirs: [...] }`                   |
  | `relativeImportExtensions` | `js`, `none` or `mixed`, by majority over relative specifiers in TypeScript files |
  | `pathAliases`              | the sorted tsconfig `paths` keys                                                  |
  | `tsStrict`                 | `boolean \| null`                                                                 |

An invalid `package.json` is recorded in `skipped` with reason `invalid-json` and ignored for detection.
**Alternatives considered**: Content heuristics (for example, grepping for `describe(`); a YAML dependency for `pnpm-workspace.yaml`.
**Rationale**: The proposal default says no content heuristics beyond JSON configs. A line parser limited to `packages:` covers real pnpm workspaces without a YAML library.

### Decision: Markdown is a pure function of the JSON, with block-level truncation

**Choice**: `render-markdown.mjs`:

- **Sections**: a header with the schema, the commit (`none` when null), the package and a pointer to `repo-map.json`; then Stack, Commands, Workspaces, Entry points, Conventions, Tree (directories only, depth up to `--max-depth`) and Modules.
- **Modules section**: modules are ordered by `importedByCount` descending, then by `path`. Each module block has a heading with the path and its imported-by count, a `deps:` line of internal resolved imports, and one line per export signature.
- **Budget**: the cap is `MAX_TOKENS = 8000` with `CHARS_PER_TOKEN = 4`, so 32,000 characters including the omission note. Blocks are measured once and truncation updates a running length, so it never re-renders in a loop. When over budget, these stages run in order:
  1. Replace a module's signature lines with one `exports: a, b, c` names line. Least important first: ascending `importedByCount`, then descending path, which is the exact reverse of display order.
  2. Lower the tree depth one level at a time from `--max-depth` toward 1.
  3. Drop whole module blocks, least important first.
  4. Safety net: cut at the last line boundary that fits.
- **Omission note**: when any stage ran, a final `## Omitted` section states each stage's count ("signatures collapsed for N modules", "tree limited to depth D", "N modules not listed", "output cut at the size limit") and that `repo-map.json` is complete. Its maximum length (512 characters) is reserved in the budget up front.

**Alternatives considered**: Truncate by characters only (breaks Markdown structure and drops the most important modules arbitrarily); use a real tokenizer for the count (needs a dependency); re-render after every removal (O(n²) on large repositories).
**Rationale**: Matches decision 4: least-imported signatures first, then deeper tree levels, then the explicit note. The four stages guarantee the cap. Stage 4 handles the edge case where the fixed sections alone exceed the budget.

### Decision: Thin CLI contract with atomic writes

**Choice**:

- **`args.mjs`**: `parseArgs(argv)` returns options, or throws a usage error with `exitCode: 2`. It accepts:
  - `--format json|markdown|both`;
  - `--out <dir>` (default `.shitaku`, relative to the working directory);
  - `--max-depth <n>` (integer 1 or higher, default 4);
  - `--ignore <glob>` (repeatable).

  It rejects missing values, unknown options and positional arguments with `repo-map: ...` messages, like `duplication`.

- **`index.mjs`**: it does these steps in order:
  1. Resolve the working directory with `realpath`.
  2. Scan the tree.
  3. Build the document.
  4. Render every selected output **before** writing any of them.
  5. Run `mkdirSync(out, { recursive: true })`.
  6. Write each file to `<name>.tmp` and then `renameSync` it into place.
  7. Print `wrote <relative path>` per file to stdout.
  8. Exit 0.

  Any thrown error prints `repo-map: <message>` to stderr and exits 2.

- **Unselected outputs**: an output not selected by `--format` is neither written nor deleted.

**Alternatives considered**: Print the JSON to stdout like the siblings (the confirmed decision is files in `.shitaku/`); write directly without the temporary file (a crash could leave a half-written map that #226 would read).
**Rationale**: Matches the sibling CLI style and the confirmed output location. Rendering everything before writing anything means a failure never leaves a mixed pair of old and new files.

### Decision: In-memory fixture trees instead of `test/fixtures/repo-map/**`

**Choice**:

- Fixtures are TypeScript objects (`Record<path, content>`) in `test/helpers/repo-map.ts`: `simpleApp`, `trickySyntax`, `aliases`, `workspaceMonorepo` and `nonGit`.
- At test time a `writeTree(dir, files)` helper writes them into `mkdtemp` directories.
- Git fixtures run `git init` and `git add` in the temporary directory, and commit with fixed author, committer and dates through environment variables, so the commit hash is stable.

**Alternatives considered**: On-disk fixtures under `test/fixtures/repo-map/` (the proposal's plan). Those `.ts`/`.tsx` files would be included by `tsconfig.json` (`include: ["test"]`) and linted by type-checked ESLint (`**/*.ts`). lint-staged would also rewrite them with `eslint --fix` and `prettier --write` on commit. So intentionally tricky or unresolvable fixture code would fail `typecheck` and `lint`, or be silently reformatted. The other alternative was to add tsconfig, ESLint and Prettier ignores for the folder, which widens repository tooling configuration for one script.
**Rationale**: No tooling configuration change. Fixture bytes are exact, including CRLF and unusual syntax. A real `.git` directory cannot be committed inside a fixture anyway.

### Decision: Unit tests import the `.mjs` modules through typed dynamic imports

**Choice**: `test/helpers/repo-map.ts` provides `loadRepoMapModule<T>(name: string): Promise<T>`. It runs `await import(pathToFileURL(join(SCRIPT_DIR, name)).href)` and casts the result with `as T` to a local TypeScript type that describes the module API.
**Alternatives considered**: Spawn tests only (slow, coarse RED signals for tokenizer edge cases); `allowJs` or `.d.mts` declaration files (changes tsconfig or ships type files in the catalog directory, which breaks the exact-file assertion).
**Rationale**: Unit tests give fast and precise RED steps for the pure modules. Spawn tests cover the process contract. Casting keeps `no-unsafe-*` lint rules quiet without disabling them.

## Data Flow

```
argv ──> args.mjs ──> options
                         │
cwd (realpath) ──> scan.mjs ──(git ls-files -z | walk)──> files
                    │   ├──(git rev-parse HEAD)──> commit | null
                    │   ├──(lstat/size guard/read)──> sources, skipped
                    │   └──(read package.json, tsconfig.json, pnpm-workspace.yaml)
                    v
                 snapshot ──> build-map.mjs (pure)
                                ├── project.mjs: workspaces, stack, commands, entryPoints, conventions
                                ├── extractors.mjs -> extract-js.mjs -> tokenize-js.mjs: imports/exports
                                ├── resolve.mjs (in-memory file set, tsconfig paths, workspaces)
                                └── tree + graph{edges, importedByCount}
                                        │
                                        v
                                    document (v1)
                                   ┌────┴─────┐
                          render-json.mjs   render-markdown.mjs (cap + omission note)
                                   └────┬─────┘
                       index.mjs: render all -> mkdir -> write .tmp -> rename -> exit 0 | 2
```

## File Changes

| File                                                                   | Action         | Slice              | Description                                                                                                                                                              |
| ---------------------------------------------------------------------- | -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog/scripts/repo-map/script.json`                                 | Create         | 1 (updated in 3)   | name, description, `tools: []`, args, output, exitCodes `{0, 2}`                                                                                                         |
| `catalog/scripts/repo-map/index.mjs`                                   | Create         | 1 (updated in 3)   | CLI shell: compose stages, atomic writes, exit codes                                                                                                                     |
| `catalog/scripts/repo-map/args.mjs`                                    | Create         | 1 (updated in 3)   | `parseArgs`                                                                                                                                                              |
| `catalog/scripts/repo-map/scan.mjs`                                    | Create         | 1                  | git listing and walk fallback, ignores, guards, commit, manifest reads                                                                                                   |
| `catalog/scripts/repo-map/glob.mjs`                                    | Create         | 1                  | `globToRegExp`, `isIgnored`, `matchAny`                                                                                                                                  |
| `catalog/scripts/repo-map/jsonc.mjs`                                   | Create         | 1                  | `parseJsonc` (comments and trailing commas outside strings) for tsconfig                                                                                                 |
| `catalog/scripts/repo-map/project.mjs`                                 | Create         | 1                  | workspaces, stack, commands, entry points, conventions                                                                                                                   |
| `catalog/scripts/repo-map/build-map.mjs`                               | Create         | 1 (extended in 2)  | assemble document, tree, graph                                                                                                                                           |
| `catalog/scripts/repo-map/render-json.mjs`                             | Create         | 1                  | canonical JSON                                                                                                                                                           |
| `catalog/scripts/repo-map/tokenize-js.mjs`                             | Create         | 2                  | tokenizer                                                                                                                                                                |
| `catalog/scripts/repo-map/extract-js.mjs`                              | Create         | 2                  | imports, exports, signatures                                                                                                                                             |
| `catalog/scripts/repo-map/extractors.mjs`                              | Create         | 1 (wired in 2)     | extension table (slice 1: language only; slice 2: `extract`)                                                                                                             |
| `catalog/scripts/repo-map/resolve.mjs`                                 | Create         | 2                  | resolver                                                                                                                                                                 |
| `catalog/scripts/repo-map/render-markdown.mjs`                         | Create         | 3                  | Markdown with cap and omission note                                                                                                                                      |
| `catalog/catalog.json`                                                 | Modify         | 1                  | add `repo-map` to `items.scripts`                                                                                                                                        |
| `test/helpers/repo-map.ts`                                             | Create         | 1 (extended later) | `runRepoMap`, `writeTree`, `initGitRepo`, `loadRepoMapModule`, fixture trees                                                                                             |
| `test/catalog/scripts/repo-map.test.ts`                                | Create         | 1 (extended later) | spawn tests: CLI, IO, git and walk, exit codes, determinism                                                                                                              |
| `test/catalog/scripts/repo-map/*.test.ts`                              | Create         | 1 to 3             | unit tests mirroring each pure `.mjs` (`args`, `glob`, `jsonc`, `project`, `build-map`, `render-json`, `tokenize-js`, `extract-js`, `resolve`, `render-markdown`)        |
| `test/adapters/catalog/bundled-catalog.test.ts`                        | Modify         | 1                  | script lists, `toHaveLength(4)`, `repo-map` file list (updated per slice as files are added); a separate no-bootstrap assertion for `repo-map` outside the two-file loop |
| `openspec/changes/add-repo-map-script/specs/scripts-install/spec.md`   | Create (delta) | 1                  | bundled list includes `repo-map`                                                                                                                                         |
| README script table, `website/.../catalog/scripts/repo-map.md` (en/es) | Generated      | 1 and 3            | `pnpm run docs:catalog`, `pnpm run docs:website-catalog` (regenerated whenever `script.json` changes)                                                                    |
| README prose, website `overview.md` (en/es), `CONTRIBUTING.md`         | Modify         | 3                  | update the hand-written lists of scripts                                                                                                                                 |

## Interfaces / Contracts

```ts
// Envelope written to <out>/repo-map.json (keys emitted sorted; shown here grouped for reading)
type RepoMap = {
  schema: 'shitaku.catalog.repo-map/v1';
  commit: string | null;
  root: { packageName: string | null };
  stack: {
    languages: { name: string; files: number }[];
    packageManager: string | null;
    node: string | null; // engines.node
    typescript: { config: boolean; version: string | null };
    frameworks: string[];
    testRunners: string[];
    linters: string[];
    formatters: string[];
    bundlers: string[];
  };
  workspaces: { name: string | null; path: string }[];
  commands: { packageManager: string | null; scripts: { path: string; name: string; command: string }[] };
  entryPoints: {
    path: string;
    package: string | null;
    field: 'main' | 'module' | 'types' | 'bin' | 'exports';
    key: string | null;
    file: string;
  }[];
  tree: { path: string; files: number; totalFiles: number }[]; // every directory, full depth; '.' is the root
  modules: {
    path: string;
    language: 'typescript' | 'tsx' | 'javascript' | 'jsx';
    imports: {
      specifier: string;
      kind: 'static' | 'type' | 'reexport' | 'require' | 'dynamic';
      status: 'internal' | 'external' | 'unresolved';
      resolved: string | null;
    }[];
    exports: { name: string; kind: string; signature: string | null }[];
  }[];
  graph: { edges: { from: string; to: string }[]; importedByCount: Record<string, number> }; // every module key present, 0 included
  conventions: {
    moduleSystem: 'esm' | 'commonjs' | 'mixed';
    testFiles: { pattern: 'test' | 'spec' | 'mixed' | null; dirs: string[] };
    relativeImportExtensions: 'js' | 'none' | 'mixed' | null;
    pathAliases: string[];
    tsStrict: boolean | null;
  };
  skipped: { path: string; reason: 'too-large' | 'unreadable' | 'symlink' | 'invalid-json' }[];
};
```

Script module APIs (JSDoc-typed `.mjs`, mirrored as TypeScript types in `test/helpers/repo-map.ts`):

```js
parseArgs(argv: string[]): { format: 'json'|'markdown'|'both', out: string, maxDepth: number, ignore: string[] }
scan(root: string, opts: { ignore: string[], outRel: string|null }): Snapshot
buildRepoMap(snapshot: Snapshot): RepoMap
tokenize(source: string): Token[]
extractJs(source: string): { imports: RawImport[], exports: RawExport[] }
createResolver(ctx): (importer: string, specifier: string) => { resolved: string|null, status }
renderJson(map: RepoMap): string
renderMarkdown(map: RepoMap, opts: { maxDepth: number }): string
```

Constants: `SCHEMA`, `MAX_FILE_BYTES = 1_048_576`, `MAX_TOKENS = 8000`, `CHARS_PER_TOKEN = 4`, `SIGNATURE_MAX = 200` and `BUILTIN_IGNORES`.

## Testing Strategy (strict TDD, `pnpm test`)

Each production module is preceded by a failing test (RED), then made to pass (GREEN), then refactored.

| Layer               | What to test                                                                                                                                                                                                                                                                                                          | Approach                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Unit                | `args`: defaults, each flag, repeated `--ignore`, missing value, unknown flag, bad `--format` and `--max-depth`                                                                                                                                                                                                       | typed dynamic import; assert the thrown error has `exitCode: 2`                                             |
| Unit                | `glob`: `**`, `*`, segment-only patterns, anchored patterns, ancestor matching, negation                                                                                                                                                                                                                              | pure                                                                                                        |
| Unit                | `jsonc`: comments, trailing commas, `//` inside strings preserved                                                                                                                                                                                                                                                     | pure                                                                                                        |
| Unit                | `tokenize-js`: comments, strings, template nesting `${`...`}`, regex versus division, unterminated string recovery, CRLF                                                                                                                                                                                              | pure, token type and value snapshots as inline arrays                                                       |
| Unit                | `extract-js`: every row of the extraction table, `import type`, `export * as`, destructured const, CJS, nested ignored, `import.meta`, signature clipping and whitespace collapse, JSX apostrophe, regex containing `import`                                                                                          | pure                                                                                                        |
| Unit                | `resolve`: `.js`→`.ts`, extension order, `index`, JSON target, tsconfig `paths` longest prefix, `baseUrl`, one-level `extends`, workspace name and subpath, `node:` external, `#imports`/absolute unresolved                                                                                                          | pure, in-memory file sets                                                                                   |
| Unit                | `project`: pnpm YAML, `workspaces` array and object, package manager precedence, entry-point flattening, stack tables, conventions majority, invalid `package.json`                                                                                                                                                   | pure snapshots                                                                                              |
| Unit                | `build-map` and `render-json`: tree counts, graph deduplication, `importedByCount` zeros, sorted keys, trailing newline, no absolute path in output                                                                                                                                                                   | pure                                                                                                        |
| Unit                | `render-markdown`: section order, module ordering, no truncation under cap, each truncation stage in order, hard cap holds (`length <= 32000`), omission note contents, deterministic output for a synthetic 2,000-module map                                                                                         | pure                                                                                                        |
| Integration (spawn) | default run writes `.shitaku/repo-map.json` (plus `.md` from slice 3); `--out`; `--format`; `--ignore`; exit 2 for bad argument with no files written; stdout `wrote ...` lines                                                                                                                                       | `runRepoMap(scriptRoot, args, { cwd })`, script copied to a temporary directory as in `duplication.test.ts` |
| Integration (spawn) | git listing honors `.gitignore` and includes untracked files; empty repository gives `commit: null`; a subdirectory run lists only the subtree; `PATH` without git falls back to the walk; `GIT_CEILING_DIRECTORIES` forces the non-git path; git and walk produce identical `modules` on a tree with no `.gitignore` | `initGitRepo` with fixed `GIT_AUTHOR_*` and `GIT_COMMITTER_*` (names, emails, dates)                        |
| Integration (spawn) | guards: file over 1 MiB in `skipped` as `too-large`; symlink in `skipped`; `.shitaku/` and `--out` content never scanned, including the installed script itself; unreadable source in `skipped` (POSIX only, `skipIf` on win32 or root)                                                                               | spawn                                                                                                       |
| Determinism         | two runs in the same directory give identical bytes; the same tree in two different temporary directories gives identical bytes (non-git, `commit: null`); a git fixture with fixed dates gives an identical commit and bytes                                                                                         | spawn and `Buffer.equals`                                                                                   |
| Catalog             | `bundled-catalog.test.ts`: registered, loadable, `tools: []`, exact file list, no `package.json` or `node_modules`                                                                                                                                                                                                    | existing test, extended                                                                                     |

Git-dependent cases use `it.skipIf(!hasGit)`. `test/setup.ts` already sandboxes `HOME`, so commits must take their identity from environment variables, not global configuration.

## Threat Matrix

| Boundary                 | Minimum adversarial cases                                                  | Applicability                                                                                                                                                                   | Design response                                                                                                                                                                                                                                                                                                                                                             | Planned RED tests                                                                                                                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation-like paths | `requirements.txt`, `CMakeLists.txt`, executable Markdown/MDX, `README.sh` | N/A: files are classified by extension only to decide whether to parse them as JS/TS text. No file is ever executed or sourced, and non-JS/TS files are only counted in `tree`. | none                                                                                                                                                                                                                                                                                                                                                                        | none                                                                                                                                                                                                                                                                                                                      |
| Git repository selection | `git -C`, relative and absolute paths                                      | Applicable: the script spawns `git ls-files` and `git rev-parse`                                                                                                                | Fixed argument arrays, `shell: false`, `cwd` set to the `realpath` working directory; never `-C` and never user-supplied git arguments. `--ignore` and `--out` are never forwarded to git. Paths returned by git are relative to `cwd` and are kept only when they stay inside the root (any `..` segment is dropped). Git failure falls back to the walk, never to exit 2. | run from a subdirectory of a git repository gives the subtree only, with paths relative to it; non-git directory (`GIT_CEILING_DIRECTORIES`) uses the walk; git missing from `PATH` uses the walk with `commit: null`; `--ignore` values containing shell metacharacters (`;rm -rf`) are treated as globs and run nothing |
| Commit state             | staged, `commit -a`, empty index                                           | Applicable (read-only): HEAD and index state affect `commit` and the listing                                                                                                    | `commit` is `rev-parse HEAD` or `null`. Listing covers tracked plus untracked-not-ignored files; tracked-but-deleted files are dropped by `lstat`. Nothing is ever staged or committed.                                                                                                                                                                                     | empty repository (no commits) gives `commit: null` and files still listed; untracked new file included; tracked file deleted from the work tree is excluded; the git index and `HEAD` are unchanged after a run                                                                                                           |
| Push state               | tracking branch, first push, explicit refspec                              | N/A: no push or remote operation                                                                                                                                                | none                                                                                                                                                                                                                                                                                                                                                                        | none                                                                                                                                                                                                                                                                                                                      |
| PR commands              | explicit `--head`, environment prefix, composed commands                   | N/A: no PR automation                                                                                                                                                           | none                                                                                                                                                                                                                                                                                                                                                                        | none                                                                                                                                                                                                                                                                                                                      |

## Migration / Rollout

No data migration and no `src/` change. Delivery is `stacked-to-main` (recorded decision `sdd/add-repo-map-script/delivery`). This design must change the slice cut, as explained next.

**Finding that changes the agreed slice 1.** `FolderCatalogSource.loadScripts` calls `flagUnlisted('scripts', ...)` (`src/adapters/catalog/folder-source.ts:128`). Any directory under `catalog/scripts/` that `catalog.json` does not list becomes a catalog issue. `bundled-catalog.test.ts` asserts `catalog.issues` is `[]` and that the script directory list is exact. An unregistered `catalog/scripts/repo-map/` in slice 1 would therefore fail CI on `main`, and would show a catalog issue to users if a release were cut between slices. Releases are manual (`cd.yml` uses `workflow_dispatch`), which limits but does not remove that exposure. **Slice 1 must register the script.** Registration changes `catalog.json`, so it also requires `docs:catalog` (checked in CI) and `docs:website-catalog` regeneration in the same slice.

Recommended cut. Every slice is a working, registered and releasable increment. The document grows additively within v1.

| Slice                                  | Scope                                                                                                                                                                                                                                                                                                                                                                                                                               | Default `--format` |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1. Scanner foundation and registration | `args` (`json` only), `scan` (git, walk, guards, commit), `glob`, `jsonc`, `project` (stack, workspaces, commands, entry points, conventions without `relativeImportExtensions`), `extractors` (language only), `build-map` (tree, `modules[{path, language, imports: [], exports: []}]`, empty graph), `render-json`, `index`, `script.json`, `catalog.json`, `bundled-catalog.test.ts`, `scripts-install` delta, regenerated docs | `json`             |
| 2. Extraction and graph                | `tokenize-js`, `extract-js`, `resolve`, wiring in `extractors` and `build-map`, populated `imports`, `exports`, `graph` and `relativeImportExtensions`; fixtures `trickySyntax`, `aliases`, `workspaceMonorepo`                                                                                                                                                                                                                     | `json`             |
| 3. Markdown and docs                   | `render-markdown`, `--format markdown\|both`, `--max-depth`, default flipped to `both`, `script.json` args and output updated, regenerated docs, hand-written prose (README, website overview en/es, `CONTRIBUTING.md`)                                                                                                                                                                                                             | `both`             |

**Two-slice variant.** This keeps the user's original choice: merge slices 1 and 2. That slice is still registered, so it carries the registration work in place of the Markdown work. It is roughly 1,300 to 1,600 authored lines, far over the 400-line budget. Even the three-slice cut likely puts slices 1 and 2 over 400 lines each, so `sdd-tasks` must forecast this and the user may need to accept `size:exception` or split further. Splitting further would mean, for example, moving project detection into its own slice.

The JSON-only default in slices 1 and 2 changes to `both` in slice 3. That is safe because no consumer exists yet (#226 is unbuilt). The change is recorded in `script.json` and the docs.

**Rollback**: as in the proposal: delete the directory, remove the `catalog.json` entry, revert tests, the spec delta and docs, then regenerate docs. Per slice, revert that slice's commit; earlier slices remain valid on their own.

## Open Questions

- [ ] **Decision needed before tasks/apply**: approve the re-cut slices (slice 1 must be registered because unlisted script directories are catalog issues). Choose the three-slice cut or the two-slice variant, and whether to accept a `size:exception` for slices over 400 lines.
- [ ] The spec must include the design-level envelope refinements: per-import `status`, `root: { packageName }`, `entryPoints[].key/file` and `skipped[].reason` values. These refine the proposal sketch without changing a confirmed decision.
- [ ] Fixtures move from `test/fixtures/repo-map/**` (proposal) to in-memory trees in `test/helpers/repo-map.ts`, for the typecheck, lint and lint-staged reasons above. The spec and tasks should reference the helper instead.
