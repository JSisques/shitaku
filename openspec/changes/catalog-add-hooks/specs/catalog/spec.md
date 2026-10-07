# Delta for Catalog

## ADDED Requirements

### Requirement: Hook catalog entries

The catalog MUST support `hooks/<name>.json` listed in `items.hooks` (optional, default empty). The loader MUST validate each hook with the hook schema on load. A hook is invalid when a listed name has no file, a `hooks/*` file is not listed, the schema fails, or a literal secret is present. Invalid hooks MUST be reported with path and reason and MUST NOT be installable; valid items remain usable. Source guards (traversal, symlink, size limit) MUST apply. The bundled catalog is not required to ship a hook.

#### Scenario: Valid hook loads

- GIVEN `hooks/fmt.json` is valid and `items.hooks` lists `fmt`
- WHEN loaded
- THEN hook `fmt` is available

#### Scenario: Invalid or guarded

- GIVEN a schema failure, unlisted file, ghost entry, or symlinked file
- WHEN loaded
- THEN an error names the path and reason, the hook is not selectable, and valid items remain usable

#### Scenario: Invalid name in the index

- GIVEN `items.hooks` lists `../evil`
- WHEN loaded
- THEN the whole catalog fails to load with an error naming the entry

#### Scenario: Old catalog without hooks

- GIVEN `catalog.json` has no `items.hooks`
- WHEN loaded
- THEN it loads with zero hooks and no error

## MODIFIED Requirements

### Requirement: Catalog layout and schema

The catalog MUST be a folder with `catalog.json` (`{ "version": 1, "items": { "mcps": [...], "skills": [...], "profiles": [...], "scripts": [...], "commands": [...], "hooks": [...] } }`, listing item names; `skills`, `scripts`, `commands`, and `hooks` are optional and default to empty), `mcps/<name>.json`, `skills/<name>/SKILL.md` (plus optional resources, including binary files), `scripts/<name>/index.mjs` plus validated metadata, `commands/<name>.md`, `hooks/<name>.json`, and `profiles/<name>.json`. Each MCP item MUST have `name`, `description`, `server`, and optional `env` and `targets`. Env entries MUST carry `name` and `required`. Each skill's `SKILL.md` MUST have YAML frontmatter with non-empty `name` (equal to its directory name and listed in `items.skills`) and non-empty `description`. `instructions/` is reserved and MUST be ignored.
(Previously: `hooks/` was reserved and ignored; no hooks kind in items or layout)

#### Scenario: Valid MCP item

- GIVEN `mcps/github.json` matches the schema
- WHEN the catalog is loaded
- THEN the item is available by name `github`

#### Scenario: Valid skill

- GIVEN `skills/demo/SKILL.md` has frontmatter `name: demo` and a `description`, and `items.skills` lists `demo`
- WHEN loaded
- THEN skill `demo` is available with all its files

#### Scenario: Reserved folders

- GIVEN the catalog contains `instructions/`
- WHEN loaded
- THEN no error occurs and no items are exposed from it

### Requirement: Profile extends

Profiles MAY `extends` other profiles and MAY list `skills`, `scripts`, `commands`, and `hooks` (each default empty). Resolution MUST merge parents first, de-duplicate MCP, skill, script, command, and hook names, and fail on cycles or unknown references (MCP, skill, script, command, or hook). Existing profiles without `hooks` MUST remain valid. Applying profiles in `init` is out of scope; resolution only.
(Previously: profiles could not reference hooks)

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

#### Scenario: Commands resolved

- GIVEN `base` lists command `review` and `web` extends `base` and lists `review`
- WHEN `web` is resolved
- THEN `review` appears once

#### Scenario: Hooks resolved

- GIVEN `base` lists hook `fmt` and `web` extends `base` and lists `fmt`
- WHEN `web` is resolved
- THEN `fmt` appears once

#### Scenario: Cycle

- GIVEN `a` extends `b` and `b` extends `a`
- WHEN resolved
- THEN resolution fails naming the cycle `a -> b -> a`

#### Scenario: Unknown reference

- GIVEN a profile lists MCP, skill, script, command, or hook `ghost` that does not exist
- WHEN resolved
- THEN it fails naming `ghost`

#### Scenario: Profile without hooks field

- GIVEN a profile JSON without `hooks`
- WHEN loaded
- THEN it is valid with an empty hook list
