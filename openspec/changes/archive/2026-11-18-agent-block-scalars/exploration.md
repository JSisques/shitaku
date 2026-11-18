# Exploration: block scalars in agent `name` / `description` (issue #238)

## Current state

- `src/domain/catalog/frontmatter.ts` holds `readFrontmatter(text, file, {allowNested})`.
  - `splitBlock()` filters out all blank lines, which would destroy folded paragraph breaks and literal blank lines.
  - `BLOCK_VALUE = /^[|>][+-]?$/` has no indentation indicator and no trailing comment.
  - In nested mode, a key with an empty or block value goes into `opaque` and its indented lines are skipped.
  - In strict mode (skills and commands) the same keys are rejected; existing tests lock those messages.
- `src/domain/catalog/agent.ts` `parseAgent` rejects `front.opaque.includes('name' | 'description')` with `key 'X' must be a single-line value`. `bytes` are already kept verbatim in `AgentItem`.
- Tests: `test/domain/catalog/frontmatter.test.ts` (literal/folded opaque cases will change), `test/domain/catalog/agent.test.ts`, `test/helpers/agents.ts`.
- `test/agents-docs.test.ts` pins `/block[- ]scalar/i` and the #238 URL in README.md and CONTRIBUTING.md, and the #238 URL in `website/src/content/docs/{en,es}/security.md`. Docs and this test must change together.
- Docs stating the limit: README.md (~304, 308), CONTRIBUTING.md (~195, 218), website `en/security.md` (~62, 66), `es/security.md`.
- OpenSpec: v1 limit recorded in archived `catalog-add-agents/design.md`; live specs `openspec/specs/catalog/spec.md` and `openspec/specs/agents-install/spec.md` need a delta.
- Dependencies: only `@clack/prompts`, `commander`, `zod`. No YAML library.
- Architecture guard forbids only Node built-ins and cross-layer imports in domain; a third-party YAML dependency would be legal.
- Description consumers: `program.ts` `list` collapses whitespace (safe); `clack-prompter.ts` uses the raw description as a hint (renders poorly if multi-line); `scripts/generate-catalog-table.mjs` and `scripts/generate-website-catalog.mjs` parse `description:` line by line (out of scope unless a bundled agent uses block scalars).

## Approaches

| Approach                                                             | Pros                                                                                                                                 | Cons                                                                                                                                                                    | Effort                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1. Hand-roll a subset decoder in `frontmatter.ts` (nested mode only) | Zero deps, domain stays pure, strict mode untouched, no regression for opaque YAML (`tools`, `hooks`), narrow documentable semantics | Subset only; folded edge cases need careful tests; ongoing maintenance                                                                                                  | Low-Medium (~250-330 lines) |
| 2. Add the `yaml` dependency                                         | Full YAML correctness                                                                                                                | New runtime dependency and supply-chain surface; whole-block parsing may reject previously tolerated `tools`/`hooks` YAML; fragment parsing still needs hand extraction | Medium, higher risk         |

## Recommendation

Approach 1.

- Header regex: `^[|>](?:[1-9][+-]?|[+-][1-9]?)?(\s+#.*)?$`.
- Content indent: the indicator, else the first non-blank line. The scalar ends at the first non-blank line indented less, or at the next top-level key. Blank lines are kept. CRLF handled. Chomping `-`, `+` or clip. `|` literal, `>` folded.
- Decode block scalars into `data` in nested mode; `opaque` keeps only empty and nested values.
- `parseAgent` trims the decoded value so an empty or whitespace-only block hits the existing `X: frontmatter key is required` rejection. An opaque name/description still errors, reworded.
- `splitBlock` iterates raw lines so blank lines survive, without changing strict-mode output.
- Strict TDD; update docs and `agents-docs.test.ts` pins together.
- Estimated size: src ~60-90, tests ~100-130, docs and pins ~25, delta spec ~40. A single PR under 400 lines is plausible.

## Risks

- `splitBlock` change must not alter strict-mode results.
- Folded-scalar semantics could diverge from the YAML spec; keep to a documented subset and test the edges.
- Multi-line description reaches clack hints unnormalized; decide where to normalize (`parseAgent` or the prompter).
- The two `.mjs` generators ignore block scalars (out of scope, noted).
- `agents-docs.test.ts` pins old docs tokens.
- Tab indentation and a `|` with no content lines must be handled explicitly (empty, then rejected).
- A block-scalar `name` is compared to the stem after decoding and trimming.

## Ready for proposal

Yes. Open decision: where to normalize multi-line descriptions.
