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

The catalog MUST support `agents/<name>.md` listed in `items.agents` (optional, default empty). The loader MUST validate each agent on load. An agent is invalid when: a listed name has no file, an `agents/*.md` file is not listed, frontmatter is missing or unparseable, `name` or `description` is missing, empty, or whitespace-only after decoding, `name` or `description` is a nested value (mapping or list) that cannot be read as a scalar, the decoded and trimmed `name` differs from the file stem, the body is empty, the name does not match `^[a-z0-9][a-z0-9-]*$`, or its `skills` value is malformed (see "Opt-in nested frontmatter reader"). `name` and `description` MAY be written as YAML block scalars (see "Opt-in nested frontmatter reader"). The parsed `name` and `description` MUST be trimmed, and the parsed `description` MUST have all internal whitespace runs (including newlines) collapsed to a single space, so every consumer receives a single-line value. A valid agent MUST expose its declared skills as a parsed list of names, `skills`, in declaration order with duplicates removed (first occurrence kept); the list MUST be empty when the key is absent or empty. Parsed skill names MUST NOT be validated against the catalog at load time. Invalid agents MUST be reported with path and reason and MUST NOT be installable; valid items remain usable. Source guards (traversal, symlink, size limit) MUST apply. Agents MUST NOT be validated against an allowed-field list: unknown frontmatter keys MUST pass through and bytes MUST stay verbatim, including for block-scalar agents and for agents with a `skills` list in either form. Agent subdirectories are not scanned. The bundled catalog MUST ship `"agents": []` and `catalog/agents/.gitkeep`, and is not required to ship an agent.
(Previously: `skills` was an opaque nested key with no parsed value and no validation, so an agent exposed no skills list)

#### Scenario: Valid agent loads

- GIVEN `agents/reviewer.md` has frontmatter `name: reviewer` and a `description`, a non-empty body, and `items.agents` lists `reviewer`
- WHEN loaded
- THEN agent `reviewer` is available with its bytes unchanged
- AND its `skills` list is empty

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
- THEN the agent is valid, top-level `name` and `description` are extracted, the `skills` list is parsed, and the bytes equal the file on disk

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

#### Scenario: Skills as a block sequence

- GIVEN an agent with `skills:` followed by the items `- docs-writing` and `- pr-writing`
- WHEN loaded
- THEN the agent is valid and its `skills` list is `['docs-writing', 'pr-writing']`

#### Scenario: Skills as an inline flow sequence

- GIVEN an agent with `skills: [docs-writing, pr-writing]`
- WHEN loaded
- THEN the agent is valid and its `skills` list equals the one parsed from the block form

#### Scenario: Skills absent

- GIVEN an agent with no `skills` key
- WHEN loaded
- THEN its `skills` list is empty and the agent is valid

#### Scenario: Duplicate skill names collapse

- GIVEN an agent with `skills: [a, b, a]`
- WHEN loaded
- THEN its `skills` list is `['a', 'b']`

#### Scenario: Malformed skills rejects only that agent

- GIVEN `agents/bad.md` whose `skills` value is malformed and a valid `agents/good.md`
- WHEN loaded
- THEN an error names `agents/bad.md` and the key `skills`, `bad` is not selectable, and `good` remains usable

#### Scenario: Unknown skill names are not validated at load

- GIVEN an agent declaring `skills: [not-in-catalog]`
- WHEN loaded
- THEN the agent is valid and its `skills` list is `['not-in-catalog']`

### Requirement: Opt-in nested frontmatter reader

