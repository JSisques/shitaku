# Tasks: Block Scalars in Agent `name` and `description` (#238)

## Review Workload Forecast

| Field                   | Value                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Estimated changed lines | 300-395 authored (src, tests, docs, pins, delta specs; planning files excluded)    |
| 400-line budget risk    | Medium                                                                             |
| Chained PRs recommended | No                                                                                 |
| Suggested split         | Single PR, two commits (feat then docs); if over 400, move commit 2 to a second PR |
| Delivery strategy       | ask-on-risk                                                                        |
| Chain strategy          | pending                                                                            |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

Note: src ~75-100, tests ~150-190, docs and pins ~35-45, delta specs ~40-60. If tests overrun, compact with `it.each` tables rather than dropping cases. If the running count passes 400 before commit 2, ask once for the chain strategy (`ask-on-risk`).

### Spec reconciliation (done in this phase)

The delta spec `specs/catalog/spec.md` was edited to match the authoritative design: (1) opaque `name`/`description` rejection reads exactly `key 'X' must be a single-line or block scalar (| or >) value`; (2) a non-blank block line whose indentation starts with a tab gives `frontmatter key 'X' has a block scalar indented with a tab` (a scenario was added).

### Suggested Work Units

| Unit | Goal                                              | Likely PR | Focused test command                                                                                                                     | Runtime harness                    | Rollback boundary                                                                                                      |
| ---- | ------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1    | Decoder, `parseAgent` changes, folder-source case | PR 1      | `pnpm run test -- test/domain/catalog/frontmatter.test.ts test/domain/catalog/agent.test.ts test/adapters/catalog/folder-source.test.ts` | N/A: domain-only, covered by tests | Revert commit 1 (`src/domain/catalog/{frontmatter,agent}.ts` and their tests)                                          |
| 2    | Docs and pins                                     | PR 1      | `pnpm run test -- test/agents-docs.test.ts`                                                                                              | N/A                                | Revert commit 2 (`README.md`, `CONTRIBUTING.md`, website en/es `security.md`, `test/agents-docs.test.ts`, delta specs) |

## Phase 1: RED, strict-mode regressions (guard the refactor)

- [x] 1.1 In `test/domain/catalog/frontmatter.test.ts`, add strict-mode regression tests (must be GREEN immediately, before any src change): blank and whitespace-only lines between keys are ignored; `description: |2` and `description: | # c` stay plain scalars; `description: >` with an indented line keeps the existing multi-line-or-empty message; a blank line followed by an indented line keeps the multi-line message. Spec: Strict mode unchanged for block scalars and blank lines.
- [x] 1.2 Run `pnpm run test -- test/domain/catalog/frontmatter.test.ts`; record that the new regressions pass on the unmodified source.

## Phase 2: RED, nested decode table

- [x] 2.1 In `test/domain/catalog/frontmatter.test.ts`, remove the literal and folded rows from the nested opaque table (keep `tools`, `mcpServers`, empty value).
- [x] 2.2 Add an `it.each` decode table (nested mode) over the design worked examples, asserting `data` value and that the key is absent from `opaque`: `|` clip, `>-`, `>` with blank paragraph, `>` with more-indented line, `|+`, `|-`, `|2` with extra indent, `|` with inner blank line, `| # note`, `|` followed by next key (`''`). Spec: Literal/Folded block scalar decoded, Chomping indicators, Indentation indicator, Trailing comment on header, Empty block header.
- [x] 2.3 Add cases: `|2-` equals `|-2`; CRLF block decodes with `\n` only; block ends at the next top-level key (`model: sonnet` returned separately); header with no content at end of block; tab as first content indent gives `frontmatter key 'X' has a block scalar indented with a tab`; tab after content started gives the same issue; a less-indented (but indented) line after a block gives the `no owning key` issue; a `#` content line is kept verbatim; `|#x` and `|0` stay plain scalars. Spec: Block ends at dedent or next key, Blank lines and CRLF, Tab-indented block line.
- [x] 2.4 Run the file and record RED (decode cases fail, strict regressions still pass).

## Phase 3: GREEN, decoder

- [x] 3.1 In `src/domain/catalog/frontmatter.ts`: make `splitBlock` return raw lines (split on `/\r?\n/`); convert the main loop to index-based iteration that skips blank lines (`line.trim() === ''`) when not inside a block scalar; keep strict mode (`BLOCK_VALUE`, messages) byte-identical.
- [x] 3.2 Add `BLOCK_HEADER`, `Chomp`, `BlockHeader`, `parseHeader`, and `readBlockScalar` (content indent detection, termination, tab issue, YAML 1.2 folding, chomping) used only when `allowNested` is true; decoded values go to `data`, `opaque` keeps only empty-value keys; update doc comments (pure domain: no `fs`, `os`, `path`, `process`).
- [x] 3.3 Run `pnpm run test -- test/domain/catalog/frontmatter.test.ts` and `test/architecture.test.ts`; confirm GREEN, including the Phase 1 strict regressions.

