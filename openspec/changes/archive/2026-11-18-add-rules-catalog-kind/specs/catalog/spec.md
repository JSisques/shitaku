# Delta for Catalog

## ADDED Requirements

### Requirement: Rule catalog entries

The catalog MUST support `rules/<name>.md` listed in `items.rules` (optional, default empty). The loader MUST validate each rule on load. A rule is invalid when: a listed name has no file, a `rules/*.md` file is not listed, frontmatter is missing or unparseable, `name` or `description` is missing or empty or whitespace, `name` differs from the file stem, the body is empty, or the name does not match `^[a-z0-9][a-z0-9-]*$`. Invalid rules MUST be reported with path and reason and MUST NOT be installable; valid items remain usable. Source guards (traversal, symlink, size limit) MUST apply. Rules MUST NOT be validated against an allowed-field list: unknown frontmatter keys, and nested frontmatter such as a `paths:` list, MUST pass through and bytes MUST stay verbatim. Rule subdirectories are not scanned. The bundled catalog MUST ship the ten seed rules defined in `rules-install`.

#### Scenario: Valid rule loads

- GIVEN `rules/no-secrets.md` has frontmatter `name: no-secrets` and a `description`, a non-empty body, and `items.rules` lists `no-secrets`
- WHEN loaded
- THEN rule `no-secrets` is available with its bytes unchanged

#### Scenario: Name differs from file stem

- GIVEN `rules/a.md` has frontmatter `name: b`
- WHEN loaded
- THEN an error names the path and reason, and `a` is not selectable

#### Scenario: Required fields

- GIVEN frontmatter lacks `name`, or lacks `description`, or either is whitespace only
- WHEN loaded
- THEN the rule is rejected naming the file and the field

#### Scenario: Empty body

- GIVEN valid frontmatter followed by no body or only whitespace
- WHEN loaded
- THEN the rule is rejected naming the file

#### Scenario: Name regex

- GIVEN a name `Naming`, `-x`, or `a_b`
- WHEN loaded
- THEN it is rejected naming the name; a name with digits such as `rule2` is accepted

#### Scenario: Nested frontmatter and unknown keys pass through

- GIVEN frontmatter with `name`, `description`, a multi-line `paths:` list, and unknown key `futurefield: 1`
- WHEN loaded
- THEN the rule is valid, top-level `name` and `description` are extracted, and the bytes equal the file on disk

#### Scenario: Unlisted, ghost, or guarded

- GIVEN an unlisted `rules/x.md`, a listed `ghost` with no file, or a symlinked rule file
- WHEN loaded
- THEN an error names the path and reason, the rule is not selectable, and valid items remain usable

#### Scenario: Invalid name in the index

- GIVEN `items.rules` lists `../evil`
- WHEN loaded
- THEN the whole catalog fails to load with an error naming the entry

#### Scenario: Old catalog without rules

- GIVEN `catalog.json` has no `items.rules`
- WHEN loaded
- THEN it loads with zero rules and no error

#### Scenario: Profiles unaffected

- GIVEN a profile JSON and the profile schema
- WHEN loaded and resolved after this change
- THEN `ProfileSchema` and profile resolution accept and behave exactly as before and no rule field exists

## MODIFIED Requirements

### Requirement: Catalog layout and schema

The catalog MUST be a folder with `catalog.json` (`{ "version": 1, "items": { "mcps": [...], "skills": [...], "profiles": [...], "scripts": [...], "commands": [...], "hooks": [...], "agents": [...], "rules": [...] } }`, listing item names; `skills`, `scripts`, `commands`, `hooks`, `agents`, and `rules` are optional and default to empty), `mcps/<name>.json`, `skills/<name>/SKILL.md` (plus optional resources, including binary files), `scripts/<name>/index.mjs` plus validated metadata, `commands/<name>.md`, `hooks/<name>.json`, `agents/<name>.md`, `rules/<name>.md`, and `profiles/<name>.json`. `instructions/` is reserved and MUST be ignored.
(Previously: no rules kind in items or layout)

#### Scenario: Layout with rules

- GIVEN a catalog with `rules/no-secrets.md` listed in `items.rules`
- WHEN loaded
- THEN the layout is accepted and other kinds are unaffected

### Requirement: Opt-in nested frontmatter reader

The frontmatter reader MUST offer an opt-in `allowNested` mode, used only for agents and rules. In that mode, top-level scalar keys MUST be extracted; indented lines, block scalars, and list items belonging to a key MUST be accepted and treated as opaque (not parsed or validated). Default (strict) mode MUST be unchanged: skills and commands MUST keep rejecting multi-line or nested values exactly as before. The reader MUST remain pure (no `fs`, `os`, `path`, `child_process`, or `process`). Malformed nested YAML is not detected; this limit MUST be documented.
(Previously: used only for agents)

#### Scenario: Strict mode unchanged for commands and skills

- GIVEN a command or skill whose frontmatter has a multi-line list
- WHEN parsed
- THEN it is rejected exactly as before this change

#### Scenario: Nested mode for rules

- GIVEN a rule whose frontmatter has `paths:` followed by indented list items
- WHEN parsed with `allowNested`
- THEN top-level `name` and `description` are returned and parsing succeeds

#### Scenario: Missing frontmatter still rejected

- GIVEN a rule or agent file with no frontmatter block, or an unterminated one
- WHEN parsed with `allowNested`
- THEN it is rejected

#### Scenario: Limit documented

- GIVEN CONTRIBUTING or README
- WHEN inspected
- THEN it states that nested agent and rule YAML is passed through without syntax validation
