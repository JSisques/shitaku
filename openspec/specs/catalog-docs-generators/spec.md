# Catalog Docs Generators Specification

## Purpose

README catalog table generator and website catalog emitter read item descriptions through the domain frontmatter reader, so one decoder serves the CLI and the docs scripts.

## Requirements

### Requirement: Single description decoder

`scripts/generate-catalog-table.mjs` and `scripts/generate-website-catalog.mjs` MUST read item descriptions through a shared helper under `scripts/lib/` that calls `readFrontmatter` from `src/domain/catalog/frontmatter.ts`. Neither script MUST keep a local `frontmatterDescription()` or any other description or block-scalar decoding logic. The domain reader MUST NOT change behavior for this capability.

#### Scenario: No local decoder

- GIVEN both generator scripts
- WHEN their sources are inspected
- THEN neither defines `frontmatterDescription()` and both obtain descriptions from the shared helper

### Requirement: Mode per catalog kind

For agents and rules the helper MUST call `readFrontmatter` with `allowNested: true`, then trim the description and collapse internal whitespace runs to single spaces (mirroring `parseAgent`). For skills and commands the helper MUST call `readFrontmatter` in default strict mode (as the CLI loaders do).

#### Scenario: Agent literal block scalar

- GIVEN an agent with `description: |` and a multi-line indented body
- WHEN the README table and the website pages (en and es) are generated
- THEN the description is the decoded text on a single line with whitespace collapsed, never a literal `|`

#### Scenario: Agent folded block scalar

- GIVEN an agent with `description: >` and a multi-line indented body
- WHEN the README table and the website pages (en and es) are generated
- THEN the description is the decoded text on a single line, never a literal `>`

#### Scenario: Rule block scalar

- GIVEN a rule with a `|` or `>` description and a generator that renders rules
- WHEN the outputs are generated
- THEN the description is decoded single-line text

#### Scenario: Strict kinds

- GIVEN a skill or command with a single-line description
- WHEN the outputs are generated
- THEN the description is read in strict mode and rendered unchanged

### Requirement: Invalid strict frontmatter fails generation

If the reader rejects a skill or command frontmatter, the generator MUST exit non-zero and its error MUST name the file and the reader issue. It MUST NOT emit a row or page for that item.

#### Scenario: Rejected skill

- GIVEN a skill whose frontmatter the strict reader rejects
- WHEN a generator runs
- THEN it exits non-zero, names the file and the issue, and emits no row for it

### Requirement: Byte-identical output for single-line descriptions

For every bundled catalog item with a single-line description, generated README and website output MUST be byte-identical to the output before this change. `docs:catalog:check` and `docs:website-catalog:check` MUST pass with no regeneration diff.

#### Scenario: Bundled catalog unchanged

- GIVEN the bundled `catalog/`
- WHEN both generators run in `--check` mode
- THEN both pass and no generated file changes

### Requirement: Domain reader stays plain-Node loadable

`src/domain/catalog/frontmatter.ts` MUST remain free of imports of other modules and MUST use only erasable TypeScript syntax (no enums, namespaces or parameter properties), so plain `node` loads it from `.mjs` through native type stripping with no flag, no build step and no new dependency. A test in `pnpm test` MUST fail if this stops holding.

#### Scenario: Guard passes

- GIVEN the current `frontmatter.ts`
- WHEN the guard test imports it under plain `node` in a spawned process
- THEN the import succeeds and `readFrontmatter` is exported

#### Scenario: Guard fails on regression

- GIVEN `frontmatter.ts` gains an import of another module or non-erasable syntax
- WHEN `pnpm test` runs
- THEN the guard test fails

### Requirement: Generator test sandbox

The generator tests' sandbox MUST provide `scripts/lib/**` and `src/domain/catalog/frontmatter.ts` alongside the two scripts, and MUST include fixtures with `|` and `>` descriptions covering the README table and the website pages in en and es.

#### Scenario: Sandboxed run

- GIVEN the sandbox with the scripts, `scripts/lib/**` and `frontmatter.ts`
- WHEN a generator runs against block-scalar fixtures
- THEN it succeeds and the assertions on decoded text pass

### Requirement: Node floor aligned to 22.18

The minimum supported Node version MUST be `>=22.18` everywhere it is stated or enforced, because native type stripping is unflagged only from 22.18. `package.json` `engines.node` MUST be `>=22.18` (replacing the invalid `v26.10.0`). `README.md` (badge and "Requires Node"), `CONTRIBUTING.md` (requirements, script notes and the `.nvmrc` pin), `AGENTS.md` and `openspec/config.yaml` MUST state `>=22.18`. The `.nvmrc` pin MUST satisfy `>=22.18` and CONTRIBUTING MUST agree with `.nvmrc`. Any test guarding these values MUST be updated in the same change. The change MUST be flagged in the commit message and PR body as raising the published minimum from 22.13.

#### Scenario: Consistent floor

- GIVEN `package.json`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md` and `openspec/config.yaml`
- WHEN the stated Node minimum is read in each
- THEN every one says `>=22.18`, none says `22.13` or `v26.10.0`

#### Scenario: Pin agrees

- GIVEN `.nvmrc` and the pinned version in CONTRIBUTING
- WHEN compared
- THEN they are equal and satisfy `>=22.18`

#### Scenario: Guards green

- GIVEN the updated values
- WHEN `pnpm test` runs
- THEN tooling and other guard tests pass
