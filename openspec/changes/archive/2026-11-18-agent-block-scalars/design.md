# Design: Block scalars in agent `name` and `description` (#238)

## Technical Approach

Extend the hand-rolled frontmatter reader with a narrow block-scalar decoder that runs only in `allowNested` mode (agents). A top-level key whose value is a block-scalar header (`|` or `>`, optional chomping and indentation indicators, optional comment) is decoded into `data`; `opaque` keeps only keys with an empty value (nested mapping, list, or nothing). `splitBlock` returns raw lines so blank lines reach the decoder; the main loop skips blank lines itself, so strict mode (skills, commands) produces byte-identical results. `parseAgent` owns semantic cleanup: trim, collapse whitespace in `description`, required-field and stem checks after decoding, and a reworded rejection for opaque `name`/`description`. Agent `bytes` stay verbatim. Domain layer only; no port, application, adapter, or dependency change.

## Architecture Decisions

| #   | Topic                       | Choice                                                                                                                                                     | Rejected                                                                   | Rationale                                                                                                                                                                      |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a   | Decoder                     | Hand-rolled, inside `src/domain/catalog/frontmatter.ts`, active only with `allowNested: true`                                                              | `yaml` package                                                             | Already decided. Zero new dependency, domain stays pure, opaque `tools`/`hooks` keep their tolerant pass-through (a full parser could reject YAML that loads today)            |
| b   | Strict mode                 | Unchanged. Strict mode keeps the legacy `BLOCK_VALUE = /^[\|>][+-]?$/` test and its messages. The new `BLOCK_HEADER` regex is used only in nested mode     | One shared header regex for both modes                                     | `description: \|2` or `description: \| # c` is a plain scalar in strict mode today; switching the regex would turn it into a rejection for skills and commands                 |
| c   | Line model                  | `splitBlock` returns every raw line (split on `/\r?\n/`). The main loop skips a blank line (`line.trim() === ''`) whenever it is not inside a block scalar | Keep the filter and re-split for nested mode; two readers                  | One loop, one source of truth. Skipping blanks at the top of the loop is equivalent to the old `filter`, so strict output cannot change                                        |
| d   | Result shape                | No type change. Decoded values go into `data: Record<string, string>`; `opaque: string[]` keeps only keys with an empty value. Doc comments updated        | A new `blocks` list; a tagged value type                                   | The only nested-mode consumer is `parseAgent`, which needs a string. A tag would add surface without a caller                                                                  |
| e   | Folding                     | YAML 1.2 folding for `>`, including blank-line paragraph breaks and kept breaks around more-indented lines (the js-yaml algorithm, section "Folding")      | Join every line with a space; ignore more-indented lines                   | Small extra cost (a flag and a counter) buys spec-faithful values; the reader is generic, not agent-specific, so it must not encode display policy                             |
| f   | Normalization               | In `parseAgent`: `name` is trimmed; `description` has every `\s+` run collapsed to one space, then is trimmed. Applies to single-line descriptions too     | Normalize in `clack-prompter.ts` and `program.ts`; normalize in the reader | Already decided. One place, every consumer (clack hint, `list`, JSON) gets one line. The reader returns faithful values                                                        |
| g   | Opaque `name`/`description` | Still rejected, reworded: `key 'X' must be a single-line or block scalar (\| or >) value`                                                                  | Keep `must be a single-line value`                                         | The old wording is now false (block scalars are accepted). `opaque` covers both an empty value and a nested value, so the message names the accepted forms instead of guessing |
| h   | Tabs                        | A non-blank line inside a block scalar whose indentation (before the content indent is reached) starts with a tab is an issue                              | Count a tab as N spaces; treat it as a terminator                          | YAML forbids tabs for indentation. An explicit issue beats a silently wrong value or a confusing "no owning key" error                                                         |

## Supported YAML Subset (nested mode only)

### Header

```ts
const BLOCK_HEADER = /^([|>])(?:([1-9])([+-])?|([+-])([1-9])?)?(?:\s+#.*)?$/;
```

Matched against the value after the colon, already trimmed (as today).