The frontmatter reader MUST offer an opt-in `allowNested` mode, used only for agents and rules. In that mode, top-level scalar keys MUST be extracted, and top-level keys whose value is a YAML block scalar MUST be decoded into their string value in `data`. The supported block-scalar subset is: a header of `|` (literal) or `>` (folded), optionally followed by a chomping indicator (`-` strip, `+` keep; absent means clip) and an indentation indicator (`1`-`9`) in either order, optionally followed by a trailing `# comment`. Content indentation MUST be the indicator when present, otherwise the indentation of the first non-blank content line. The scalar MUST end at the first non-blank line indented less than the content indentation, or at the next top-level key. Literal (`|`) MUST keep line breaks; folded (`>`) MUST join consecutive lines with a single space and keep blank lines as paragraph breaks. Blank lines inside the block MUST be preserved, CRLF line endings MUST be handled, and a header with no content lines MUST decode to an empty string. A non-blank block-scalar line whose indentation starts with a tab MUST be rejected with the error `frontmatter key 'X' has a block scalar indented with a tab`. Other indented lines and list items belonging to a key whose value is empty or a nested mapping or list MUST be accepted and kept opaque (not parsed or validated); only such keys appear in the `opaque` result. The reader MUST additionally accept an opt-in `mappings` option (a list of top-level key names, used with `allowNested`) and return a `maps` result. A listed key with an empty inline value MUST have its indented block parsed one nested level deep into `maps[key]` instead of being opaque; only `parseRule` requests `['check']`. The block reader MUST accept this strict subset of YAML: keys matching `^[a-z][a-z0-9-]*$` at one consistent space indent greater than zero; plain scalars (rejected when starting with a YAML indicator or containing `: ` or an inner ` #`; a trailing ` # comment` is stripped); single-quoted scalars (`''` decodes to `'`); double-quoted scalars with only the escapes `\\ \" \/ \n \t`; and block sequences (`- item`) of scalars under a key with an empty value, with all items at one indent not less than the key's indent. It MUST reject, with an issue naming the key and the offending line: flow collections, anchors, aliases, tags, block scalars, multi-line plain scalars, nesting deeper than one level, duplicate keys, tab indentation, and any other double-quote escape (the issue MUST advise single quotes). Full-line comments and blank lines MUST be skipped. A listed key with a non-empty inline value MUST stay in `data` so the rule layer can report `check must be a nested mapping`. Calls without `mappings` MUST return exactly today's result shapes with no `maps` key, and every key not listed (such as `paths:`) MUST remain opaque exactly as before.

The reader MUST also accept an opt-in `lists` option (a list of top-level key names, used with `allowNested`, independent of and combinable with `mappings`) and return a `lists` result mapping each listed key present in the frontmatter to a `string[]`. Only `parseAgent` requests `['skills']`. A listed key MUST be read as a list of scalars from exactly one of two forms, and both forms MUST yield the same list for the same items:

- Block form: the key has an empty inline value (a trailing `# comment` is ignored) followed by `- item` lines at one consistent indent not less than the key's indent. Each item MUST be a plain scalar (trailing ` # comment` stripped), a single-quoted scalar (`''` decodes to `'`), or a double-quoted scalar with only the escapes `\\ \" \/ \n \t`. Blank lines and full-line comments between items MUST be skipped. A key with an empty inline value and no items MUST yield an empty list.
- Inline flow form: the key's inline value is `[` items `]`, on one line, with items separated by commas, each item a plain, single-quoted or double-quoted scalar as above. Whitespace around items and around the brackets MUST be ignored. `[]` and `[ ]` MUST yield an empty list. A single trailing comma before `]` (`[a, b,]`) MUST be accepted. Commas inside a quoted item are part of the item. A trailing ` # comment` after `]` MUST be ignored. A plain item MUST NOT contain `,`, `[`, `]`, `{`, `}` or `: `, nor start with a YAML indicator.

Anything else under a listed key MUST be rejected with an issue naming the key and the offending line, and the key MUST NOT silently fall back to opaque. This includes: a nested mapping (an indented `name: value` line, or an item of the form `- name: value`), an item that is itself a flow collection or a nested sequence, a block scalar (`|` or `>`), a plain non-list inline value (`skills: foo`), a flow sequence that does not close on the same line or has trailing text after `]` other than a comment, an empty item (`[a,,b]`, a lone leading comma, or a `-` with no value), more than one trailing comma, anchors, aliases, tags, tab indentation, items at inconsistent indents, and any other double-quote escape (the issue MUST advise single quotes). Duplicate occurrences of the listed key MUST be rejected. Items are returned in order and exactly as written after unquoting and trimming; de-duplication is the caller's concern. A listed key MUST NOT appear in `opaque`.

Calls without `lists` MUST return exactly today's result shapes with no `lists` key, so every key not listed MUST behave exactly as before, including `skills` when not requested. Default (strict) mode MUST be unchanged: skills and commands MUST keep rejecting multi-line, block-scalar, or nested values exactly as before, including the handling of blank lines inside frontmatter. The reader MUST remain pure (no `fs`, `os`, `path`, `child_process`, or `process`). Malformed nested YAML elsewhere is not detected, and full YAML semantics (flow or quoted multi-line scalars, anchors, tags, block scalars inside nested values) are not supported; these limits MUST be documented.
(Previously: only `allowNested` and `mappings` existed; every nested list such as an agent `skills` list was opaque, with no opt-in `lists` option and no inline flow sequence support)

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

#### Scenario: Mapping read with the mappings option

