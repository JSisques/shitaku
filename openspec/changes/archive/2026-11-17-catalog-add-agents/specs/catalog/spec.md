# Delta for Catalog

## ADDED Requirements

### Requirement: Agent catalog entries

The catalog MUST support `agents/<name>.md` listed in `items.agents` (optional, default empty). The loader MUST validate each agent on load. An agent is invalid when: a listed name has no file, an `agents/*.md` file is not listed, frontmatter is missing or unparseable, `name` or `description` is missing or empty or whitespace, `name` differs from the file stem, the body is empty, or the name does not match `^[a-z0-9][a-z0-9-]*$`. Invalid agents MUST be reported with path and reason and MUST NOT be installable; valid items remain usable. Source guards (traversal, symlink, size limit) MUST apply. Agents MUST NOT be validated against an allowed-field list: unknown frontmatter keys MUST pass through and bytes MUST stay verbatim. Agent subdirectories are not scanned. The bundled catalog MUST ship `"agents": []` and `catalog/agents/.gitkeep`, and is not required to ship an agent.

#### Scenario: Valid agent loads

- GIVEN `agents/reviewer.md` has frontmatter `name: reviewer` and a `description`, a non-empty body, and `items.agents` lists `reviewer`
- WHEN loaded
- THEN agent `reviewer` is available with its bytes unchanged

#### Scenario: Name differs from file stem

- GIVEN `agents/a.md` has frontmatter `name: b`
- WHEN loaded
- THEN an error names the path and reason, and `a` is not selectable

#### Scenario: Required fields

- GIVEN frontmatter lacks `name`, or lacks `description`, or either is whitespace only
- WHEN loaded
- THEN the agent is rejected naming the file and the field

#### Scenario: Empty body

- GIVEN valid frontmatter followed by no body or only whitespace
- WHEN loaded
- THEN the agent is rejected naming the file

#### Scenario: Name regex

- GIVEN a name `Reviewer`, `-x`, or `a_b`
- WHEN loaded
- THEN it is rejected naming the name; a name with digits such as `reviewer2` is accepted

#### Scenario: No allowed-field list

- GIVEN frontmatter with `name`, `description`, and unknown key `futurefield: 1`
- WHEN loaded
- THEN the agent is valid and the key remains in the installed bytes

#### Scenario: Nested YAML preserved verbatim

- GIVEN frontmatter with a multi-line `tools` list, `skills`, `mcpServers`, `hooks`, and `experimental` nested blocks
- WHEN loaded
- THEN the agent is valid, top-level `name` and `description` are extracted, and the bytes equal the file on disk

#### Scenario: Unlisted, ghost, or guarded

- GIVEN an unlisted `agents/x.md`, a listed `ghost` with no file, or a symlinked agent file
- WHEN loaded
- THEN an error names the path and reason, the agent is not selectable, and valid items remain usable

#### Scenario: Invalid name in the index

- GIVEN `items.agents` lists `../evil`
- WHEN loaded
- THEN the whole catalog fails to load with an error naming the entry

#### Scenario: Old catalog without agents

- GIVEN `catalog.json` has no `items.agents`
- WHEN loaded
- THEN it loads with zero agents and no error

### Requirement: Opt-in nested frontmatter reader

The frontmatter reader MUST offer an opt-in `allowNested` mode, used only for agents. In that mode, top-level scalar keys MUST be extracted; indented lines, block scalars, and list items belonging to a key MUST be accepted and treated as opaque (not parsed or validated). Default (strict) mode MUST be unchanged: skills and commands MUST keep rejecting multi-line or nested values exactly as before. The reader MUST remain pure (no `fs`, `os`, `path`, `child_process`, or `process`). Malformed nested YAML is not detected; this limit MUST be documented.

#### Scenario: Strict mode unchanged for commands and skills

- GIVEN a command or skill whose frontmatter has a multi-line list
- WHEN parsed
- THEN it is rejected exactly as before this change

#### Scenario: Nested mode for agents

- GIVEN an agent whose frontmatter has `tools:` followed by indented list items and a `hooks:` nested block
- WHEN parsed with `allowNested`
- THEN top-level `name` and `description` are returned and parsing succeeds

#### Scenario: Missing frontmatter still rejected

- GIVEN an agent file with no frontmatter block, or an unterminated one
- WHEN parsed with `allowNested`
- THEN it is rejected

#### Scenario: Limit documented

- GIVEN CONTRIBUTING or README
- WHEN inspected
- THEN it states that nested agent YAML is passed through without syntax validation

### Requirement: Trust copy for custom sources

The `--source` trust copy (help text and documentation) MUST state that catalogs can include agents, and that agents can grant tools or permissions through their frontmatter. Installing agents MUST NOT require an additional consent gate.

#### Scenario: Copy mentions agents

- GIVEN the `--source` option help and the security documentation
- WHEN inspected
- THEN they mention agents and tool or permission grants

#### Scenario: No consent gate

- GIVEN an agent in a `--source` catalog and `--yes`
- WHEN init runs
- THEN the agent installs without an extra confirmation prompt

## MODIFIED Requirements

### Requirement: Catalog layout and schema

The catalog MUST be a folder with `catalog.json` (`{ "version": 1, "items": { "mcps": [...], "skills": [...], "profiles": [...], "scripts": [...], "commands": [...], "hooks": [...], "agents": [...] } }`, listing item names; `skills`, `scripts`, `commands`, `hooks`, and `agents` are optional and default to empty), `mcps/<name>.json`, `skills/<name>/SKILL.md` (plus optional resources, including binary files), `scripts/<name>/index.mjs` plus validated metadata, `commands/<name>.md`, `hooks/<name>.json`, `agents/<name>.md`, and `profiles/<name>.json`. `instructions/` is reserved and MUST be ignored.
(Previously: no agents kind in items or layout)

#### Scenario: Layout with agents

- GIVEN a catalog with `agents/reviewer.md` listed in `items.agents`
- WHEN loaded
- THEN the layout is accepted and other kinds are unaffected

### Requirement: Profile extends

Profiles MAY `extends` other profiles and MAY list `skills`, `scripts`, `commands`, `hooks`, and `agents` (each default empty). Resolution MUST merge parents first, de-duplicate names of every kind, and fail on cycles or unknown references (including agents). Existing profiles without `agents` MUST remain valid. The `agents` array is schema and validation only: installing profiles by name is out of scope.
(Previously: profiles could not reference agents)

#### Scenario: Agents resolved

- GIVEN `base` lists agent `reviewer` and `web` extends `base` and lists `reviewer`
- WHEN `web` is resolved
- THEN `reviewer` appears once

#### Scenario: Unknown agent reference

- GIVEN a profile lists agent `ghost` that does not exist
- WHEN resolved or validated at load
- THEN it fails naming `ghost`

#### Scenario: Profile without agents field

- GIVEN a profile JSON without `agents`
- WHEN loaded
- THEN it is valid with an empty agent list
