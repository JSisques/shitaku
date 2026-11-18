# Delta for Catalog

## ADDED Requirements

### Requirement: Catalog layout and schema

The catalog MUST be a folder with `catalog.json` (`{ "version": 1, "items": { "mcps": [...], "skills": [...], "profiles": [...], "scripts": [...], "commands": [...], "hooks": [...], "agents": [...], "rules": [...] } }`, listing item names; `skills`, `scripts`, `commands`, `hooks`, `agents`, and `rules` are optional and default to empty), `mcps/<name>.json`, `skills/<name>/SKILL.md` (plus optional resources, including binary files), `scripts/<name>/index.mjs` plus validated metadata, `commands/<name>.md`, `hooks/<name>.json`, `agents/<name>.md`, `rules/<name>.md`, and `profiles/<name>.json`. `instructions/` is reserved and MUST be ignored.
(Previously: no rules kind in items or layout)

#### Scenario: Layout with rules

- GIVEN a catalog with `rules/no-secrets.md` listed in `items.rules`
- WHEN loaded
- THEN the layout is accepted and other kinds are unaffected

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

### Requirement: Agent catalog entries

The catalog MUST support `agents/<name>.md` listed in `items.agents` (optional, default empty). The loader MUST validate each agent on load. An agent is invalid when: a listed name has no file, an `agents/*.md` file is not listed, frontmatter is missing or unparseable, `name` or `description` is missing, empty, or whitespace-only after decoding, `name` or `description` is a nested value (mapping or list) that cannot be read as a scalar, the decoded and trimmed `name` differs from the file stem, the body is empty, or the name does not match `^[a-z0-9][a-z0-9-]*$`. `name` and `description` MAY be written as YAML block scalars (see "Opt-in nested frontmatter reader"). The parsed `name` and `description` MUST be trimmed, and the parsed `description` MUST have all internal whitespace runs (including newlines) collapsed to a single space, so every consumer receives a single-line value. Invalid agents MUST be reported with path and reason and MUST NOT be installable; valid items remain usable. Source guards (traversal, symlink, size limit) MUST apply. Agents MUST NOT be validated against an allowed-field list: unknown frontmatter keys MUST pass through and bytes MUST stay verbatim, including for block-scalar agents. Agent subdirectories are not scanned. The bundled catalog MUST ship `"agents": []` and `catalog/agents/.gitkeep`, and is not required to ship an agent.
(Previously: a block-scalar `name` or `description` was opaque and rejected with `key 'X' must be a single-line value`; the parsed description was not normalized)

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

#### Scenario: Folded description

- GIVEN `agents/reviewer.md` has `description: >` followed by two indented lines of text
- WHEN loaded
- THEN agent `reviewer` is available and its description is one trimmed line with the two lines joined by a single space

#### Scenario: Literal description collapsed to one line

- GIVEN `agents/reviewer.md` has `description: |` followed by indented lines, a blank line, and more indented lines
- WHEN loaded
- THEN the parsed description is a single line with no newlines and no repeated spaces, trimmed at both ends

#### Scenario: Block-scalar name matches stem

- GIVEN `agents/reviewer.md` has `name: >-` followed by the indented line `reviewer`
- WHEN loaded
- THEN the decoded name `reviewer` equals the stem and the agent is available

#### Scenario: Block-scalar name differs from stem

- GIVEN `agents/a.md` has `name: |` followed by the indented line `b`
- WHEN loaded
- THEN the agent is rejected naming the path and the name mismatch, and `a` is not selectable

#### Scenario: Empty or whitespace-only block

- GIVEN `description: |` or `name: >` followed by no content lines, or only blank or whitespace-only lines
- WHEN loaded
- THEN the agent is rejected with the existing `X: frontmatter key is required` error naming the file and the field

#### Scenario: Nested value under name or description

- GIVEN `description:` followed by an indented mapping or list instead of a scalar or block scalar (same for `name`)
- WHEN loaded
- THEN the agent is rejected with the error `key 'X' must be a single-line or block scalar (| or >) value` (reworded from the former `key 'X' must be a single-line value`), and the other items remain usable

#### Scenario: Block-scalar agent bytes verbatim

- GIVEN an agent whose `name` and `description` are block scalars
- WHEN loaded
- THEN its bytes equal the file on disk, including the block-scalar syntax

### Requirement: Opt-in nested frontmatter reader

