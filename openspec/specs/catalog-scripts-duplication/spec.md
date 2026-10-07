# Catalog Scripts Duplication Specification

## Purpose

CLI, envelope, exits, ignore/gitignore, tool resolution, and temp report lifecycle for `duplication`.

## Requirements

### Requirement: Duplication CLI

`shitaku run duplication` MUST analyze via jscpd. MUST support `--threshold`, `--min-lines`, `--min-tokens`, `--format json|text`. Invalid CLI MUST exit 2. Script MUST own `--format` (not jscpd language `--format`). MUST NOT expose `--baseline`.

#### Scenario: Clean under threshold

- GIVEN percentage ≤ threshold
- WHEN run with defaults
- THEN exit 0

#### Scenario: Over threshold

- GIVEN known clones above threshold
- WHEN run
- THEN exit 1 and clones in output

### Requirement: Output formats

Default stdout MUST be JSON. `--format text` MUST print human-readable percentage and clones. Unsupported `--format` MUST exit 2.

#### Scenario: Default JSON

- GIVEN valid project
- WHEN run without `--format`
- THEN stdout is one envelope JSON object

#### Scenario: Text format

- GIVEN clones present
- WHEN `--format text`
- THEN stdout lists percentage and locations without JSON parse

### Requirement: JSON envelope

JSON MUST use `schema`=`"shitaku.catalog.duplication/v1"`, overall `percentage`, applied `threshold`, and `clones[]`. Each clone MUST include both locations (file + line range), `lines`, and `tokens`.

#### Scenario: Shape with clones

- GIVEN known duplicates
- WHEN JSON emits
- THEN schema, percentage, threshold, and clones with both locations, lines, tokens

#### Scenario: Empty clones

- GIVEN clean fixture
- WHEN JSON emits
- THEN `clones` is `[]` and percentage within threshold

### Requirement: Exit codes

Exit MUST be 0 (≤ threshold), 1 (> threshold), or 2 (tool/parse/CLI failure). Script MUST map outcomes; jscpd exit MUST NOT pass through.

#### Scenario: Fatal tool error

- GIVEN jscpd cannot run or report unparsable
- WHEN run
- THEN exit 2

### Requirement: Ignore and gitignore defaults

Defaults MUST honor gitignore and MUST ignore `node_modules`, build output, and test fixtures.

#### Scenario: Defaults skip ignored paths

- GIVEN duplicates only under `node_modules` or build output
- WHEN run with defaults
- THEN those clones absent; exit 0 if remaining ≤ threshold

### Requirement: Tool resolution

`jscpd` MUST resolve from cwd `node_modules/.bin` first, else `npx jscpd`. Catalog MUST NOT ship npm deps or script-root bootstrap. Declared tools MUST include `jscpd`.

#### Scenario: Local bin

- GIVEN jscpd in cwd `.bin` only
- WHEN run
- THEN succeeds without npx

#### Scenario: Npx fallback

- GIVEN no local jscpd
- WHEN run
- THEN jscpd via npx

#### Scenario: No catalog bootstrap

- GIVEN installed `duplication` tree
- WHEN inspected
- THEN no script-root npm bootstrap required

### Requirement: Temp report lifecycle

Script MUST use temporary jscpd JSON output and MUST remove it after parse. MUST NOT leave cwd `report/` residue.

#### Scenario: No leftover report dir

- GIVEN any fixture run
- WHEN run completes
- THEN no leftover `report/`
