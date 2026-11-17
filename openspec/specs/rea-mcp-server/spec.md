# rea-mcp-server Specification

## Purpose

Catalog-bundled **rea** MCP server (REA, Reverse Engineer Anything): a stdio server exposing reverse-engineering tools to the agent, pinned to an exact `rea-agents` version, installable via existing mcp-install so it stays under shitaku's manifest, undo and status tracking. Native binary analysis needs an existing Hopper, Ghidra or IDA install, which the entry description states.

## ADDED Requirements

### Requirement: Bundled registration

The bundled catalog MUST list `rea` in `items.mcps` and MUST ship `catalog/mcps/rea.json`. The entry MUST load and validate under existing catalog rules, and `name` MUST equal `rea`.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN MCP `rea` is available and valid
- AND the bundled MCP list includes `rea` alongside the previously bundled MCPs

#### Scenario: Entry name mismatch rejected

- GIVEN `catalog/mcps/rea.json` with a `name` other than `rea`
- WHEN the catalog is loaded
- THEN the MCP MUST NOT be selectable
- AND the error MUST name the offending path and reason

### Requirement: Stdio server definition with exact pin

The `rea` server MUST be of type `stdio` with `command` equal to `npx` and `args` equal to `["-y", "rea-agents@6.9.0", "mcp"]`. The version MUST be an exact pin and MUST NOT be `latest` or a range.

#### Scenario: Server definition

- GIVEN the bundled `rea` entry
- WHEN its `server` is inspected
- THEN `type` is `stdio` and `command` is `npx`
- AND `args` is exactly `["-y", "rea-agents@6.9.0", "mcp"]`

#### Scenario: No floating version

- GIVEN the bundled `rea` entry
- WHEN its `args` are inspected
- THEN no argument contains `@latest` or a version range

### Requirement: No environment or secrets

The `rea` entry MUST NOT define an `env` block and MUST NOT contain placeholders or secrets.

#### Scenario: No env block

- GIVEN the bundled `rea` entry
- WHEN its `server` is inspected
- THEN no `env` key is present
- AND no `${VAR}` placeholder appears in the file

### Requirement: Description states the native-analysis prerequisite

The entry MUST have a single-line `description` that names the purpose (reverse engineering) and states that native analysis requires an existing Hopper, Ghidra or IDA install.

#### Scenario: Description content

- GIVEN the bundled `rea` entry
- WHEN its `description` is inspected
- THEN it is one line
- AND it mentions reverse engineering and at least one of Hopper, Ghidra or IDA as a prerequisite for native analysis

### Requirement: Excluded from profiles

No bundled profile (`base`, `web`, `backend`) MUST include `rea`. Existing profile MCP lists MUST remain unchanged.

#### Scenario: Profiles unchanged

- GIVEN this change is applied
- WHEN each bundled profile is loaded
- THEN its MCP list does not contain `rea`
- AND existing profile tests pass without modification

### Requirement: Installable under existing mcp-install

`init --mcps rea --dry-run` MUST plan the MCP from the bundled catalog and MUST NOT write files, backups or manifest. Applied install behavior follows existing mcp-install requirements (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run plans the MCP

- GIVEN the bundled catalog and no existing `rea` entry in the target configuration
- WHEN `init --mcps rea --scope project --dry-run` runs
- THEN the plan includes MCP `rea`
- AND no file, backup or manifest changes occur

#### Scenario: Install follows existing mcp-install

- GIVEN the bundled `rea` entry
- WHEN `init --mcps rea` applies successfully
- THEN the server definition is merged, recorded in the manifest and removable via `undo` exactly as for other bundled MCPs
- AND behavior follows existing mcp-install requirements without modification

### Requirement: Catalog-only surface with synced docs

Delivery MUST be catalog data, tests and regenerated docs only. `src/` hexagonal layers and catalog schemas MUST NOT change. The README MCP table and the website catalog pages (en, es) MUST be regenerated so the docs check scripts pass. The bundled-catalog test MUST assert `rea` in its exact bundled MCP list.

#### Scenario: No src changes

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN `src/` is unchanged
- AND no schema change is introduced

#### Scenario: Generated docs in sync

- GIVEN `rea` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND the README MCP table and website en/es list `rea`

#### Scenario: Bundled-catalog test covers rea

- GIVEN the bundled-catalog test after this change
- WHEN it runs
- THEN its exact MCP name list includes `rea`
- AND it passes
