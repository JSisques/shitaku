# Research: catalog-complexity-script

```yaml
schema: gentle-ai.sdd-research/v1
change: catalog-complexity-script
revision: 2
outcome: done
accessed_date: 2026-10-05
```

## Questions

1. **npx + plugin:** Does `npx -y -p eslint -p eslint-plugin-sonarjs eslint -c <shipped flat config> --format json <files>` (or equivalent documented form) load `eslint-plugin-sonarjs` when the target project has neither package? Does plain `npx eslint` alone fail plugin resolve? Document the exact recommended invocation for ESLint flat config + external plugin via npx.
2. **TypeScript:** With only `eslint` + `eslint-plugin-sonarjs`, can `.ts`/`.tsx` be parsed under a shipped flat config, or must `typescript-eslint` and/or `typescript` be declared in tools / `-p` list? What is the minimal documented set for parsing TS with ESLint 9/10 flat config?
3. **Ignore files:** Does ESLint flat-config default ignore behavior (and/or `ignores`) satisfy “respect ignore files” for a CLI script scanning user paths, or must `.gitignore` / `.eslintignore` be wired explicitly? What is the current ESLint 9/10 documented behavior?

## Admission

| Field                      | Value                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Capability schema          | `gentle-ai.sdd-research-capability` v1                                                                     |
| Declared grants            | `documentation` (Context7: resolve-library-id, query-docs); `open-web` (cursor.WebSearch, cursor.WebFetch) |
| Observed usable            | `documentation` via Context7 — admitted                                                                    |
| Observed denied at runtime | `open-web` tools returned “Interaction not available to subagent” — no open-web primary sources used       |
| Denied classes (declared)  | `bash-as-evidence`, `inferred-mcp`, `training-memory-as-source`                                            |
| Shell                      | Used only for exploration file read path and labeled `corroboration` after documentation claims existed    |

## Sources

### S1

| Field       | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | S1                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| class       | documentation                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| title       | npm CLI — npx / npm-exec (`--package` multiple times, PATH)                                                                                                                                                                                                                                                                                                                                                                                                |
| publisher   | npm                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| URL         | https://github.com/npm/cli/blob/latest/docs/lib/content/commands/npx.md                                                                                                                                                                                                                                                                                                                                                                                    |
| accessed_at | 2026-10-05                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| excerpt     | "The `--package` option may be specified multiple times, to execute the supplied command in an environment where all specified packages are available. If any requested packages are not present in the local project dependencies, then they are installed to a folder in the npm cache, which is added to the `PATH` environment variable in the executed process. A prompt is printed (which can be suppressed by providing either `--yes` or `--no`)." |

### S2

| Field       | Value                                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | S2                                                                                                                                                                                                    |
| class       | documentation                                                                                                                                                                                         |
| title       | npm docs — npx command syntax and `--package`                                                                                                                                                         |
| publisher   | npm                                                                                                                                                                                                   |
| URL         | https://docs.npmjs.com/cli/commands/npx                                                                                                                                                               |
| accessed_at | 2026-10-05                                                                                                                                                                                            |
| excerpt     | Documents forms `npx --package=<pkg>[@<version>] -- <cmd> [args...]` and states packages from `--package` are added to the PATH of the executed command; missing packages install into the npm cache. |

### S3

| Field       | Value                                                                                                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | S3                                                                                                                                                                                             |
| class       | documentation                                                                                                                                                                                  |
| title       | ESLint — Configure Plugins in Flat Config (import plugin package)                                                                                                                              |
| publisher   | ESLint                                                                                                                                                                                         |
| URL         | https://eslint.org/docs/latest/use/configure/migration-guide                                                                                                                                   |
| accessed_at | 2026-10-05                                                                                                                                                                                     |
| excerpt     | Flat config registers plugins by importing the package in the config file, e.g. `import jsdoc from "eslint-plugin-jsdoc"` then `plugins: { jsdoc }` — not by legacy string plugin names alone. |

### S4

