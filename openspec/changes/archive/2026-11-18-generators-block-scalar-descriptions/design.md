# Design: Block-Scalar Descriptions in Catalog Doc Generators

## Technical Approach

Exploration approach A, as approved in the proposal. Both doc generators stop parsing frontmatter themselves and read item descriptions through one shared helper, `scripts/lib/frontmatter-description.mjs`. The helper statically imports `readFrontmatter` from `src/domain/catalog/frontmatter.ts` and lets plain `node` load it through native type stripping, which is on by default from Node 22.18. `frontmatter.ts` has no imports and uses only erasable syntax, so this needs no build step, no new dependency and no change to CI step order (`docs:catalog:check` still runs before `build` in `ci.yml`).

The helper also owns the per-kind file path, label and parse mode, so the four identical `*Description()` functions in each script (`skill`, `command`, `agent`, `rule`) go away with the decoder. Agents and rules use nested mode plus whitespace collapse. Skills and commands use strict mode, as the CLI loaders do. Strict-mode parser issues make the generator exit 1 with the file named in the error.

The Node floor moves to `>=22.18` in every place it is stated, and the invalid `engines.node` value `v26.10.0` is fixed (user decision in the proposal).

## Architecture Decisions

### Decision: Import the TypeScript domain reader directly from `.mjs`

**Choice**: Use a static `import { readFrontmatter } from '../../src/domain/catalog/frontmatter.ts';` in `scripts/lib/frontmatter-description.mjs`, loaded by plain `node` with no flags.
**Alternatives considered**: Import from `dist/`, which needs a build before the docs checks in `ci.yml` and `website.yml` and needs `dist` in the test sandbox. Add `tsx` as a devDependency, which is a new dependency. Reimplement the decoder in `.mjs`, which brings back the duplication issue #301 asks to remove. Map `#domain/*` through the `package.json` `imports` field, which changes the published manifest for a dev-only need, and Node still forbids type stripping under `node_modules`.
**Rationale**: This gives one decoder and zero build or dependency coupling. The `../` specifier rule in `test/architecture.test.ts` only scans `src/` and `test/`. Scripts cannot use the `@/` alias under plain Node, so a relative specifier is the honest option there. The explicit `.ts` extension is required because Node does not rewrite extensions.

### Decision: Helper API owns kind, path, label and mode

**Choice**: The helper exports one function, `itemDescription(catalogDir, kind, name)`, that maps each kind to its file, label and mode:

| kind       | file                     | label                    | mode   |
| ---------- | ------------------------ | ------------------------ | ------ |
| `skills`   | `skills/<name>/SKILL.md` | `skills/<name>/SKILL.md` | strict |
| `commands` | `commands/<name>.md`     | `commands/<name>.md`     | strict |
| `agents`   | `agents/<name>.md`       | `agents/<name>.md`       | nested |
| `rules`    | `rules/<name>.md`        | `rules/<name>.md`        | nested |

An unknown kind throws `frontmatter-description: unknown kind '<kind>'`.
**Alternatives considered**: A lower-level `readDescription(path, label, mode)`, with each script keeping its own path builders and mode choices. That leaves four copies of path and mode logic per script, and the two scripts could drift on which mode a kind uses.
**Rationale**: The proposal requires the per-kind mode selection to live in one place. Owning paths and labels too removes the rest of the duplicated code at no extra cost. Both scripts already build the same paths and labels.

### Decision: Mode semantics and output normalization

**Choice**:

