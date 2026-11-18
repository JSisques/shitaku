# Delta for Catalog

## MODIFIED Requirements

### Requirement: Opt-in nested frontmatter reader

The frontmatter reader MUST offer an opt-in `allowNested` mode, used only for agents and rules. In that mode, top-level scalar keys MUST be extracted, and top-level keys whose value is a YAML block scalar MUST be decoded into their string value in `data`. The supported block-scalar subset is: a header of `|` (literal) or `>` (folded), optionally followed by a chomping indicator (`-` strip, `+` keep; absent means clip) and an indentation indicator (`1`-`9`) in either order, optionally followed by a trailing `# comment`. Content indentation MUST be the indicator when present, otherwise the indentation of the first non-blank content line. The scalar MUST end at the first non-blank line indented less than the content indentation, or at the next top-level key. Literal (`|`) MUST keep line breaks; folded (`>`) MUST join consecutive lines with a single space and keep blank lines as paragraph breaks. Blank lines inside the block MUST be preserved, CRLF line endings MUST be handled, and a header with no content lines MUST decode to an empty string. A non-blank block-scalar line whose indentation starts with a tab MUST be rejected with the error `frontmatter key 'X' has a block scalar indented with a tab`. Other indented lines and list items belonging to a key whose value is empty or a nested mapping or list MUST be accepted and kept opaque (not parsed or validated); only such keys appear in the `opaque` result. The reader MUST additionally accept an opt-in `mappings` option (a list of top-level key names, used with `allowNested`) and return a `maps` result. A listed key with an empty inline value MUST have its indented block parsed one nested level deep into `maps[key]` instead of being opaque; only `parseRule` requests `['check']`. The block reader MUST accept this strict subset of YAML: keys matching `^[a-z][a-z0-9-]*$` at one consistent space indent greater than zero; plain scalars (rejected when starting with a YAML indicator or containing `: ` or an inner ` #`; a trailing ` # comment` is stripped); single-quoted scalars (`''` decodes to `'`); double-quoted scalars with only the escapes `\\ \" \/ \n \t`; and block sequences (`- item`) of scalars under a key with an empty value, with all items at one indent not less than the key's indent. It MUST reject, with an issue naming the key and the offending line: flow collections, anchors, aliases, tags, block scalars, multi-line plain scalars, nesting deeper than one level, duplicate keys, tab indentation, and any other double-quote escape (the issue MUST advise single quotes). Full-line comments and blank lines MUST be skipped. A listed key with a non-empty inline value MUST stay in `data` so the rule layer can report `check must be a nested mapping`. Calls without `mappings` MUST return exactly today's result shapes with no `maps` key, and every key not listed (such as `paths:`) MUST remain opaque exactly as before. Default (strict) mode MUST be unchanged: skills and commands MUST keep rejecting multi-line, block-scalar, or nested values exactly as before, including the handling of blank lines inside frontmatter. The reader MUST remain pure (no `fs`, `os`, `path`, `child_process`, or `process`). Malformed nested YAML elsewhere is not detected, and full YAML semantics (flow or quoted multi-line scalars, anchors, tags, block scalars inside nested values) are not supported; these limits MUST be documented.
(Previously: nested keys were all opaque; no opt-in `mappings` option existed, so a nested mapping could not be read as structured data)

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