| Field       | Value                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | S4                                                                                                                                                                                                              |
| class       | documentation                                                                                                                                                                                                   |
| title       | ESLint — Plugins resolved relative to the end-user project (global ESLint note)                                                                                                                                 |
| publisher   | ESLint                                                                                                                                                                                                          |
| URL         | https://github.com/eslint/eslint/blob/v10.5.0/docs/src/use/migrating-to-6.0.0.md                                                                                                                                |
| accessed_at | 2026-10-05                                                                                                                                                                                                      |
| excerpt     | "If you use global ESLint with plugins, install plugins locally in your projects. For configs extending shareable configs or parsers, ensure these are dependencies of the project containing the config file." |

### S5

| Field       | Value                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| id          | S5                                                                                                              |
| class       | documentation                                                                                                   |
| title       | ESLint — Specify configuration file with CLI `-c` / `--config`                                                  |
| publisher   | ESLint                                                                                                          |
| URL         | https://github.com/eslint/eslint/blob/v10.5.0/docs/src/use/configure/configuration-files.md                     |
| accessed_at | 2026-10-05                                                                                                      |
| excerpt     | `npx eslint --config some-other-file.js "**/*.js"` documents using an explicit config path with the ESLint CLI. |

### S6

| Field       | Value                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | S6                                                                                                                                                                   |
| class       | documentation                                                                                                                                                        |
| title       | typescript-eslint Getting Started — install package set                                                                                                              |
| publisher   | typescript-eslint                                                                                                                                                    |
| URL         | https://typescript-eslint.io/getting-started                                                                                                                         |
| accessed_at | 2026-10-05                                                                                                                                                           |
| excerpt     | `npm install --save-dev eslint @eslint/js typescript typescript-eslint` and flat config example using `tseslint.configs.recommended` with `files: ['**/*.{js,ts}']`. |

### S7

| Field       | Value                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | S7                                                                                                                                                |
| class       | documentation                                                                                                                                     |
| title       | ESLint — Custom parsers / TypeScript parser                                                                                                       |
| publisher   | ESLint                                                                                                                                            |
| URL         | https://eslint.org/docs/latest/use/configure/parser                                                                                               |
| accessed_at | 2026-10-05                                                                                                                                        |
| excerpt     | "While ESLint includes a JavaScript parser, custom parsers like `@typescript-eslint/parser` allow linting of other languages such as TypeScript." |

### S8

| Field       | Value                                                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | S8                                                                                                                                                                                                                     |
| class       | documentation                                                                                                                                                                                                          |
| title       | ESLint — Ignore files (flat config defaults, no `.eslintignore`)                                                                                                                                                       |
| publisher   | ESLint                                                                                                                                                                                                                 |
| URL         | https://eslint.org/docs/latest/use/configure/migration-guide                                                                                                                                                           |
| accessed_at | 2026-10-05                                                                                                                                                                                                             |
| excerpt     | Flat config replaces `.eslintignore` / `ignorePatterns` with config `ignores`. "Unlike eslintrc, flat config does not support loading patterns from `.eslintignore` files". Dotfiles are no longer ignored by default. |

### S9

| Field       | Value                                                                                                                                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | S9                                                                                                                                                                                                                                                                                                    |
| class       | documentation                                                                                                                                                                                                                                                                                         |
| title       | ESLint — Default ignores and `includeIgnoreFile` for `.gitignore`                                                                                                                                                                                                                                     |
| publisher   | ESLint                                                                                                                                                                                                                                                                                                |
| URL         | https://eslint.org/docs/latest/use/configure/ignore                                                                                                                                                                                                                                                   |
| accessed_at | 2026-10-05                                                                                                                                                                                                                                                                                            |
| excerpt     | "By default, ESLint automatically ignores files within `node_modules` and the `.git` directory". To load `.gitignore`, use `includeIgnoreFile(...)` (documented with `gitignoreResolution: true`). Migration guide notes `--ignore-path` is removed for flat config; use `includeIgnoreFile` instead. |

### S10