- **nested** (agents, rules): `readFrontmatter(text, label, { allowNested: true })`, then `description.replace(/\s+/g, ' ').trim()`. This matches `parseAgent` (`src/domain/catalog/agent.ts`) and `collapseWhitespace` (`src/domain/catalog/listing.ts`).
- **strict** (skills, commands): `readFrontmatter(text, label)` and return `data.description` as is. The reader already trims and unquotes, so there is no collapse.
  **Alternatives considered**: Collapse in strict mode too. This could change bytes for a single-line skill description with internal double spaces, and the old regex kept those. Follow `parseRule`, which only trims and does not collapse. A rule using `|` would then put raw newlines into a README table cell and break the table.
  **Rationale**: The generator output is always one line (a table cell or a YAML string), so nested kinds need the collapse. `rule.ts` differs from `agent.ts` here, and the generator deliberately collapses for both. Strict mode keeps the old bytes. A grep of `catalog/` found no bundled `description:` with internal whitespace runs, so collapsing nested kinds changes no current bytes either. For single-line values, the reader's `unquote` (strip one matching `'` or `"` pair, length >= 2) gives the same result as the old `/^(['"])(.*)\1$/` regex.

### Decision: Error format for reader issues and missing descriptions

**Choice**: The helper throws `Error`. The generators' existing top-level `catch` prints `<script>: <message>` to stderr and exits 1, with no change to the scripts' error plumbing.

- Reader issue: the message is `<label>: <issue>`. When the issue already starts with the label (for example `skills/x/SKILL.md has no frontmatter block`), the issue is used as is so the file name is not repeated.
- Missing or blank description, including an opaque nested `description:` with only indented children: `<label> has no description`.

Example: `generate-catalog-table: commands/review.md: frontmatter has a multi-line value, only single-line values are supported`.
**Alternatives considered**: Skip the bad item and warn. Docs would then silently drop an item the catalog lists. Keep the old wording `has no single-line description`, which is wrong now that block scalars are valid for nested kinds.
**Rationale**: The proposal says docs should not list an item the CLI cannot load, and the error must name the file. Reusing the existing catch keeps the scripts' contract (exit 1 plus a `<script>:` prefix) and the existing tests' expectations.

### Decision: Tolerate a type-stripping `ExperimentalWarning`; do not suppress it

**Choice**: Add no `--no-warnings` or `--disable-warning` flag and no in-script `process` warning listener. If the spike (task 1) shows a warning on Node 22.23.3, tests keep tolerating it. No test asserts empty stderr on success, and failure tests assert substrings only. The spike records the observed result in the tasks evidence.
**Alternatives considered**: Add `--disable-warning=ExperimentalWarning` to the `docs:*` scripts in `package.json`. `test/release-config.test.ts` asserts those script strings exactly (`node scripts/generate-website-catalog.mjs`), and the generator tests spawn the script without that flag anyway. Remove `process` warning listeners before a dynamic import, which forces a dynamic import and puts global process tweaks in a helper.
**Rationale**: As of the Node 22.18 backport, unflagged type stripping is expected to stop emitting the warning, and the spike confirms this. Even if a warning appears, it goes to stderr and changes neither exit codes nor stdout. Suppressing it would add complexity and break exact-string guards. If the spike shows the warning breaks something concrete, the apply phase stops and reports instead of improvising.

### Decision: Portability guard test as a spawned plain-Node import plus a static scan

**Choice**: Create `test/domain/catalog/frontmatter-portability.test.ts` with two checks:

1. **Static**: `src/domain/catalog/frontmatter.ts` contains no module specifiers. It uses the same `from` / `import(` / `import '...'` regex shape as `test/architecture.test.ts`. The failure message names the file and says the docs generators load it under plain Node.
2. **Runtime**: `spawnSync(process.execPath, ['--input-type=module', '-e', script])` with `env` equal to `process.env` minus `NODE_OPTIONS` (proves no loader or flag is needed). The inline script imports the file by `pathToFileURL(...).href`, calls `readFrontmatter('---\ndescription: |\n  a\n  b\n---\n', 'x.md', { allowNested: true })`, and writes `JSON.stringify(result.data)`. The test expects exit 0 and stdout `{"description":"a\nb\n"}`. Node strip-only mode rejects non-erasable syntax (enums, namespaces, parameter properties) with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, and an alias import fails to resolve, so this check covers the "erasable" requirement with no hand-written syntax list.

**Alternatives considered**: Turn on `erasableSyntaxOnly` in `tsconfig.json`, which applies to all of `src/` and is scope creep. Rely only on the generator sandbox tests, which already load the real file but would fail with an unclear generator error.
**Rationale**: `pnpm test` fails early with a direct message, before CI docs steps do. The file sits under `test/domain/catalog/` to mirror the guarded source path.

### Decision: Sandbox mirrors the real layout

**Choice**: In `test/generators.test.ts`, change the sandbox from copying two script files to copying a list of paths: the two generators, `scripts/lib/` (recursive `cpSync`, so any future `scripts/lib/**` file is included) and `src/domain/catalog/frontmatter.ts`. Also write a minimal sandbox `package.json` with `{"type":"module"}` so the `.ts` module type resolves the same way as in the repo and not through syntax detection. Keep the `node_modules` symlink and the `.prettierrc` copy.
**Alternatives considered**: Symlink `src/`. Node would resolve the real path, which works but differs from the existing copy-based style and exposes the whole `src/` to the sandbox.
**Rationale**: The proposal requires the sandbox to provide `scripts/lib/**` and `frontmatter.ts`. Copying keeps the sandbox self-contained and consistent with current practice.

### Decision: Node floor edit list (verified against the real files)

**Choice**: Set `>=22.18` in:

| File                                             | Location                             | From                                | To                                  |
| ------------------------------------------------ | ------------------------------------ | ----------------------------------- | ----------------------------------- |
| `package.json`                                   | `engines.node`                       | `v26.10.0` (invalid range)          | `>=22.18`                           |
| `README.md`                                      | line 12 badge                        | `%3E%3D22.13`                       | `%3E%3D22.18`                       |
| `README.md`                                      | line 25 Quickstart                   | `>=22.13`                           | `>=22.18`                           |
| `README.md`                                      | line 261 Scripts (`index.mjs` entry) | `>=22.13`                           | `>=22.18`                           |
| `CONTRIBUTING.md`                                | line 7 Requirements                  | `>=22.13` ... `.nvmrc` pins 22.22.1 | `>=22.18` ... `.nvmrc` pins 22.23.3 |
| `CONTRIBUTING.md`                                | line 128 script `index.mjs` note     | `>=22.13`                           | `>=22.18`                           |
| `AGENTS.md`                                      | line 7 Overview                      | `Node >= 22.13`                     | `Node >= 22.18`                     |
| `openspec/config.yaml`                           | lines 5 and 18                       | `Node >=22.13`                      | `Node >=22.18`                      |
| `website/src/content/docs/en/getting-started.md` | line 12                              | `>=22.13`                           | `>=22.18`                           |
| `website/src/content/docs/es/getting-started.md` | line 8                               | `>=22.13`                           | `>=22.18`                           |

The real `.nvmrc` is `22.23.3`. CONTRIBUTING's `22.22.1` is stale and is corrected. `.nvmrc` itself does not change.

These stay unchanged on purpose:

- `README.md` line 598 ("Contributors need Node `>=22.22.1`"). This is the contributor-tooling floor, already above 22.18, and backed by `openspec/specs/git-hooks/spec.md` (`.nvmrc` 22.22.1 or later).
- `catalog/scripts/complexity/package.json` `engines` (`>=22.13`). This is the catalog item's own contract. Editing it changes installed bytes and hashes, which is out of scope.
- `openspec/specs/git-hooks/spec.md`. Its `engines.node MUST remain >=22` is still satisfied.
- `pnpm-lock.yaml` and archived changes.

No existing test asserts `engines.node` (grep over `test/` confirmed). A new assertion in `test/release-config.test.ts` checks that `engines.node` is `>=22.18` and that the `.nvmrc` version is at least 22.18. It is RED today because of `v26.10.0`.
**Alternatives considered**: Leave the docs at 22.13 and only fix `engines`. The user rejected this in the proposal. Raise README 598 to 22.23.3. That is a different contributor concern and outside the decision.
**Rationale**: This is the user decision in the proposal. Only the edits above express the runtime floor.

### Decision: Commit type for the Node floor change

**Choice**: `fix(engines): require Node >=22.18 and fix invalid engines range`, with no `!` and no `BREAKING CHANGE` footer. The PR body states that the published minimum rises from 22.13 to 22.18.
**Alternatives considered**: `feat!` or a `BREAKING CHANGE:` footer. `.releaserc.json` uses the `conventionalcommits` preset, which would release 1.0.0 from 0.3.0. `chore:` or `build:` would hide the change from release notes.
**Rationale**: The previous `engines` value was invalid, so this is a fix. It shows up in release notes ("Bug Fixes") without triggering a major release. Whether to cut a major release is the user's call (see Open Questions).

## Data Flow

```
catalog/catalog.json ──► generator (rows / expectedFiles)
                               │ kind, name
                               ▼
              scripts/lib/frontmatter-description.mjs
              itemDescription(catalogDir, kind, name)
                 │ readFileSync(path)
                 ▼
     src/domain/catalog/frontmatter.ts  (plain node, type stripping)
     readFrontmatter(text, label, nested ? {allowNested:true} : {})
                 │ {data,...} | {issue,file}
                 ▼
     issue ─► throw Error(label: issue) ─► generator catch ─► stderr, exit 1
     data  ─► nested: collapse whitespace │ strict: as-is
                 ▼
     README table cell (escape |) / website page frontmatter + body
```

## File Changes

| File                                                                                                                       | Action | Description                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/lib/frontmatter-description.mjs`                                                                                  | Create | `itemDescription(catalogDir, kind, name)`: kind table, reader call, collapse, error format                                                                                                             |
| `scripts/generate-catalog-table.mjs`                                                                                       | Modify | Import helper; delete `frontmatterDescription`, `skillDescription`, `commandDescription`, `agentDescription`, `ruleDescription`; `DESCRIBE` entries call `itemDescription(catalogDir, '<kind>', name)` |
| `scripts/generate-website-catalog.mjs`                                                                                     | Modify | Same removals; `renderSkill/Command/Agent/Rule` call the helper                                                                                                                                        |
| `test/generators.test.ts`                                                                                                  | Modify | Sandbox copies `scripts/lib/`, `src/domain/catalog/frontmatter.ts`, writes `package.json`; new literal/folded/strict-failure tests                                                                     |
| `test/domain/catalog/frontmatter-portability.test.ts`                                                                      | Create | Static no-specifier scan + spawned plain-Node import                                                                                                                                                   |
| `test/release-config.test.ts`                                                                                              | Modify | `website.yml` contains the two new paths; `engines.node` is `>=22.18`; `.nvmrc` >= 22.18                                                                                                               |
| `.github/workflows/website.yml`                                                                                            | Modify | `push` and `pull_request` `paths` add `src/domain/catalog/frontmatter.ts` and `scripts/lib/**`                                                                                                         |
| `package.json`                                                                                                             | Modify | `engines.node` → `>=22.18`                                                                                                                                                                             |
| `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `openspec/config.yaml`, `website/src/content/docs/{en,es}/getting-started.md` | Modify | Node floor text per the edit list                                                                                                                                                                      |
| `src/domain/catalog/frontmatter.ts`                                                                                        | None   | Consumed, not changed                                                                                                                                                                                  |

## Interfaces / Contracts

```js
// scripts/lib/frontmatter-description.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFrontmatter } from '../../src/domain/catalog/frontmatter.ts';

const KINDS = {
  skills: { rel: (n) => `skills/${n}/SKILL.md`, nested: false },
  commands: { rel: (n) => `commands/${n}.md`, nested: false },
  agents: { rel: (n) => `agents/${n}.md`, nested: true },
  rules: { rel: (n) => `rules/${n}.md`, nested: true },
};

/**
 * Description of a catalog item read through the domain frontmatter reader.
 * Agents and rules: nested mode, whitespace collapsed to one line. Skills and commands: strict mode, as the CLI.
 * @param {string} catalogDir @param {'skills'|'commands'|'agents'|'rules'} kind @param {string} name
 * @returns {string}
 */
export function itemDescription(catalogDir, kind, name) {
  const spec = KINDS[kind];
  if (!spec) throw new Error(`frontmatter-description: unknown kind '${kind}'`);
  const label = spec.rel(name);
  const text = readFileSync(join(catalogDir, label), 'utf8');
  const front = spec.nested ? readFrontmatter(text, label, { allowNested: true }) : readFrontmatter(text, label);
  if ('issue' in front) throw new Error(front.issue.startsWith(label) ? front.issue : `${label}: ${front.issue}`);
  const raw = front.data.description ?? '';
  const description = spec.nested ? raw.replace(/\s+/g, ' ').trim() : raw;
  if (description.trim() === '') throw new Error(`${label} has no description`);
  return description;
}
```

This is the shape and is not final code. The apply phase may adjust the JSDoc. The behavior in the table and error decisions is the contract.

## Testing Strategy

Strict TDD (`pnpm run test`). RED is observed before each GREEN.

| Layer                 | What to Test                                                                                                                          | Approach                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guard                 | `frontmatter.ts` import-free and loadable by plain Node                                                                               | `frontmatter-portability.test.ts`. Already-portable code makes it pass immediately, so RED is shown by a scratch mutation (temporarily add an `import` / `enum` to the source, observe both checks fail, revert). The evidence goes in tasks. |
| Integration (sandbox) | Agent `description: \|` renders `Review code carefully` in the README table, and in en/es pages (frontmatter `description:` and body) | New `generators.test.ts` cases. RED: today's output is `\|`.                                                                                                                                                                                  |
| Integration (sandbox) | Rule `description: >` renders folded single-line text in the README table and en/es pages                                             | Same. RED: today's output is `>`.                                                                                                                                                                                                             |
| Integration (sandbox) | Command with `description: \|` makes both generators exit 1 with `commands/<name>.md` and `multi-line` in stderr                      | `box.write` overrides the fixture. RED: today it exits 0.                                                                                                                                                                                     |
| Integration (sandbox) | Existing single-line, pipe-escape, drift and empty-catalog tests stay green                                                           | Unchanged assertions after the sandbox update                                                                                                                                                                                                 |
| Config                | `website.yml` paths include both new entries; `engines.node === '>=22.18'`; `.nvmrc` >= 22.18                                         | `release-config.test.ts`. RED before the edits.                                                                                                                                                                                               |
| Repo                  | Bundled catalog output is byte-identical                                                                                              | `pnpm run docs:catalog:check` and `pnpm run docs:website-catalog:check` with no diff, plus the existing `release-config` `--check` test                                                                                                       |
| Gates                 | typecheck, lint, format:check, build, architecture test                                                                               | Full gate run at the end of the change                                                                                                                                                                                                        |

## Threat Matrix

| Boundary                 | Applicability | Reason                                                                                                |
| ------------------------ | ------------- | ----------------------------------------------------------------------------------------------------- |
| Documentation-like paths | N/A           | No change to file classification or execution. The generators read Markdown frontmatter as data only. |
| Git repository selection | N/A           | No git automation                                                                                     |
| Commit state             | N/A           | No git automation                                                                                     |
| Push state               | N/A           | No git automation                                                                                     |
| PR commands              | N/A           | No PR automation                                                                                      |

The only new subprocess is a test-only `spawnSync(process.execPath, ...)` with fixed arguments and no shell, the same pattern as the existing generator tests. No production routing, shell or process boundary changes.

## Migration / Rollout

No data migration. Generated README and website pages stay byte-identical. The published `engines.node` change takes effect on the next release. Users on Node 22.13 to 22.17 get an engines warning, or a hard error under `engine-strict`. The PR body calls this out.

Work units (each commit green; RED is observed locally before each GREEN and recorded in tasks):

1. **Spike** (no commit): on `.nvmrc` Node 22.23.3, `node -e "import('./src/domain/catalog/frontmatter.ts').then(...)"` and a scratch `.mjs` import. Record stderr (warning or not). If it fails, stop and report.
2. `test(scripts): guard frontmatter reader portability`: `frontmatter-portability.test.ts`.
3. `refactor(scripts): read descriptions through domain frontmatter reader`: helper, both generators, sandbox update, block-scalar and strict-failure fixtures, plus `docs:*:check` run with no diff.
4. `ci(website): watch frontmatter reader and scripts lib`: `website.yml` plus the `release-config` assertion.
5. `fix(engines): require Node >=22.18 and fix invalid engines range`: `package.json`, the docs/config edit list, plus the `release-config` engines assertion.

The forecast is about 250 to 320 authored changed lines, within the 400-line budget, as a single PR.

## Open Questions

- [ ] Commit type for the Node floor: the design recommends `fix(engines)` (patch release, visible in notes). If the user wants the floor raise treated as breaking, `fix(engines)!` would publish 1.0.0. This does not block tasks. The apply phase uses `fix(engines)` unless told otherwise.
