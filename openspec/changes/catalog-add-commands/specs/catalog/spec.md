# Delta for Catalog

## ADDED Requirements

### Requirement: Command catalog entries

The catalog MUST support `commands/<name>.md` listed in `items.commands` (optional, default empty). A command is invalid when: the name violates `^[a-z0-9][a-z0-9-]*$`, a listed name has no file, a `commands/*.md` file is not listed, frontmatter is missing/unparseable/multi-line, or `description` is missing or empty. Invalid commands MUST be reported with path and reason and MUST NOT be installable. Source guards (traversal, symlink, size limit) MUST apply. The bundled catalog is not required to ship a command.

#### Scenario: Valid command

- GIVEN `commands/review.md` with a `description` and `items.commands` lists `review`
- WHEN loaded
- THEN command `review` is available

#### Scenario: Invalid or guarded

- GIVEN missing description, unlisted file, ghost entry, or a symlinked file
- WHEN loaded
- THEN an error names the path and reason, the command is not selectable, and valid items remain usable

#### Scenario: Invalid name in the index

- GIVEN `items.commands` lists a name that violates the name pattern (for example `Review` or `../evil`)
- WHEN loaded
- THEN the whole catalog fails to load with an error naming the entry, as for skills and scripts

#### Scenario: Old catalog without commands

- GIVEN `catalog.json` has no `items.commands`
- WHEN loaded
- THEN it loads with zero commands and no error

## MODIFIED Requirements

### Requirement: Catalog layout and schema

The catalog MUST be a folder with `catalog.json` (`{ "version": 1, "items": { "mcps": [...], "skills": [...], "profiles": [...], "scripts": [...], "commands": [...] } }`, listing item names; `skills`, `scripts`, and `commands` are optional and default to empty), `mcps/<name>.json`, `skills/<name>/SKILL.md` (plus optional resources, including binary files), `scripts/<name>/index.mjs` plus validated metadata, `commands/<name>.md`, and `profiles/<name>.json`. Each MCP item MUST have `name`, `description`, `server`, and optional `env` and `targets`. Env entries MUST carry `name` and `required`. Each skill's `SKILL.md` MUST have YAML frontmatter with non-empty `name` (equal to its directory name and listed in `items.skills`) and non-empty `description`. `instructions/` and `hooks/` are reserved and MUST be ignored.
(Previously: no commands kind in items or layout)

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

Profiles MAY `extends` other profiles and MAY list `skills`, `scripts`, and `commands` (each default empty). Resolution MUST merge parents first, de-duplicate MCP, skill, script, and command names, and fail on cycles or unknown references (MCP, skill, script, or command). Existing profiles without `commands` MUST remain valid. Applying profiles in `init` is out of scope; resolution only.
(Previously: profiles could not reference commands)

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

#### Scenario: Cycle

- GIVEN `a` extends `b` and `b` extends `a`
- WHEN resolved
- THEN resolution fails naming the cycle `a -> b -> a`

#### Scenario: Unknown reference

- GIVEN a profile lists MCP, skill, script, or command `ghost` that does not exist
- WHEN resolved
- THEN it fails naming `ghost`

#### Scenario: Profile without commands field

- GIVEN a profile JSON without `commands`
- WHEN loaded
- THEN it is valid with an empty command list