## Phase 4: RED, `parseAgent`

- [x] 4.1 In `test/domain/catalog/agent.test.ts`, add cases (inline text built with `enc`; `test/helpers/agents.ts` unchanged): folded multi-paragraph description becomes one line; literal with `-`, `+`, and indicator becomes one line; single-line `"a   b"` description becomes `'a b'`; block `name` equal to the stem loads; block `name` `other` gives the stem-mismatch message; empty block and whitespace-only `|+` block give `description: frontmatter key is required`; nested `name`/`description` give exactly `key 'X' must be a single-line or block scalar (| or >) value`; `bytes` are `toBe` the input. Update any existing assertion on the old `must be a single-line value` message. Spec: Folded description, Literal description collapsed to one line, Block-scalar name matches/differs, Empty or whitespace-only block, Nested value under name or description, Block-scalar agent bytes verbatim.
- [x] 4.2 Run `pnpm run test -- test/domain/catalog/agent.test.ts`; record RED.

## Phase 5: GREEN, `parseAgent`

- [x] 5.1 In `src/domain/catalog/agent.ts`: reword the opaque message to `key 'X' must be a single-line or block scalar (| or >) value`; trim `name`; collapse every `\s+` run in `description` to one space then trim; run required-field and stem checks after decoding; keep `bytes` verbatim; update the doc comment.
- [x] 5.2 Run `pnpm run test -- test/domain/catalog/agent.test.ts`; confirm GREEN.

## Phase 6: Folder-source test

- [x] 6.1 In `test/adapters/catalog/folder-source.test.ts`, add one case: a listed block-scalar agent (`description: >` plus indented lines) loads, `description` is one line with no repeated whitespace, and `bytes` equal the file. Spec (agents-install): Block-scalar agent installs with identical bytes; Single-line description in selection. Expected GREEN immediately (backed by Phases 3 and 5).
- [x] 6.2 Run `pnpm run test` (full suite) and confirm GREEN.

## Phase 7: Quality gate and commit 1

- [x] 7.1 Run `pnpm run format` on touched files and on `openspec/changes/agent-block-scalars/` (Prettier checks OpenSpec files; includes the edited delta specs and this `tasks.md`), then `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`.
- [x] 7.2 Confirm `git diff --stat` touches only `src/domain/catalog/{frontmatter,agent}.ts` and the three test files (no port, application, adapter, or dependency change); commit: `feat(catalog): decode block scalars in agent frontmatter` (Conventional Commits; no Co-Authored-By or AI attribution; no `--no-verify`).

## Phase 8: RED, docs pins

- [x] 8.1 In `test/agents-docs.test.ts`, update pins: remove the `ISSUE` const and the four #238 `tracking issue` pins; add `/block[- ]scalar/i` for README and CONTRIBUTING, `/block scalar/i` for en `security.md`, `/bloque escalar/i` for es `security.md`; add `not.toMatch(/rejected in v1|Limit \(v1\)|se rechazan en la v1/)` across all four docs. Spec: Limit documented.
- [x] 8.2 Run `pnpm run test -- test/agents-docs.test.ts`; record RED.

## Phase 9: GREEN, docs

- [x] 9.1 `README.md` (agents section): state `name` and `description` may be one line or a literal (`|`) or folded (`>`) block scalar with optional chomping and indentation indicator; description shown on one line with whitespace collapsed, file installed verbatim; other multi-line forms for those keys are rejected; remove the "Limit (v1)" paragraph and the #238 link.
- [x] 9.2 `CONTRIBUTING.md` (agents step 2 and validation limits): same rule; keep "not validated" for other keys.
- [x] 9.3 `website/src/content/docs/en/security.md` and `website/src/content/docs/es/security.md`: rewrite first paragraph and the limit bullet the same way ("bloque escalar" in es).
- [x] 9.4 Run `pnpm run test -- test/agents-docs.test.ts`; confirm GREEN.

## Phase 10: Final gate and commit 2

- [x] 10.1 Run `pnpm run format` (covers docs and `openspec/changes/agent-block-scalars/` files, including the delta specs and `tasks.md` check marks).
- [x] 10.2 Run the full gate: `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run test`, `pnpm run build`; all pass.
- [x] 10.3 Commit: `docs: document block scalar support for agents` (README, CONTRIBUTING, website en/es, `test/agents-docs.test.ts`, delta specs under `openspec/changes/agent-block-scalars/specs/`). No Co-Authored-By or AI attribution; no `--no-verify`.
- [x] 10.4 PR-time note (non-blocking): reference issue #238; follow-up if a bundled agent adopts block scalars, `scripts/generate-catalog-table.mjs` and `scripts/generate-website-catalog.mjs` still read `description:` line by line.
