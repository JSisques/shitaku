# Catalog Scripts Complexity Specification

## Purpose

CLI, thresholds, formats, ignore, JSON envelope, and exit codes for bundled `complexity`.

## Requirements

### Requirement: Complexity CLI and thresholds

`shitaku run complexity` MUST accept path/glob args. MUST support `--max-cyclomatic` (default 10) and `--max-cognitive` (default 15). Script MUST enforce thresholds after scoring (not only ESLint rule max).

#### Scenario: Under default thresholds

- GIVEN JS/TS fixtures at or below 10/15
- WHEN run with defaults
- THEN exit 0

#### Scenario: Over threshold

- GIVEN any function above a threshold
- WHEN run
- THEN exit 1

### Requirement: Output formats

Default stdout MUST be JSON (D4A). `--format text` MUST print a human table of the same functions. Unsupported `--format` MUST exit 2.

#### Scenario: Default JSON

- GIVEN valid targets
- WHEN run without `--format`
- THEN stdout is one JSON object matching the envelope

#### Scenario: Text format

- GIVEN valid targets
- WHEN `--format text`
- THEN stdout lists file, name, line, cyclomatic, cognitive without requiring JSON parse

### Requirement: JSON envelope (D4A)

JSON MUST include `schema`, `tool`=`"complexity"`, and `functions[]`. Each entry MUST have `file`, `name`, `line`, `cyclomatic`, `cognitive`. Sort MUST be worst-first by `max(cyclomatic,cognitive)`, then file, then line. Missing cognitive MUST be `0`. Anonymous functions MUST use a stable non-empty `name`.

#### Scenario: Shape and sort

- GIVEN two functions with different max scores
- WHEN JSON emits
- THEN higher max first; required fields present

#### Scenario: Cognitive zero-fill

- GIVEN cyclomatic-only row
- WHEN JSON emits
- THEN `cognitive` is 0

### Requirement: Exit codes

Exit MUST be 0 (ok), 1 (any exceedance), or 2 (tool/parse/config/IO failure).

#### Scenario: Fatal tool error

- GIVEN ESLint cannot run
- WHEN run
- THEN exit 2

### Requirement: Language coverage

MUST analyze `.js` and `.ts` under given paths/globs.

#### Scenario: JS and TS

- GIVEN `.js` and `.ts` fixtures
- WHEN run on those paths
- THEN both appear in results

### Requirement: Ignore policy (D3A)

MUST apply consumer `.gitignore` via `includeIgnoreFile` when present, plus fixed ignores including at least `node_modules` and `.git`. Ignored paths MUST NOT appear in results.

#### Scenario: Gitignore

- GIVEN a measurable file in `.gitignore`
- WHEN scanning a parent path
- THEN file absent from `functions`

#### Scenario: Fixed ignores

- GIVEN files under `node_modules/` or `.git/`
- WHEN scanning project root
- THEN those files absent from `functions`

### Requirement: Install-root tools (D1A, D2A)

Tools MUST resolve from `…/scripts/complexity/node_modules` (local `eslint` + importable packages). MUST NOT rely on multi `-p` alone for flat-config imports. Declared tools MUST include `eslint`, `eslint-plugin-sonarjs`, `typescript-eslint`, `typescript`, `@eslint/js`. MUST use shipped flat config (`-c`), not the consumer ESLint config.

#### Scenario: Local root

- GIVEN tools in script install root only
- WHEN analyzing
- THEN eslint and plugin imports succeed without consumer installs

#### Scenario: Shipped config

- GIVEN conflicting consumer ESLint config
- WHEN run
- THEN shipped complexity config is used