| Field       | Value                                                                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id          | S10                                                                                                                                                                                                                                                          |
| class       | documentation                                                                                                                                                                                                                                                |
| title       | ESLint v10.5.0 — Flat config ignores and CLI flag removals                                                                                                                                                                                                   |
| publisher   | ESLint                                                                                                                                                                                                                                                       |
| URL         | https://github.com/eslint/eslint/blob/v10.5.0/docs/src/use/configure/migration-guide.md                                                                                                                                                                      |
| accessed_at | 2026-10-05                                                                                                                                                                                                                                                   |
| excerpt     | Flat config uses `ignores` arrays and does not support `.eslintignore`. Removed flat-config CLI flags include `--ignore-path`. Ignore files can be included via `includeIgnoreFile` from `@eslint/compat` (and current site docs also show `eslint/config`). |

## Validated claims

| id  | claim                                                                                                                                                                                                                                                                                                                                               | source_ids | answers |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------- |
| C1  | Documented multi-package npx form uses repeated `--package` / `-p` before the command; missing packages install into the npm cache; that cache location is added to the executed process `PATH` (prompt suppressible with `-y` / `--yes`).                                                                                                          | S1, S2     | Q1      |
| C2  | ESLint flat config loads external plugins by Node-importing the plugin package inside the config file and registering it under `plugins`.                                                                                                                                                                                                           | S3         | Q1      |
| C3  | ESLint documents that plugins used with a non-local ESLint install still need to be installed for the consuming project / that shareable-config and parser deps belong with the project containing the config file — i.e. binary PATH alone is not the documented plugin-resolution model.                                                          | S4         | Q1      |
| C4  | Documented CLI shape for an explicit flat config path is `npx eslint --config <file> <patterns>` (equivalent `-c`). Combining with C1 yields the documented multi-package skeleton: `npx -y --package=eslint --package=eslint-plugin-sonarjs eslint --config <shipped-flat-config> --format json <files>` (short `-p` form is the same npm option). | S1, S2, S5 | Q1      |
| C5  | Official typescript-eslint Getting Started install set for modern flat config is `eslint`, `@eslint/js`, `typescript`, and `typescript-eslint` — not `eslint` + `eslint-plugin-sonarjs` alone.                                                                                                                                                      | S6         | Q2      |
| C6  | ESLint’s built-in parser is JavaScript; linting TypeScript requires a custom parser such as `@typescript-eslint/parser` (provided via the `typescript-eslint` package in the modern setup).                                                                                                                                                         | S6, S7     | Q2      |
| C7  | Flat config does **not** load `.eslintignore`. Ignore patterns are configured via `ignores` / `globalIgnores`.                                                                                                                                                                                                                                      | S8, S10    | Q3      |
| C8  | Default flat-config ignores are `node_modules` and `.git` only; `.gitignore` is **not** applied unless wired with `includeIgnoreFile` (or equivalent explicit patterns). `--ignore-path` is removed under flat config.                                                                                                                              | S9, S10    | Q3      |

## Question answers (evidence-backed)

### Q1 — npx + plugin

**Documented invocation skeleton:** `npx -y -p eslint -p eslint-plugin-sonarjs eslint -c <shipped-flat-config> --format json <files>` (or long `--package=` form) is the npm-documented way to temporarily install multiple packages and run the `eslint` binary with an explicit config [C1, C4].

**Does that load `eslint-plugin-sonarjs` when the target has neither package?** Documentation establishes PATH availability for package bins [C1], while flat config requires a successful Node `import` of the plugin package [C2], and ESLint’s own guidance expects plugins/deps to be installed for the project containing the config [C3]. Official npm docs do **not** state that `--package` installs into the target project’s `node_modules` or sets `NODE_PATH` for ESM imports from an arbitrary shipped config path. Therefore: **the documented multi `-p` form is the correct npx skeleton for fetching packages, but it is not documented as sufficient by itself to satisfy flat-config plugin `import` resolution in a project that lacks the plugin.**

**Plain `npx eslint` alone:** Without providing `eslint-plugin-sonarjs` as an installed/importable package for the config [C2, C3], plugin resolve cannot succeed when the shipped config imports that package.