- GIVEN a rule whose frontmatter has `check:` followed by indented lines `type: pattern-absent`, `files: 'src/**/*.ts'`, and `pattern: ':\s*any\b'`
- WHEN parsed with `allowNested` and `mappings: ['check']`
- THEN `maps.check` holds those three values as strings, unquoted, and `check` is not reported as opaque

#### Scenario: Scalar forms in a mapping

- GIVEN `check:` with `max: 300`, `exclude: "a\tb"`, `pattern: 'it''s'`, and `message: Plain text # trailing comment`
- WHEN parsed with `mappings: ['check']`
- THEN `max` is the text `300`, the double-quoted value decodes its escape, `pattern` is `it's`, and the trailing comment is stripped from `message`

#### Scenario: Block sequence in a mapping

- GIVEN `check:` with `files:` followed by `- 'src/**/*.ts'` and `- 'lib/**/*.ts'` at either legal indent
- WHEN parsed with `mappings: ['check']`
- THEN `maps.check.files` is the list of the two strings

#### Scenario: Mapping coexists with opaque keys

- GIVEN a rule with both a `paths:` list and a `check:` mapping, in either order, plus `severity: warn`
- WHEN parsed with `mappings: ['check']`
- THEN `paths` is reported as opaque, `maps.check` is returned, and `severity` is returned as a scalar in `data`

#### Scenario: Unsupported constructs rejected

- GIVEN a `check` block containing a flow sequence `[a, b]`, a flow mapping, an anchor, an alias, a tag, a block scalar (`|` or `>`), a multi-line plain scalar, a nested mapping below the first level, a duplicate key, a tab indent, a plain scalar starting with an indicator such as `*` or containing `: `, or a double-quoted `\s` escape
- WHEN parsed with `mappings: ['check']`
- THEN an issue naming the key and the offending line is returned, and the `\s` issue advises single quotes

#### Scenario: Inline value stays in data

- GIVEN `check: pattern-absent` on one line
- WHEN parsed with `mappings: ['check']`
- THEN the value stays in `data` and `maps` has no `check` entry

#### Scenario: Empty mapping block

- GIVEN `check:` followed by no indented lines
- WHEN parsed with `mappings: ['check']`
- THEN an issue naming `check` is returned

#### Scenario: Calls without mappings unchanged

- GIVEN a rule parsed with `allowNested` and no `mappings` option
- WHEN `check:` is followed by indented lines
- THEN `check` is reported as opaque, the result has no `maps` key, and the result shape is identical to before this change

#### Scenario: Reader accepts only valid YAML

- GIVEN any `check` block the reader accepts
- WHEN read by a standard YAML 1.2 parser
- THEN it yields the same values (strict-subset guarantee)

#### Scenario: List read from a block sequence

- GIVEN `skills:` followed by `- a`, `- 'b'` and `- "c"` at two-space indent
- WHEN parsed with `allowNested` and `lists: ['skills']`
- THEN `lists.skills` is `['a', 'b', 'c']` and `skills` is not reported as opaque

#### Scenario: Block sequence indent forms

- GIVEN `skills:` followed by items at zero indent (`- a`) or at two-space indent, all items at the same indent
- WHEN parsed with `lists: ['skills']`
- THEN both yield the same list

#### Scenario: Block sequence with comments and blank lines

- GIVEN `skills:` with a full-line comment, a blank line, and an item `- a # note`
- WHEN parsed with `lists: ['skills']`
- THEN `lists.skills` is `['a']`

#### Scenario: List read from an inline flow sequence

- GIVEN `skills: [a, b]`
- WHEN parsed with `lists: ['skills']`
- THEN `lists.skills` is `['a', 'b']`, identical to the block form of the same items

#### Scenario: Inline quotes, spacing and trailing comma

- GIVEN `skills: [ 'a', "b" , c, ]`
- WHEN parsed with `lists: ['skills']`
- THEN `lists.skills` is `['a', 'b', 'c']`

#### Scenario: Comma inside a quoted inline item

- GIVEN `skills: ['a,b', c]`
- WHEN parsed with `lists: ['skills']`
- THEN `lists.skills` is `['a,b', 'c']`

#### Scenario: Empty inline list

- GIVEN `skills: []` or `skills: [ ]`
- WHEN parsed with `lists: ['skills']`
- THEN `lists.skills` is an empty list and no issue is returned

#### Scenario: Empty key without items

- GIVEN `skills:` followed directly by another top-level key
- WHEN parsed with `lists: ['skills']`
- THEN `lists.skills` is an empty list and no issue is returned

#### Scenario: Trailing comment after the inline list

- GIVEN `skills: [a, b] # needed`
- WHEN parsed with `lists: ['skills']`
- THEN `lists.skills` is `['a', 'b']`