| Value                                  | Result                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `\|`, `>`                              | Literal or folded, clip chomping, auto-detected indent                             |
| `\|-`, `>+`                            | Strip or keep chomping                                                             |
| `\|2`, `>4`                            | Indentation indicator: content indent = 0 (top-level parent) + digit               |
| `\|2-`, `>-2`                          | Indicator and chomping in either order                                             |
| `\| # note`                            | Header with comment (whitespace before `#` required)                               |
| `\|#x`, `\|0`, `\|++`, `\|-2-`, `"\|"` | Not a header: a plain single-line scalar, unchanged from today (`unquote` applies) |

### Content indent and termination

- Explicit indicator `n`: content indent is `n`.
- Otherwise: the leading-space count of the first non-blank line after the header. If that count is 0, the block has no content lines; that line is not consumed and is processed by the main loop.
- Leading spaces are counted with `/^ */`. For a non-blank line with fewer spaces than the content indent: if the next character is a tab, return the tab issue (decision h); otherwise the scalar ends and the line is handed back to the main loop. Top-level keys (indent 0) therefore always terminate the block.
- A line indented by more than 0 but less than the content indent terminates the block and then hits the existing `indented line with no owning key` issue in the main loop, because a block scalar never owns lines (`owner = false` after it).
- The end of the frontmatter block terminates the scalar.
- A content line is `line.slice(indent)`; trailing spaces and characters such as `#` inside content are kept verbatim (comments are only recognized on the header).
- A blank line is `line.trim() === ''` and contributes an empty line regardless of its spaces. (Deviation from YAML, which keeps spaces beyond the indent on whitespace-only literal lines; documented in the code comment. Irrelevant after `parseAgent` normalization.)
- CRLF: lines are already split on `/\r?\n/`; decoded values always use `\n`.

### Folding and chomping (decision e)

Iterate content lines with `emptyLines = 0`, `didReadContent = false`, `atMoreIndented = false`:

- Blank line: `emptyLines++`.
- Content line, literal (`|`): append `'\n'.repeat(didReadContent ? 1 + emptyLines : emptyLines)`.
- Content line, folded (`>`):
  - more-indented (first char after the indent is a space or tab): `atMoreIndented = true`; append `'\n'.repeat(didReadContent ? 1 + emptyLines : emptyLines)`.
  - else if `atMoreIndented`: `atMoreIndented = false`; append `'\n'.repeat(emptyLines + 1)`.
  - else if `emptyLines === 0`: append `' '` when `didReadContent`.
  - else: append `'\n'.repeat(emptyLines)`.
- Then append the content, set `didReadContent = true`, `emptyLines = 0`.
- At the end, chomping: strip adds nothing; clip adds `'\n'` when `didReadContent`; keep adds `'\n'.repeat(didReadContent ? 1 + emptyLines : emptyLines)`.

Trailing blank lines between the block and the next key belong to the block (YAML semantics) and are subject to chomping. A header with no content lines decodes to `''` (strip/clip) or to `'\n'` repeated per blank line (keep); both are whitespace-only and become a required-field rejection in `parseAgent`.

### Worked examples (become unit tests)

| Frontmatter lines after `description: ` | Decoded `data.description`     |
| --------------------------------------- | ------------------------------ |
| `\|` / `  line one` / `  line two`      | `'line one\nline two\n'`       |
| `>-` / `  folded` / `  text`            | `'folded text'`                |
| `>` / `  a` / `  b` / `` / `  c`        | `'a b\nc\n'`                   |
| `>` / `  a` / `    code` / `  b`        | `'a\n  code\nb\n'`             |
| `\|+` / `  a` / `` then next key        | `'a\n\n'`                      |
| `\|-` / `  a` / `` then next key        | `'a'`                          |
| `\|2` / `    lead` / `  b`              | `'  lead\nb\n'`                |
| `\|` / `  a` / `` / `  b`               | `'a\n\nb\n'`                   |
| `\| # note` / `  a`                     | `'a\n'`                        |
| `\|` then next key                      | `''` (in `data`, not `opaque`) |