The frontmatter reader MUST offer an opt-in `allowNested` mode, used only for agents and rules. In that mode, top-level scalar keys MUST be extracted, and top-level keys whose value is a YAML block scalar MUST be decoded into their string value in `data`. The supported block-scalar subset is: a header of `|` (literal) or `>` (folded), optionally followed by a chomping indicator (`-` strip, `+` keep; absent means clip) and an indentation indicator (`1`-`9`) in either order, optionally followed by a trailing `# comment`. Content indentation MUST be the indicator when present, otherwise the indentation of the first non-blank content line. The scalar MUST end at the first non-blank line indented less than the content indentation, or at the next top-level key. Literal (`|`) MUST keep line breaks; folded (`>`) MUST join consecutive lines with a single space and keep blank lines as paragraph breaks. Blank lines inside the block MUST be preserved, CRLF line endings MUST be handled, and a header with no content lines MUST decode to an empty string. A non-blank block-scalar line whose indentation starts with a tab MUST be rejected with the error `frontmatter key 'X' has a block scalar indented with a tab`. Other indented lines and list items belonging to a key whose value is empty or a nested mapping or list MUST be accepted and kept opaque (not parsed or validated); only such keys appear in the `opaque` result. Default (strict) mode MUST be unchanged: skills and commands MUST keep rejecting multi-line, block-scalar, or nested values exactly as before, including the handling of blank lines inside frontmatter. The reader MUST remain pure (no `fs`, `os`, `path`, `child_process`, or `process`). Malformed nested YAML is not detected, and full YAML semantics (flow or quoted multi-line scalars, anchors, tags, block scalars inside nested values) are not supported; these limits MUST be documented.
(Previously: block scalars were accepted and treated as opaque, in nested mode; used only for agents)

#### Scenario: Strict mode unchanged for commands and skills

- GIVEN a command or skill whose frontmatter has a multi-line list
- WHEN parsed
- THEN it is rejected exactly as before this change

#### Scenario: Strict mode unchanged for block scalars and blank lines

- GIVEN a command or skill whose frontmatter has a block-scalar value, or a blank line between keys
- WHEN parsed in default mode
- THEN the result (accepted or rejected, and the error message) is identical to before this change

#### Scenario: Nested mode for agents

- GIVEN an agent whose frontmatter has `tools:` followed by indented list items and a `hooks:` nested block
- WHEN parsed with `allowNested`
- THEN top-level `name` and `description` are returned and parsing succeeds, and `tools` and `hooks` are reported as opaque

#### Scenario: Nested mode for rules

- GIVEN a rule whose frontmatter has `paths:` followed by indented list items
- WHEN parsed with `allowNested`
- THEN top-level `name` and `description` are returned and parsing succeeds, and `paths` is reported as opaque

#### Scenario: Missing frontmatter still rejected

- GIVEN a rule or agent file with no frontmatter block, or an unterminated one
- WHEN parsed with `allowNested`
- THEN it is rejected

#### Scenario: Literal block scalar decoded

- GIVEN `description: |` followed by lines `a` and `b` indented by two spaces
- WHEN parsed with `allowNested`
- THEN `description` is `a\nb\n` in `data` and is not reported as opaque

#### Scenario: Folded block scalar decoded

- GIVEN `description: >` followed by indented lines `a` and `b`, a blank line, and an indented line `c`
- WHEN parsed with `allowNested`
- THEN `description` is `a b\nc\n` in `data`

#### Scenario: Chomping indicators

- GIVEN the same block with header `|-`, `|`, or `|+` and two trailing blank lines before the next key
- WHEN parsed with `allowNested`
- THEN the value has no trailing newline for `-`, exactly one for clip, and keeps the final newline plus the trailing blank lines for `+`

#### Scenario: Indentation indicator

- GIVEN `description: |2` followed by a first content line indented by four spaces
- WHEN parsed with `allowNested`
- THEN the content indent is two spaces and the extra two spaces are kept at the start of that line

#### Scenario: Trailing comment on header

- GIVEN `description: > # explanation` followed by indented content
- WHEN parsed with `allowNested`
- THEN the comment is ignored and the content is decoded

#### Scenario: Block ends at dedent or next key

- GIVEN a block scalar followed by a top-level key `model: sonnet`
- WHEN parsed with `allowNested`
- THEN the block value excludes that key and `model` is returned as its own scalar

#### Scenario: Blank lines and CRLF

- GIVEN a block scalar with blank lines inside and CRLF line endings
- WHEN parsed with `allowNested`
- THEN blank lines are preserved per the literal or folded rules and no carriage returns appear in the value

#### Scenario: Empty block header

- GIVEN `description: |` immediately followed by another top-level key
- WHEN parsed with `allowNested`
- THEN `description` is an empty string in `data`

#### Scenario: Tab-indented block line

- GIVEN `description: |` followed by a non-blank line whose indentation starts with a tab
- WHEN parsed with `allowNested`
- THEN parsing is rejected with `frontmatter key 'description' has a block scalar indented with a tab`

#### Scenario: Limit documented

- GIVEN CONTRIBUTING, README, and `website/src/content/docs/{en,es}/security.md`
- WHEN inspected
- THEN each states that agent `name` and `description` may be block scalars, and that other nested agent and rule YAML is passed through without syntax validation
- AND none states that agent `name` or `description` must be single-line, or links the single-line limit to issue #238

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
