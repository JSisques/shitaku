# Catalog Scripts Dead-Code Specification

## Purpose

CLI, formats, include, envelope, exit, no-fix, knip config, tool resolution, and package.json deps classification for bundled `dead-code`.

## Requirements

### Requirement: Dead-code CLI

`shitaku run dead-code` MUST analyze the consumer project via knip and MUST support `--include` kind filtering.

#### Scenario: Clean project

- GIVEN fixture with no unused findings
- WHEN run with defaults
- THEN exit 0

#### Scenario: Findings present

- GIVEN unused export, file, or dependency fixtures
- WHEN run
- THEN exit 1 and findings appear in output

### Requirement: Output formats

Default stdout MUST be JSON. `--format text` MUST print human-readable rows of the same findings. Unsupported `--format` MUST exit 2.

#### Scenario: Default JSON

- GIVEN valid project
- WHEN run without `--format`
- THEN stdout is one JSON object matching the envelope

#### Scenario: Text format

- GIVEN findings
- WHEN `--format text`
- THEN stdout lists kind, file, and name without JSON parse

### Requirement: Include filter

`--include` MUST restrict which kinds appear in output and count toward exit 1. Unknown kind tokens MUST exit 2.

#### Scenario: Include subset

- GIVEN unused export and unused file
- WHEN `--include exports`
- THEN only `exports` findings appear; exit 1 if any included finding exists

### Requirement: JSON envelope

JSON MUST use `schema`=`"shitaku.catalog.dead-code/v1"`, `tool`=`"dead-code"`, and `findings` keys `files`, `exports`, `types`, `dependencies`, `devDependencies`, `unlisted`. All six keys MUST always be present (empty arrays OK). Each finding MUST include `file` and `name`; MAY include `line`/`col`. Sort within each kind MUST be by `file`, then `name`, then `line`.

#### Scenario: Shape and empty keys

- GIVEN only unused exports
- WHEN JSON emits
- THEN all six keys exist; non-export arrays are `[]`

#### Scenario: Stable sort

- GIVEN multiple findings in one kind
- WHEN JSON emits
- THEN ordered by file, name, line

### Requirement: Exit codes

Exit MUST be 0 (no included findings), 1 (any included finding), or 2 (tool/parse/config/IO/CLI failure). Script MUST map outcomes; knip native exit MUST NOT pass through unchanged.

#### Scenario: Fatal tool error

- GIVEN knip cannot run or JSON cannot parse
- WHEN run
- THEN exit 2

### Requirement: No fix

Script MUST NOT pass `--fix` to knip. User-supplied `--fix` MUST exit 2 and MUST NOT mutate the project.

#### Scenario: Fix rejected

- GIVEN args include `--fix`
- WHEN run
- THEN exit 2 and project files unchanged

### Requirement: Knip config policy

Consumer knip config (`knip.json`, `knip.config.*`, or package.json knip field) MUST be used when present; else knip defaults. Catalog MUST NOT ship overriding knip config.

#### Scenario: Consumer config

- GIVEN project knip config ignoring an unused export
- WHEN run
- THEN that export is absent from findings

#### Scenario: Defaults without config

- GIVEN fixture without knip config
- WHEN run
- THEN knip defaults apply and unused fixtures are reported

### Requirement: Tool resolution

`knip` MUST resolve from cwd `node_modules/.bin` first, else `npx knip`. Catalog dead-code MUST NOT ship npm deps or bootstrap into the script install root. Declared tools MUST include `knip`.

#### Scenario: Local bin

- GIVEN knip in cwd `.bin` only
- WHEN run
- THEN analysis succeeds without npx

#### Scenario: Npx fallback

- GIVEN no local knip binary
- WHEN run
- THEN knip runs via npx

#### Scenario: No catalog bootstrap

- GIVEN installed `dead-code` tree
- WHEN inspected
- THEN no script-root `node_modules` bootstrap is required

### Requirement: Dependency classification

Unused packages from knip's shared `dependencies` key MUST split into envelope `dependencies` vs `devDependencies` via consumer `package.json`. Names in `#dependencies` (peer/optional as production) → `findings.dependencies`; `#devDependencies` → `findings.devDependencies`; ambiguous → `findings.dependencies`. `unlisted` MUST come from knip `unlisted` without reclassification.

#### Scenario: Split deps and devDeps

- GIVEN unused prod `lodash` and unused dev `unused-dev` both under knip `dependencies`
- WHEN JSON emits
- THEN `lodash` under `findings.dependencies` and `unused-dev` under `findings.devDependencies`

#### Scenario: Unlisted unchanged

- GIVEN knip reports `unlisted` name `rimraf`
- WHEN JSON emits
- THEN `rimraf` under `findings.unlisted`
