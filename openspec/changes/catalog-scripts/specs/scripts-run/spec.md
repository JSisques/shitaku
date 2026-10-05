# Scripts Run Specification

## Purpose

Resolve and execute installed scripts via `shitaku run`; tool resolution and doctor warnings.

## Requirements

### Requirement: Name-only run

`run <name> [args]` MUST resolve installed scripts project-first then user (project wins). Paths MUST be rejected. Args MUST pass through. Exit code MUST be the script's.

#### Scenario: Resolve and passthrough

- GIVEN `demo` in both scopes exiting 1 with `--json`
- WHEN `shitaku run demo --json`
- THEN project install runs, receives `--json`, exit is 1

#### Scenario: Path rejected

- GIVEN `./demo` or an absolute path
- WHEN run is invoked
- THEN non-zero exit and no spawn

### Requirement: Bare list and unknown

Bare `shitaku run` MUST list installed scripts (name, scope, description) and exit 0. Unknown name MUST exit non-zero and suggest `shitaku run`.

#### Scenario: List and unknown

- GIVEN installed scripts, and no `ghost`
- WHEN bare `run` or `run ghost`
- THEN listed with scope/description, or non-zero with list suggestion

### Requirement: Runtime and tools

Scripts MUST run as `.mjs` via the Node binary that runs shitaku. Tools MUST resolve `node_modules/.bin` then `npx`. MUST NOT edit `package.json`. Tests MUST cover Windows drive letters, backslashes, spaces, and `.cmd` shims.

#### Scenario: Local bin then npx

- GIVEN tool present or absent in `.bin`
- WHEN script runs
- THEN local bin is used, else `npx`; `package.json` unchanged

### Requirement: Doctor tool warnings

`doctor` MUST warn when an installed script's required tool is missing from local `.bin`. Missing-tool warnings alone MUST NOT fail doctor exit.

#### Scenario: Warn non-fatal

- GIVEN installed script needs `knip` absent locally
- WHEN doctor runs
- THEN warning names script and tool; exit 0 if no other failures