#### Scenario: Malformed lists rejected

- GIVEN a listed key with a nested mapping (`skills:` followed by `  docs: yes`), an item `- docs: yes`, a nested flow item `[[a]]`, a block scalar `skills: |`, a plain value `skills: foo`, an unclosed `skills: [a, b`, trailing text `skills: [a] x`, an empty item `[a,,b]`, a double trailing comma `[a,,]`, a bare `-`, an anchor, a tab indent, mixed item indents, or a double-quoted `\s` escape
- WHEN parsed with `lists: ['skills']`
- THEN an issue naming `skills` and the offending line is returned, the `\s` issue advises single quotes, and the key is not silently treated as opaque

#### Scenario: Duplicate listed key rejected

- GIVEN two `skills:` keys in one frontmatter
- WHEN parsed with `lists: ['skills']`
- THEN an issue naming `skills` is returned

#### Scenario: Lists coexist with other options and opaque keys

- GIVEN an agent with `tools:` as a list, a `hooks:` nested block, and `skills: [a]`
- WHEN parsed with `allowNested` and `lists: ['skills']`
- THEN `tools` and `hooks` are reported as opaque and `lists.skills` is `['a']`

#### Scenario: Calls without lists unchanged

- GIVEN an agent parsed with `allowNested` and no `lists` option
- WHEN `skills:` is followed by indented list items or an inline list
- THEN `skills` is handled exactly as before (opaque when nested), the result has no `lists` key, and the result shape is identical to before this change

#### Scenario: Strict mode ignores lists

- GIVEN a skill or command whose frontmatter contains a `skills` key
- WHEN parsed in default mode
- THEN behavior and error messages are identical to before this change

#### Scenario: Reader stays pure

- GIVEN the portability guard for the domain layer
- WHEN it inspects the frontmatter reader
- THEN the module still imports no `fs`, `os`, `path`, `child_process`, `process`, adapters or application code

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

The catalog MUST support `rules/<name>.md` listed in `items.rules` (optional, default empty). The loader MUST validate each rule on load. A rule is invalid when: a listed name has no file, a `rules/*.md` file is not listed, frontmatter is missing or unparseable, `name` or `description` is missing or empty or whitespace, `name` differs from the file stem, the body is empty, the name does not match `^[a-z0-9][a-z0-9-]*$`, or the rule declares a `check` or `severity` that does not validate against the `rule-checks` capability. A valid rule that declares a `check` MUST expose the parsed check and its effective severity. `check` and `severity` are no longer reserved keys, and the former rejection (`key 'X' is reserved for rule checks`) MUST NOT exist. Invalid rules MUST be reported with path and reason and MUST NOT be installable; valid items remain usable. Source guards (traversal, symlink, size limit) MUST apply. Rules MUST NOT be validated against an allowed-field list: unknown frontmatter keys other than `check` and `severity`, and nested frontmatter such as a `paths:` list, MUST pass through and bytes MUST stay verbatim. Rule subdirectories are not scanned. The bundled catalog MUST ship the ten seed rules defined in `rules-install`.
(Previously: the requirement did not mention `check` or `severity`; the loader rejected both as reserved keys, and a valid rule exposed no check)

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

#### Scenario: Rule with valid check loads

- GIVEN `rules/no-any.md` with `name`, `description`, a valid `check:` mapping, `severity: warn`, a non-empty body, and listed in `items.rules`
- WHEN loaded
- THEN rule `no-any` is available, exposes the parsed check with severity `warn`, and its bytes equal the file on disk

#### Scenario: check and severity no longer reserved

- GIVEN a rule declaring `check` and `severity`
- WHEN loaded
- THEN no error mentions the keys being reserved

#### Scenario: Invalid check rejects only that rule

- GIVEN `rules/bad.md` with `check:` of unknown `type`, and a valid `rules/good.md`
- WHEN loaded
- THEN an error names `rules/bad.md` and the reason, `bad` is not selectable, and `good` remains usable

#### Scenario: Severity without check

- GIVEN `rules/x.md` with `severity: error` and no `check`
- WHEN loaded
- THEN the rule is rejected naming `rules/x.md` and `severity`

#### Scenario: Install bytes unchanged for checked rules

- GIVEN a loaded rule that declares a `check`
- WHEN installed
- THEN the installed file bytes equal the catalog file bytes, including the `check` and `severity` lines

#### Scenario: Seed rules unchanged

- GIVEN the bundled catalog after this change
- WHEN loaded
- THEN it still ships the ten seed rules, none declaring `check` or `severity`
