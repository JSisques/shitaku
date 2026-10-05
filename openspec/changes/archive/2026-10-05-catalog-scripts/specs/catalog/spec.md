# Delta for Catalog

## ADDED Requirements

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

## MODIFIED Requirements

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