**Corroboration (not a primary source):** In an empty temp project, both `npx -y -p eslint -p eslint-plugin-sonarjs eslint -c <shipped>/eslint.config.mjs ...` and plain `npx -y eslint -c ...` failed with `ERR_MODULE_NOT_FOUND: Cannot find package 'eslint-plugin-sonarjs' imported from <shipped>/eslint.config.mjs`. A wrapped `node -e` under the same multi `-p` env reported `NODE_PATH` unset and `require.resolve('eslint-plugin-sonarjs')` failing. This is consistent with C1–C3 (PATH ≠ config-local module resolution).

### Q2 — TypeScript

**With only `eslint` + `eslint-plugin-sonarjs`:** Not sufficient to parse TypeScript under documented ESLint setup. ESLint’s parser is JavaScript; TypeScript needs `@typescript-eslint/parser` / `typescript-eslint` [C6]. SonarJS being an ESLint plugin does not replace a TypeScript parser.

**Minimal documented set (ESLint flat + TS parse/lint entry path):** `eslint`, `@eslint/js`, `typescript`, `typescript-eslint` per Getting Started [C5]. For this change’s engine, `eslint-plugin-sonarjs` is an additional plugin dependency on top of that set (product packaging choice). Type-aware linting is optional; Getting Started still lists `typescript` in the install set.

### Q3 — Ignore files

**Defaults do not equal “respect ignore files”.** Flat config defaults ignore only `node_modules` and `.git` [C8]. It does **not** auto-read `.eslintignore` [C7] or `.gitignore` [C8]. To respect a user’s `.gitignore`, the shipped config (or script-generated config) must call `includeIgnoreFile` (or copy patterns into `ignores`). Legacy `.eslintignore` / `--ignore-path` are not the flat-config path [C7, C8].

## Contradictions

- Site/docs show `includeIgnoreFile` imported from both `@eslint/compat` (migration examples) and `eslint/config` (current ignore page). Same helper purpose; import path differs by doc surface — not a behavioral contradiction for “must wire explicitly”.
- npm wording “environment where all specified packages are available” [S1] can be read more broadly than the explicit PATH sentence; combined with ESLint import/plugin docs [S3, S4] and corroboration, the safe evidence reading is PATH/bin availability, not project-local ESM resolution.

## Uncertainty

- Exact durable packaging pattern for making `eslint-plugin-sonarjs` (and `typescript-eslint`) importable beside a shipped catalog config is a **product decision** (local install next to script, vendored `node_modules`, rewrite config to load from a known install root, etc.). Research closes the evidence question; it does not pick the packaging design.
- Whether non-type-aware parsing can omit a top-level `typescript` package in some version ranges is not separately evidenced beyond Getting Started listing it; treat Getting Started as the documented minimal set [C5].
- Open-web grant was declared but unusable in this runtime; all primary claims are from Context7 documentation mirrors of upstream docs. Freshness depends on those mirrors (ESLint pinned query used v10.5.0 tree; typescript-eslint/npm used current site/cli docs as of access date).

## Freshness

| Source      | Freshness note                                                  |
| ----------- | --------------------------------------------------------------- |
| S1–S2       | npm CLI current `latest` docs via Context7 on 2026-10-05        |
| S3, S7–S9   | eslint.org “latest” via Context7 on 2026-10-05                  |
| S4, S5, S10 | ESLint repo docs path `v10.5.0` via Context7 on 2026-10-05      |
| S6          | typescript-eslint.io Getting Started via Context7 on 2026-10-05 |

## Product choices (non-authoritative)

These are **not** research claims. Orchestrator must confirm before proposal readiness.

1. **Plugin/module resolution strategy** for the catalog script when consumer projects lack tools: e.g. install tools into the script install root and run local `node_modules/.bin/eslint`; or generate/load config from a directory that contains the resolved packages; do not rely on multi `-p` alone for flat-config `import`.
2. **TypeScript tool list:** include `typescript-eslint` (+ `typescript`, and likely `@eslint/js` if the shipped config imports it) in `script.json` `tools` / spawn `-p` list beyond `eslint` + `eslint-plugin-sonarjs`.
3. **Ignore policy:** whether the script wires consumer `.gitignore` via `includeIgnoreFile`, ships fixed `ignores`, both, or documents that only defaults/`ignores` apply.
4. **JSON report contract** for #148 remains an exploration/product item, not closed by this research lane.
