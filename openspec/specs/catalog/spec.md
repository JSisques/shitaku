# Delta for Catalog

## ADDED Requirements

### Requirement: Catalog layout and schema

The catalog MUST be a folder with `catalog.json` (`{ "version": 1, "items": { "mcps": [...], "skills": [...], "profiles": [...], "scripts": [...] } }`, listing item names; `skills` and `scripts` are optional and default to empty), `mcps/<name>.json`, `skills/<name>/SKILL.md` (plus optional resources, including binary files), `scripts/<name>/index.mjs` plus validated metadata, and `profiles/<name>.json`. Each MCP item MUST have `name`, `description`, `server`, and optional `env` and `targets`. Env entries MUST carry `name` and `required`. Each skill's `SKILL.md` MUST have YAML frontmatter with non-empty `name` (equal to its directory name and listed in `items.skills`) and non-empty `description`. `instructions/` and `hooks/` are reserved and MUST be ignored.
(Previously: no scripts kind in items or layout)

#### Scenario: Valid MCP item

- GIVEN `mcps/github.json` matches the schema
- WHEN the catalog is loaded
- THEN the item is available by name `github`

#### Scenario: Valid skill

- GIVEN `skills/demo/SKILL.md` has frontmatter `name: demo` and a `description`, and `items.skills` lists `demo`
- WHEN loaded
- THEN skill `demo` is available with all its files

#### Scenario: Reserved folders

- GIVEN the catalog contains `hooks/`
- WHEN loaded
- THEN no error occurs and no items are exposed from it

### Requirement: Catalog sources

The system MUST load the bundled catalog by default and MUST load a local folder when `--source <folder>` is given. Remote sources MUST NOT be supported.

#### Scenario: Custom folder

- GIVEN `--source ./my-catalog`
- WHEN `init` runs
- THEN only items from `./my-catalog` are offered

#### Scenario: Missing source

- GIVEN `--source ./nope` does not exist
- WHEN `init` runs
- THEN it exits non-zero with a clear error and writes nothing

### Requirement: Item validation

The loader MUST validate every item with the schema. An invalid item MUST be reported with file path and reason, and MUST NOT be installable. Valid items SHOULD remain usable. Skills are invalid when: frontmatter is missing or unparseable, `name` or `description` is missing or empty, `name` differs from the directory name, a listed name has no directory or `SKILL.md`, or a skill directory is not listed in `items.skills`.

#### Scenario: Invalid item

- GIVEN `mcps/bad.json` lacks `server`
- WHEN loaded
- THEN an error names `mcps/bad.json` and `server`, and `bad` is not selectable

#### Scenario: Literal secret in item

- GIVEN an item header holds a literal token instead of `${VAR}`
- WHEN validated
- THEN the item is rejected as containing a secret literal

#### Scenario: Missing description

- GIVEN `skills/demo/SKILL.md` frontmatter lacks `description`
- WHEN loaded
- THEN an error names `skills/demo/SKILL.md` and `description`, and `demo` is not selectable

#### Scenario: Name mismatch or unlisted

- GIVEN frontmatter `name: other` in `skills/demo/`, or `items.skills` lists `ghost` with no directory
- WHEN loaded
- THEN an error names the offending path and reason, and valid skills remain usable

### Requirement: Profile extends

Profiles MAY `extends` other profiles and MAY list `skills` and `scripts` (each default empty). Resolution MUST merge parents first, de-duplicate MCP names, skill names, and script names, and fail on cycles or unknown references (MCP, skill, or script). Applying profiles in `init` is out of scope; resolution only.
(Previously: profiles could not reference scripts)

#### Scenario: Extends resolved

- GIVEN `web` extends `base`, and `base` lists `context7`
- WHEN `web` is resolved
- THEN its MCPs include `context7` and `github` once each

#### Scenario: Skills resolved

- GIVEN `base` lists skill `demo` and `web` extends `base` and lists `demo`
- WHEN `web` is resolved
- THEN `demo` appears once

#### Scenario: Scripts resolved

- GIVEN `base` lists script `lint` and `web` extends `base` and lists `lint`
- WHEN `web` is resolved
- THEN `lint` appears once

#### Scenario: Cycle

- GIVEN `a` extends `b` and `b` extends `a`
- WHEN resolved
- THEN resolution fails naming the cycle `a -> b -> a`

#### Scenario: Unknown reference

- GIVEN a profile lists MCP, skill, or script `ghost` that does not exist
- WHEN resolved
- THEN it fails naming `ghost`

### Requirement: Source guards and limits

When loading a catalog from `--source`, the loader MUST reject: any path resolving outside the catalog root (traversal), any symlink inside a skill directory, any file above the per-file size limit, and any skill above the file-count limit or total-size limit. The error MUST name the path and reason and write nothing.

#### Scenario: Traversal

- GIVEN `items.skills` lists `../evil`
- WHEN loaded
- THEN it fails naming `../evil` and nothing is read outside the root

#### Scenario: Symlink

- GIVEN `skills/demo/link` is a symlink
- WHEN loaded
- THEN `demo` is rejected naming `skills/demo/link`

#### Scenario: Over limit

- GIVEN a skill file exceeds the size limit or the skill exceeds the file-count limit
- WHEN loaded
- THEN `demo` is rejected naming the limit exceeded

### Requirement: Bundled example skill

The bundled catalog MUST include one minimal valid example skill listed in `items.skills`.

#### Scenario: Bundled load

- GIVEN the default catalog
- WHEN loaded
- THEN at least one skill is available and valid

### Requirement: Script catalog entries

Catalog MUST support `scripts/<name>/` with `index.mjs` + validated metadata (`name`, `description`, args/usage, required tools, output format). `items.scripts` optional default empty. Invalid scripts MUST be reported (path+reason) and not installable. Source guards (traversal, symlink, size/count) MUST apply to script trees.

#### Scenario: Valid script

- GIVEN `scripts/demo/index.mjs` plus valid metadata and `items.scripts` lists `demo`
- WHEN loaded
- THEN script `demo` is available

#### Scenario: Invalid or guarded

- GIVEN missing fields, name mismatch, traversal, symlink, or over-limit script tree
- WHEN loaded
- THEN rejected naming path and reason; not selectable
