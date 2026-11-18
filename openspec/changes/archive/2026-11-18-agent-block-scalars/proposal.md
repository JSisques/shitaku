# Proposal: Block Scalars in Agent `name` and `description`

## Intent

Agent files (#238) cannot use YAML block scalars (`|`, `>`, with chomping or indentation indicators) for `name` or `description`. The nested frontmatter reader treats those values as opaque, and `parseAgent` rejects them with `key 'X' must be a single-line value`. Real Claude Code sub-agents often write long descriptions as folded (`>`) or literal (`|`) blocks, so authors must rewrite them before they can ship in a catalog. The v1 limit was deliberate (archived `catalog-add-agents`) and documented with a link to #238; this change lifts it for agents only, without adding a YAML dependency and without changing strict mode for skills and commands.

## Scope

### In Scope

- `src/domain/catalog/frontmatter.ts`, `allowNested` mode only: decode a narrow, documented subset of block scalars for top-level keys.
  - Header: `|` or `>` with optional chomping (`-`, `+`) and indentation indicator (`1`-`9`) in either order, optional trailing `# comment`.
  - Content indent: the indicator when present, else the first non-blank content line. The scalar ends at the first non-blank line indented less than that, or at the next top-level key.
  - `|` keeps line breaks; `>` folds lines into spaces and keeps blank-line paragraph breaks. Chomping: strip, keep, or clip (default). Blank lines inside the block are preserved; CRLF is handled; tab indentation and a header with no content lines are handled explicitly (empty value).
  - Decoded values go into `data`; `opaque` keeps only keys with empty or nested (non-scalar) values.
  - `splitBlock` iterates raw lines so blank lines survive in nested mode, with strict-mode output unchanged.
- `src/domain/catalog/agent.ts` `parseAgent`:
  - Trim the decoded `name` and `description`; an empty or whitespace-only block hits the existing `X: frontmatter key is required` rejection.
  - Normalize `description` by collapsing internal whitespace (including newlines) to single spaces, so every consumer (clack hint, `list`, JSON) receives a one-line value.
  - A `name` or `description` that is still opaque (nested mapping or list) is still rejected, with reworded message.
  - `name` is compared to the file stem after decoding and trimming.
  - Agent `bytes` stay verbatim (install output unchanged).
- Strict TDD: RED first in `test/domain/catalog/frontmatter.test.ts` and `test/domain/catalog/agent.test.ts` (literal and folded opaque cases become decoded cases); helpers in `test/helpers/agents.ts` as needed.
- Docs: README.md, CONTRIBUTING.md, `website/src/content/docs/{en,es}/security.md` updated to describe block-scalar support and the remaining limit (nested YAML passed through without syntax validation). `test/agents-docs.test.ts` pins updated in the same commit.
- Delta specs for `catalog` and `agents-install`.

### Out of Scope

- Strict mode (skills and commands): behavior and error messages unchanged.
- A third-party YAML dependency (`yaml` or similar).
- Full YAML semantics: flow scalars spanning lines, quoted multi-line scalars, anchors, tags, block scalars inside nested values. Nested values stay opaque.
- Block-scalar support for keys other than top-level scalars read by `parseAgent` (other keys still pass through verbatim in bytes).
- `scripts/generate-catalog-table.mjs` and `scripts/generate-website-catalog.mjs`: they parse `description:` line by line and are not updated (no bundled agent uses block scalars today). Noted as a risk.
- Changes to the clack prompter or `list` rendering (normalization happens upstream in `parseAgent`).

## Capabilities

### New Capabilities

None

### Modified Capabilities

- `catalog`: "Opt-in nested frontmatter reader" changes from treating block scalars as opaque to decoding a documented block-scalar subset for top-level keys in `allowNested` mode (strict mode unchanged). "Agent catalog entries" changes to accept block-scalar `name`/`description`, trim and collapse whitespace in the parsed `description`, compare a decoded `name` to the stem, and keep rejecting empty, whitespace-only, or nested values. Documentation scenario updated to describe block-scalar support and the remaining limit.
- `agents-install`: add a scenario that an agent with block-scalar `name`/`description` installs with catalog-identical bytes, and that its description is offered as a single-line value in selection.

## Approach

Exploration Approach 1 (decision already made): hand-roll a narrow block-scalar decoder inside `frontmatter.ts`, active only when `allowNested` is set. The domain layer stays pure and dependency-free, and opaque YAML such as `tools` and `hooks` keeps its current tolerant pass-through (a full YAML parser could start rejecting blocks that load today). `parseAgent` owns semantic cleanup (trim, whitespace collapse, required-field check), so adapters receive clean values and install bytes stay verbatim.

Order of work: frontmatter decoder tests (RED) then decoder (GREEN), `parseAgent` tests then changes, then docs plus `agents-docs.test.ts` pins together, then delta specs. Suggested commits:

1. `feat(catalog): decode block scalars in agent frontmatter` (frontmatter, agent, tests).
2. `docs: document block scalar support for agents` (README, CONTRIBUTING, website en/es, docs test pins).

## Affected Areas

Hexagonal layers: domain only in `src/`. No port, application, or adapter changes.

| Area                                               | Impact   | Description                                                            |
| -------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `src/domain/catalog/frontmatter.ts`                | Modified | Block-scalar decoder in nested mode; `splitBlock` keeps blank lines    |
| `src/domain/catalog/agent.ts`                      | Modified | Trim, whitespace collapse, reworded opaque rejection                   |
| `test/domain/catalog/frontmatter.test.ts`          | Modified | Decoded literal/folded/chomping/indent cases; strict-mode regressions  |
| `test/domain/catalog/agent.test.ts`                | Modified | Block-scalar name/description, empty block rejection, stem comparison  |
| `test/helpers/agents.ts`                           | Modified | Fixture helpers if needed                                              |
| `test/agents-docs.test.ts`                         | Modified | Pins for new docs wording                                              |
| `README.md`, `CONTRIBUTING.md`                     | Modified | Replace the single-line limit with block-scalar support and the subset |
| `website/src/content/docs/{en,es}/security.md`     | Modified | Same, en and es                                                        |
| `openspec/changes/agent-block-scalars/specs/...`   | New      | Delta specs for `catalog` and `agents-install`                         |
| `src/adapters/cli/clack-prompter.ts`, `program.ts` | None     | Receive already-normalized description                                 |
| `scripts/*.mjs` generators                         | None     | Out of scope (risk noted)                                              |

## Risks

| Risk                                                                                      | Likelihood | Mitigation                                                                                                    |
| ----------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `splitBlock` change alters strict-mode results                                            | Med        | Existing strict-mode tests stay green unchanged; add explicit regression tests for blank lines in strict mode |
| Folded semantics diverge from the YAML spec on edge cases (more-indented lines, `+` keep) | Med        | Document the subset; test each edge (paragraphs, chomping, indicator, trailing blanks, comments)              |
| Tabs, CRLF, or a header with no content produce surprising values                         | Low        | Explicit tests; empty result falls into the existing required-field rejection                                 |
| `.mjs` doc generators misread a block-scalar description                                  | Low        | No bundled agent uses block scalars; noted as follow-up if one is added                                       |
| `agents-docs.test.ts` pins drift from docs                                                | Low        | Update docs and pins in the same commit                                                                       |
| Normalized description differs from what Claude Code shows                                | Low        | Normalization affects only shitaku's display; installed bytes are verbatim                                    |

## Rollback Plan

Revert the PR (or its two commits). This restores the opaque treatment and the single-line rejection, the previous docs and pins, and the specs. No manifest, migration, or install-output impact: installed agent bytes were verbatim before and after. Catalogs that started using block scalars would fail to load those agents again (reported per item; other items stay usable).

## Dependencies

- Shipped agents capability (archived `catalog-add-agents`).
- No new runtime or dev dependency.

## Review Workload Forecast

Rough authored lines (additions plus deletions): src ~65-95 (decoder ~55-80, `parseAgent` ~10-15), tests ~110-150, docs and pins ~25-35, delta specs ~40-60. Total ~240-340, under the 400-line budget. Single PR, two commits. 400-line budget risk: Low-Med (tests could grow with edge cases). Decision needed before apply: No. Chained PRs recommended: No; if tests push past 400, split docs into a second PR.

## Success Criteria

- [ ] An agent with `description: >` (folded) or `description: |` (literal), with or without chomping and indentation indicators, loads, and its parsed `description` is a trimmed single-line string
- [ ] An agent with block-scalar `name` that equals the stem after trimming loads; one that differs is rejected
- [ ] An empty or whitespace-only block `name` or `description` is rejected with `X: frontmatter key is required`
- [ ] A nested mapping or list under `name`/`description` is still rejected
- [ ] Installed agent bytes equal the catalog bytes for block-scalar agents
- [ ] Opaque `tools`/`hooks` blocks still load unchanged
- [ ] Strict-mode tests for skills and commands pass unchanged
- [ ] README, CONTRIBUTING, and website en/es describe block-scalar support; `test/agents-docs.test.ts` passes with updated pins
- [ ] RED observed before GREEN for decoder and `parseAgent` tests
- [ ] No new dependency in `package.json`; architecture test passes
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run build` pass