## Data Flow

    agents/x.md bytes ──→ parseAgent ──→ readFrontmatter(allowNested)
                                            │ splitBlock: raw lines
                                            │ loop: skip blank │ key: value
                                            │   value ''        → opaque (owns indented + blank lines)
                                            │   BLOCK_HEADER    → readBlockScalar → data[key]
                                            │   otherwise       → data[key] = unquote(value)
                          ◀── { data, opaque, body } | issue
                 parseAgent: opaque name/description → reworded issue
                             trim → required check → name === stem → body check
                             description: collapse \s+ → trim
                 AgentItem { name, description (one line), bytes (verbatim) }

Strict mode: same loop, blank lines skipped, legacy `BLOCK_VALUE`, no decoder reachable.

## File Changes

| File                                           | Action | Description                                                                                                                                           |
| ---------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/catalog/frontmatter.ts`            | Modify | Raw-line `splitBlock`; index-based loop skipping blanks; `BLOCK_HEADER`, `parseHeader`, `readBlockScalar` (fold + chomp) in nested mode; doc comments |
| `src/domain/catalog/agent.ts`                  | Modify | Reworded opaque message; `description` whitespace collapse; doc comment                                                                               |
| `test/domain/catalog/frontmatter.test.ts`      | Modify | Literal/folded rows leave the opaque table; new decode table; tab/termination/no-content cases; strict-mode regressions                               |
| `test/domain/catalog/agent.test.ts`            | Modify | Block-scalar name/description, normalization, empty block, stem mismatch, reworded opaque message, verbatim bytes                                     |
| `test/adapters/catalog/folder-source.test.ts`  | Modify | One case: a block-scalar agent loads with a one-line description and verbatim bytes (backs the `agents-install` scenario)                             |
| `test/agents-docs.test.ts`                     | Modify | Pins for block-scalar support in all four docs; drop the #238 "tracking issue" pins; negative pin for the old v1 limit text                           |
| `README.md`, `CONTRIBUTING.md`                 | Modify | Replace the v1 limit with the supported subset and the remaining limit                                                                                |
| `website/src/content/docs/{en,es}/security.md` | Modify | Same, en and es                                                                                                                                       |
| `test/helpers/agents.ts`                       | None   | `agentBytes(name, extra)` cannot replace the `description:` line; tests build block-scalar text inline with `enc`                                     |

## Interfaces / Contracts

```ts
// frontmatter.ts (internal, not exported)
const BLOCK_VALUE = /^[|>][+-]?$/; // strict mode only, unchanged
const BLOCK_HEADER = /^([|>])(?:([1-9])([+-])?|([+-])([1-9])?)?(?:\s+#.*)?$/;
type Chomp = 'strip' | 'clip' | 'keep';
interface BlockHeader {
  folded: boolean;
  chomp: Chomp;
  indent: number | undefined;
}
const parseHeader = (value: string): BlockHeader | undefined => {
  /* ... */
};
/** Reads lines from `start`; `next` is the index of the first line not consumed. */
const readBlockScalar = (
  lines: readonly string[],
  start: number,
  header: BlockHeader,
  key: string,
): { value: string; next: number } | { issue: string } => {
  /* ... */
};

// Public types unchanged:
export type NestedFrontmatterResult =
  { data: Record<string, string>; opaque: string[]; body: string } | FrontmatterIssue;
```

New issue (nested mode only): `frontmatter key 'X' has a block scalar indented with a tab` (with `file`).

`parseAgent` messages: `key 'X' must be a single-line or block scalar (| or >) value` replaces `key 'X' must be a single-line value`. `X: frontmatter key is required` and `frontmatter name 'N' must equal the file name 'S'` are unchanged and now also apply to decoded values.

Behavior change outside block scalars: a single-line agent `description` with internal whitespace runs (for example `"a   b"`) is now `'a b'`. Install bytes are unaffected.

## Testing Strategy (strict TDD, RED first)

| Layer   | RED tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit    | `frontmatter` nested: `it.each` over the worked-examples table (asserting `data` and `opaque: []` for the key); `\|2-` and `\|-2` equivalence; CRLF block decodes with `\n`; header with no content (next key follows, and end of block); tab as first content indent and tab after content started both give the tab issue; less-indented line after a block gives the `no owning key` issue; `#` content line kept; `\|#x` and `\|0` stay plain scalars; opaque table keeps `tools`, `mcpServers`, empty value (literal/folded rows removed) |
| Unit    | `frontmatter` strict regressions (must pass before and after; written first to lock behavior): blank and whitespace-only lines between keys ignored; `description: \|2` and `description: \| # c` stay plain scalars; `description: >` with an indented line keeps the multi-line-or-empty message; a blank line followed by an indented line keeps the multi-line message. Existing strict tests unchanged                                                                                                                                    |
| Unit    | `parseAgent`: folded multi-paragraph description becomes one line; literal with `-`, `+`, and indicator becomes one line; single-line `"a   b"` becomes `'a b'`; block `name` equal to the stem loads; block `name` `other` gives the stem message; empty block and whitespace-only `\|+` block give `description: frontmatter key is required`; nested `name`/`description` give the reworded message; bytes `toBe` the input                                                                                                                 |
| Adapter | `folder-source`: a listed block-scalar agent loads, `description` is one line, `bytes` equal the file                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Repo    | `agents-docs.test.ts`: `/block[- ]scalar/i` in README and CONTRIBUTING (kept), `/block scalar/i` in en `security.md`, `/bloque escalar/i` in es `security.md`; `not.toMatch(/rejected in v1\|Limit \(v1\)\|se rechazan en la v1/)` across all four; #238 URL pins and the `ISSUE` const removed                                                                                                                                                                                                                                                |

RED order: strict regressions (green immediately; they guard the refactor), then nested decode table (RED), implement decoder (GREEN), then `parseAgent` cases (RED), implement (GREEN), then folder-source case. Docs pins go RED first in commit 2, then docs make them GREEN.

## Docs Content

- README (agents section): `name` and `description` may be on one line or a literal (`|`) or folded (`>`) block scalar, with optional chomping (`-`, `+`) and indentation indicator. shitaku shows the description on one line with whitespace collapsed; the file is installed verbatim. Other multi-line forms for these two keys (nested values, multi-line plain or quoted scalars) are rejected. Remove the "Limit (v1)" paragraph and the #238 link.
- CONTRIBUTING (agents step 2 and validation limits): same rule; keep "not validated" for other keys.
- `website/.../en/security.md` and `es/security.md`: first paragraph and the limit bullet rewritten the same way ("bloque escalar" in es).

## Commits and Budget

1. `feat(catalog): decode block scalars in agent frontmatter`: `frontmatter.ts`, `agent.ts`, frontmatter/agent/folder-source tests.
2. `docs: document block scalar support for agents`: README, CONTRIBUTING, website en/es, `agents-docs.test.ts` pins, and the change's OpenSpec delta specs.

Estimate (additions plus deletions): src ~75-100 (decoder ~60-80, loop refactor ~10, `parseAgent` ~5), tests ~150-190, docs and pins ~35-45, delta specs ~40-60. Total ~300-395: inside the 400-line budget but with little slack. 400-line budget risk: Medium. If tests overrun, compact them with `it.each` tables rather than dropping cases; if the PR still exceeds 400, split commit 2 into a second PR.

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Pure string decoding in the domain layer over bounded catalog files (`MAX_FILE_BYTES`); the decoder is linear in line count.

## Migration / Rollout

No migration. Installed bytes, manifest, and plans are unchanged. Catalogs that adopt block scalars fail to load those agents on older shitaku versions (per-item issue, other items unaffected).

## Open Questions

- [ ] The reworded opaque message and the tab issue text must match the parallel `catalog` delta spec; reconcile in `sdd-tasks` if the spec chose different wording.
- [ ] Whether OpenSpec planning files (proposal, exploration, design, tasks) count toward the 400-line budget; this estimate counts only src, tests, docs, pins, and delta specs.
- [ ] `scripts/generate-catalog-table.mjs` and `scripts/generate-website-catalog.mjs` still read `description:` line by line and would print the header (`>`) for a block-scalar agent. Out of scope; follow-up if a bundled agent adopts block scalars.
