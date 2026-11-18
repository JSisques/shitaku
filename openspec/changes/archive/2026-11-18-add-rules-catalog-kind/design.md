# Design: Installable rules in the catalog (issue #237)

## Technical Approach

Add `rule` as a third **flat-file kind**, next to `command` and `agent`, following the agent change as the precedent (proposal Approach A). A rule is one Markdown file `catalog/rules/<name>.md`, copied byte-for-byte to `<cwd>/.claude/rules/<name>.md` (project scope) or `~/.claude/rules/<name>.md` (user scope), where Claude Code loads it natively.

Every lifecycle concern is reused, not reinvented:

- Parsing: `readFrontmatter(..., { allowNested: true })`, exactly like `parseAgent`.
- Loading: `FolderCatalogSource.loadFileItems('rules', '.md', ...)` (symlink refusal, ghost and unlisted detection).
- Planning: `buildFlatFilePlan` + `classifyOwned` (create / skip / update / conflict, `--force`).
- Apply: `refreshFlatFiles` + `flatFileStep` in `applyPlan` (stale check, byte backup, journal, `createdDirs`).
- Undo: already generic (`undo-install.ts` branches only on `mcp`/`hook`/`skill`/`script`); no code change, only tests.
- Uninstall, status, doctor: the `isFlatFileKind` branches; only the per-kind leaf lookups gain a `rule` case.

The only genuinely new concept is the **recommended starting set**, stored as catalog metadata in `catalog.json` (Decision 2), surfaced to the interactive prompt as preselected values.

## Architecture Decisions

### Decision 1: `rule` is a `FlatFileKind`, copy-per-kind like agents

**Choice**: Extend the `FlatFileKind` union to `'command' | 'agent' | 'rule'`, add `TreeItemSchema.extend({ kind: z.literal('rule') })` to the manifest, `ChangePlan.rules: FlatFileChange[]`, `AgentTarget.rulesDir(scope, paths)`, and per-kind leaves where they exist today. Where a two-way ternary would grow to three (doctor missing code, installed-state desired lookup), replace it with a small `Record<FlatFileKind, ...>` map so the compiler enforces exhaustiveness.
**Alternatives considered**: (a) A generic kind registry / descriptor table that drives every per-kind branch. (b) Managed blocks in `CLAUDE.md`.
**Rationale**: (a) is explicitly out of scope in the proposal and would touch every kind (large, risky diff, collides with #285). (b) needs a new text-merge mechanism on a user-owned file. The flat-file path is proven by commands and agents; `Record<FlatFileKind, ...>` maps are a local hardening that makes the next flat-file kind a compile error instead of a silent miss.

### Decision 2: Recommended set is catalog metadata in `catalog.json`, not a CLI constant

**Choice**: A new optional top-level key in the catalog index:

```json
{
  "version": 1,
  "items": { "rules": ["ask-when-unsure", "..."] },
  "recommended": {
    "rules": ["module-readme", "conventional-commits", "tests-for-changes", "no-secrets", "ask-when-unsure"]
  }
}
```

`CatalogIndexSchema` gains `recommended: z.object({ rules: z.array(RuleNameSchema).default([]) })` with an object default (`{ rules: [] }`; use `.prefault({})` or an explicit `.default({ rules: [] })` per Zod 4 semantics). The folder loader validates every recommended name against the **loaded** rules; an unknown or failed rule becomes a `CatalogIssue` `{ file: 'catalog.json', reason: "recommended rule '<name>' is not a loaded rule" }` and is dropped. The loaded `RuleItem` carries `recommended: boolean`, set by the loader (never read from the rule file).
**Alternatives considered**:

- _CLI constant_ (`RECOMMENDED_RULES` in `program.ts` or `clack-prompter.ts`): couples adapter code to bundled catalog content; with `--source <folder>` a team catalog that happens to have a rule named `no-secrets` with different meaning would be preselected; changing the curation needs a code release.
- _Frontmatter flag_ (`recommended: true` in the rule file): the flag would be copied into `.claude/rules/`, and toggling it changes the file hash, turning every installed copy into `update`/`modified` for a non-content change.
- _A `Catalog.recommendedRules: string[]` field_: equally valid, but it adds a second required `Catalog` field (one more line at every one of ~25 test literals) and an extra prompter argument, while the per-item flag keeps `selectRules(options: RuleItem[])` symmetric with the other `select*` methods.
- _Profiles_: forbidden (`ProfileSchema` / `resolveProfile` untouched; #285 removes profiles).
  **Rationale**: Curation is catalog data, so it lives with the data and follows `--source`. Keyed by kind (`recommended.rules`) leaves room for other kinds without becoming a profile (no names, no `extends`, no resolution). Older shitaku versions strip unknown top-level keys (`z.object` non-strict) and ignore `items.rules` (`looseObject`), so a newer bundled or team catalog stays readable by older CLIs.

### Decision 3: Rule frontmatter shape: `name` + `description` required, `paths` and unknown keys pass through, `check`/`severity` reserved

**Choice**:

```markdown
---
name: no-secrets
description: Never write real secrets or tokens into files, commits or logs.
---

Instruction body (non-empty).
```

- `name` (equals file stem) and `description`: required single-line scalars (same checks as `parseAgent`, including "must be a single-line value" when opaque).
- `paths`: optional, Claude Code's own key; accepted as a scalar or a nested YAML list (opaque in nested mode), bytes untouched.
- Any other key passes through verbatim (no closed allow-list).
- `check` and `severity` are **reserved** for #288: `parseRule` rejects them with `key '<key>' is reserved for rule checks (see #288)`.
- Body must be non-empty after trim.

**Alternatives considered**: (a) Pure passthrough of every key, reservation only in CONTRIBUTING. (b) Closed allow-list (`name`, `description`, `paths`). (c) Defining `check`/`severity` now.
**Rationale**: (b) would break when Claude Code adds rule keys. (c) has no consumer (#226) and risks the wrong shape. (a) lets third-party catalogs ship `severity: high` today, which #288 would then have to accept or break; rejecting the two names now costs ~4 lines and one test, and #288 simply replaces the rejection with real validation. Unknown keys other than these two still pass through, so the proposal's "no closed allow-list" holds.

**Claude Code compatibility (verification status)**: The Claude Code memory docs (code.claude.com/docs/en/memory) document `paths` as the only rule frontmatter field; rules without `paths` load unconditionally, and frontmatter is YAML. This design executor had **no web-fetch tool**, so the page could not be re-read in this phase; the statement relies on the exploration phase's verification (Engram `sdd/add-rules-catalog-kind/explore`, "Verified at code.claude.com/docs/en/memory") plus the general behavior that Claude Code ignores unrecognized frontmatter keys. The docs do **not** state explicitly that `name`/`description` are ignored for rules. This is recorded as an assumption with a mandatory manual smoke check in slice 5 (see Open Questions). Worst case if the assumption fails: Claude Code shows the two frontmatter lines as rule text (a few tokens), not a load failure. Related known gotcha: unquoted `paths` globs starting with `*` or `{` are invalid YAML; CONTRIBUTING must say "quote glob patterns". shitaku's reader does not parse YAML, so it cannot catch this; no seed rule uses `paths`.

### Decision 4: Interactive selection preselects the recommended set; `--rules` stays explicit

**Choice**: `Prompter.selectRules(options: RuleItem[]): Promise<string[]>`, asked only when the catalog has rules and no kind flag was given (same gate as agents). `ClackPrompter` uses `multiselect({ initialValues: options.filter(r => r.recommended).map(r => r.name), required: false })` with the hint `(recommended)` appended for recommended items. Non-interactive install requires explicit `--rules a,b`. No `--rules recommended` alias.
**Alternatives considered**: A `--recommended-rules` flag or a `recommended` sentinel inside `--rules`.
**Rationale**: Decisions are final (`init --rules <names>` + interactive). A sentinel creates a name that cannot be a rule and an extra parse path; it can be added later without breaking anything.

### Decision 5: Prompt order and CLI surface

**Choice**: Rules are asked after agents and before hooks (hooks keep their own consent gate last). `--rules <names>` joins `hasKindFlag`; `--kind rule` joins `uninstall` choices; `LIST_KINDS` gains `rules` (`list rules`); conflict handling adds `kind: 'rule'` to the conflict list and the `keep` sets; `UnknownRuleError` joins `guarded`. The `--source` help text adds "its rules instruct the agent" to the trust warning.
**Alternatives considered**: Rules first (they are the cheapest kind).
**Rationale**: Keeps the existing kind order stable for users and tests; only one insertion point.

### Decision 6: Seed rules stay short and global

**Choice**: Ten seed rules, no `paths`, each file at most 1,500 bytes, enforced by the bundled-catalog test.
**Alternatives considered**: No size guard; `paths` on some seeds.
**Rationale**: Rules without `paths` load every session (proposal risk "context cost"); a byte cap is a cheap, deterministic guard. All ten seeds are cross-cutting behavior rules, so `paths` would be arbitrary.

## Data Flow

Install (`init --rules no-secrets --scope project --yes`, or interactive):

```
catalog/catalog.json ──► CatalogIndexSchema (items.rules, recommended.rules)
catalog/rules/*.md ───► FolderCatalogSource.loadFileItems ──► parseRule ──► RuleItem{name,description,bytes,recommended}
                                                                                │
program.runInit ── opts.rules ?? prompter.selectRules(catalog.rules) ◄─────────┘
        │
        ▼
planInit ── UnknownRuleError? ── flatFileEntries(target.rulesDir(scope)) ── buildFlatFilePlan(owned=deriveRuleOwnership, noun='rule')
        │                                                                          │
        ▼                                                                          ▼
conflicts (kind 'rule') ── resolve / --force / exit 2                        ChangePlan.rules
        │
        ▼
applyPlan ── refreshFlatFiles('rule') ── flatFileStep('rule') ── backup ── writeBytes ── journal(manifest kind 'rule', root = file path)
```

Lifecycle after install:

```
manifest ── deriveOwnedItems ──► status/doctor (isFlatFileKind → observeFile; desiredFor rule → sha256(rule.bytes); rule-missing)
         ──► uninstall (expectedPath = rulesDir/<name>.md; isFlatFileKind path)
         ──► undo (generic byte restore; createdDirs removes an emptied .claude/rules)
```

## File Changes

| File                                                                                                     | Action             | Description                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/catalog/rule.ts`                                                                             | Create             | `RuleNameSchema`, `RuleItem`, `parseRule(stem, bytes)` (nested frontmatter, reserved keys, non-empty body).                                                                                                         |
| `src/domain/catalog/schema.ts`                                                                           | Modify             | `items.rules` (default `[]`), top-level `recommended.rules`, `Catalog.rules: RuleItem[]`. No `ProfileSchema` change.                                                                                                |
| `src/domain/catalog/listing.ts`                                                                          | Modify             | `LIST_KINDS` + `rules`, `EntryKind` + `rule`, `ENTRY_KIND.rules`, rules in `listEntries`.                                                                                                                           |
| `src/adapters/catalog/folder-source.ts`                                                                  | Modify             | `loadRules` via `loadFileItems('rules', '.md')`, recommended validation + flag, `rules` in returned catalog. `known` for profiles unchanged.                                                                        |
| `src/domain/manifest.ts`                                                                                 | Modify             | Manifest item kind `rule`; `FlatFileKind`/`isFlatFileKind` + `rule`; `deriveTreeOwnership` kind union; `deriveRuleOwnership`; `OwnedItem.kind` + `rule`; refine message. Manifest `version` stays 1.                |
| `src/domain/plan/change-plan.ts`                                                                         | Modify             | `ChangePlan.rules: FlatFileChange[]`; `buildPlan` returns `rules: []`.                                                                                                                                              |
| `src/domain/plan/flat-file-plan.ts`                                                                      | Modify             | Doc comment only ("a command, agent or rule").                                                                                                                                                                      |
| `src/domain/plan/doctor-plan.ts`                                                                         | Modify             | `DoctorCode` + `rule-missing`; `MISSING_CODE: Record<FlatFileKind, DoctorCode>` replaces the ternary.                                                                                                               |
| `src/ports/agent-target.ts`                                                                              | Modify             | `rulesDir(scope, paths)`.                                                                                                                                                                                           |
| `src/ports/prompter.ts`                                                                                  | Modify             | `ConflictInfo.kind` + `rule`; `selectRules(options: RuleItem[])`.                                                                                                                                                   |
| `src/adapters/claude-code/target.ts`                                                                     | Modify             | `rulesDir` → `<home                                                                                                                                                                                                 | cwd>/.claude/rules`. |
| `src/application/init-mcps.ts`                                                                           | Modify             | `InitRequest.rules`, `UnknownRuleError`, plan rules, `planMcps` empty plan `rules: []`, refresh + steps + empty-check include rules.                                                                                |
| `src/application/uninstall-item.ts`                                                                      | Modify             | `expectedPath` rule branch; doc comment.                                                                                                                                                                            |
| `src/application/installed-state.ts`                                                                     | Modify             | `desiredFor` rule lookup (flat-file `Record<FlatFileKind, ...>` lookup over `commands`/`agents`/`rules`).                                                                                                           |
| `src/adapters/cli/program.ts`                                                                            | Modify             | `--rules`, `hasKindFlag`, selection, conflict list + `keep.rule`, `printPlan`, hook-decline empty check, `--kind rule`, `UninstallOptions.kind` → `OwnedItem['kind']`, `UnknownRuleError` in `guarded`, help texts. |
| `src/adapters/cli/clack-prompter.ts`                                                                     | Modify             | `selectRules` with `initialValues`, `CONFLICT_LABELS.rule`, `confirm` counts `plan.rules`.                                                                                                                          |
| `catalog/catalog.json`                                                                                   | Modify             | `items.rules` (10 names), `recommended.rules` (5 names).                                                                                                                                                            |
| `catalog/rules/*.md`                                                                                     | Create             | 10 seed rules: `naming`, `small-changes`, `explain-why`, `no-new-deps`, `error-handling`, `ask-when-unsure`, `module-readme`, `conventional-commits`, `tests-for-changes`, `no-secrets`.                            |
| `scripts/generate-catalog-table.mjs`                                                                     | Modify             | `rules` section, noun, describer.                                                                                                                                                                                   |
| `scripts/generate-website-catalog.mjs`                                                                   | Modify             | `generatedKinds` + `rules`, `renderRule` + `RULE_USAGE` (en/es).                                                                                                                                                    |
| `website/src/content/docs/{en,es}/catalog/rules/*.md`                                                    | Create (generated) | One page per seed rule (sidebar is autogenerated).                                                                                                                                                                  |
| `README.md`                                                                                              | Modify             | `<!-- catalog:rules:start/end -->` markers + table, `init --rules`, `--kind rule`, kind-list sentences, downgrade note includes rules.                                                                              |
| `CONTRIBUTING.md`                                                                                        | Modify             | "Adding to the catalog: rules" (frontmatter, reserved keys, quote `paths` globs, size cap, `recommended.rules`).                                                                                                    |
| `website/src/content/docs/{en,es}/cli/{commands,flags}.md`, `.../catalog/overview.md`, `.../security.md` | Modify             | `--rules`, `--kind rule`, rules in overview, trust note for `--source`.                                                                                                                                             |
| `test/domain/catalog/rule.test.ts`                                                                       | Create             | `parseRule` cases.                                                                                                                                                                                                  |
| `test/helpers/rules.ts`                                                                                  | Create             | `ruleBytes`/`ruleItem` fixtures, mirroring `test/helpers/agents.ts`.                                                                                                                                                |
| Existing tests building `Catalog`/`ChangePlan` literals (~25 sites)                                      | Modify             | Add `rules: []`.                                                                                                                                                                                                    |
| `test/agents-docs.test.ts` (or new `test/rules-docs.test.ts`)                                            | Modify/Create      | Stable doc tokens for rules (`--rules`, `--kind rule`, downgrade note).                                                                                                                                             |

## Interfaces / Contracts

```ts
// src/domain/catalog/rule.ts
export const RuleNameSchema = z
  .string()
  .regex(NAME_PATTERN, { error: (iss) => `invalid rule name '${String(iss.input)}'` });

/** An instruction rule: one markdown file. `bytes` are copied verbatim, so `paths:` and unknown keys reach Claude Code. */
export interface RuleItem {
  name: string;
  description: string;
  bytes: Uint8Array;
  /** Set by the catalog loader from `catalog.json` `recommended.rules`; never read from the file. */
  recommended: boolean;
}

export type RuleParseResult = { rule: RuleItem } | { issue: string };
/** Rejected until #288 defines them. */
export const RESERVED_RULE_KEYS = ['check', 'severity'] as const;
export function parseRule(stem: string, bytes: Uint8Array): RuleParseResult; // returns recommended: false

// src/domain/catalog/schema.ts
CatalogIndexSchema = z.object({
  version: z.literal(1),
  items: z.looseObject({ /* ...existing */ rules: z.array(RuleNameSchema).default([]) }),
  recommended: z.object({ rules: z.array(RuleNameSchema).default([]) }).prefault({}),
});
export interface Catalog { /* ...existing */ rules: RuleItem[] }

// src/domain/manifest.ts
export type FlatFileKind = 'command' | 'agent' | 'rule';
export function deriveRuleOwnership(manifest: Manifest): Record<string, string>;

// src/ports/agent-target.ts
/** Directory that holds one flat `.md` file per installed rule. */
rulesDir(scope: Scope, paths: Paths): string;

// src/ports/prompter.ts
/** Only asked when the catalog has rules. Recommended rules start selected. May return an empty selection. */
selectRules(options: RuleItem[]): Promise<string[]>;

// src/domain/plan/doctor-plan.ts
const MISSING_CODE: Record<FlatFileKind, DoctorCode> = {
  command: 'command-missing',
  agent: 'agent-missing',
  rule: 'rule-missing',
};
```

`status --json`, `doctor --json` and `list --json` gain the value `rule` / `rule-missing` in existing string fields: additive, document versions unchanged.

## Grep Checklist (per-kind branches to touch)

Run each from the worktree root with `rg`; every hit must either gain a `rule` case or be justified as generic. TypeScript exhaustiveness covers `Record<...>` maps and discriminated unions, but not ternaries, arrays of names, or prose.

| Pattern                                                                                                          | Expected hits to review                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rg -n "'agent'" src scripts`                                                                                    | manifest union/refine, `isFlatFileKind`, doctor code, installed-state, uninstall `expectedPath`, program conflicts/`--kind`, prompter `ConflictInfo`                                                                  |
| `rg -n "\bagents\b" src scripts`                                                                                 | `ChangePlan.agents`, `Catalog.agents`, `InitRequest.agents`, `planMcps`/`buildPlan` empty plans, apply sum, `printPlan`, `confirm` count, hook-decline empty check, `CatalogIndexSchema`, listing, loader, generators |
| `rg -n "Agent(Item\|Error\|Ownership\|sDir\|NameSchema)" src`                                                    | `RuleItem`, `UnknownRuleError` (+ `guarded`), `deriveRuleOwnership`, `rulesDir`, `RuleNameSchema`                                                                                                                     |
| `rg -n "selectAgents" src test`                                                                                  | port, clack, program, every fake prompter in tests                                                                                                                                                                    |
| `rg -n "isFlatFileKind\|FlatFileKind" src`                                                                       | confirm all flat-file branches cover `rule` (installed-state, uninstall, doctor, init refresh)                                                                                                                        |
| `rg -n "plan\.(commands\|agents)\.length" src`                                                                   | apply empty check, hook-decline abort, clack `confirm`                                                                                                                                                                |
| `rg -n "agent-missing" src test website README.md`                                                               | add `rule-missing` alongside                                                                                                                                                                                          |
| `rg -n "commands, agents and hooks\|command, agent or hook\|--agents" README.md CONTRIBUTING.md website/src src` | help texts and docs sentences                                                                                                                                                                                         |
| `rg -n "catalog:agents" README.md scripts`                                                                       | add `catalog:rules` markers                                                                                                                                                                                           |
| `rg -n "agents: \[\]" src test`                                                                                  | add `rules: []` to every `Catalog`/`ChangePlan` literal                                                                                                                                                               |
| `rg -n "ProfileSchema\|resolveProfile" src`                                                                      | must show **no** diff (guard against touching profiles)                                                                                                                                                               |
| `rg -n "CLAUDE\.md" src`                                                                                         | must stay empty                                                                                                                                                                                                       |

## Testing Strategy

Strict TDD (`pnpm test`): each behavior starts with a failing test in the mirrored path.

| Layer                    | What to Test                                                                                                                                                                                                                               | Approach                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Unit (domain)            | `parseRule`: valid; name != stem; missing/empty/opaque `name`/`description`; empty body; nested `paths` list accepted; scalar `paths` accepted; unknown key passes through with bytes identical; `check`/`severity` rejected; invalid stem | `test/domain/catalog/rule.test.ts` with byte fixtures             |
| Unit (domain)            | `CatalogIndexSchema` default `rules: []`, `recommended` default, invalid rule name                                                                                                                                                         | `test/domain/catalog/schema.test.ts`                              |
| Unit (domain)            | listing kind `rule`, `list rules` filter, sort                                                                                                                                                                                             | `test/domain/catalog/listing.test.ts`                             |
| Unit (domain)            | manifest accepts `kind: 'rule'` with null `afterHash`; `deriveRuleOwnership`; `deriveOwnedItems` path = root; `isFlatFileKind('rule')`                                                                                                     | `test/domain/manifest.test.ts`                                    |
| Unit (domain)            | doctor `rule-missing` for absent owned rule; edited rule → `modified` info                                                                                                                                                                 | `test/domain/plan/doctor-plan.test.ts`                            |
| Adapter                  | loader: listed rule loads, missing file issue, unlisted `.md` issue, symlink refused, recommended flag set, unknown recommended name → issue                                                                                               | `test/adapters/catalog/folder-source.test.ts` (temp catalog dirs) |
| Adapter                  | `rulesDir` project/user                                                                                                                                                                                                                    | `test/adapters/claude-code/target.test.ts`                        |
| Adapter                  | clack `selectRules` passes `initialValues` of recommended names                                                                                                                                                                            | `test/adapters/cli/clack-prompter.test.ts` (existing clack mock)  |
| Application              | plan create/skip/update/conflict/`--force`; unknown rule error; stale file abort; apply writes byte-identical file and journals `kind: 'rule'`                                                                                             | `test/application/init-mcps.test.ts` (memory fs)                  |
| Application (round trip) | init rule → status `ok` → edit → status `modified` → uninstall refused (exit 3) → `--force` uninstall → undo restores → undo of install removes file and empty `.claude/rules`                                                             | `test/application/{uninstall-item,undo-install,status}.test.ts`   |
| CLI                      | `--rules` non-interactive project + user scope; exit 2 on conflict; `--kind rule`; interactive path calls `selectRules` only when catalog has rules; kind flag skips it; `list rules`                                                      | `test/adapters/cli/program.test.ts` with fake prompter            |
| Catalog data             | 10 seeds listed and loaded, no issues; `recommended.rules` = the five; each seed ≤ 1,500 bytes, no `paths`, frontmatter exactly `name` + `description`                                                                                     | `test/adapters/catalog/bundled-catalog.test.ts`                   |
| Docs                     | README table up to date (`docs:catalog --check`), website pages generated, doc tokens                                                                                                                                                      | `test/generators.test.ts`, docs token test                        |
| Guards                   | architecture/naming unchanged rules (`rule.ts` in domain uses no fs)                                                                                                                                                                       | existing `test/architecture.test.ts`, `test/naming.test.ts`       |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Rules are inert Markdown copied byte-for-byte; they influence the agent only as instructions. The one trust consideration (a `--source` catalog can ship instructions that steer the agent) is handled as documentation: the `--source` help text and `security.md` gain "its rules instruct the agent".

## Migration / Rollout

No data migration: manifest `version` stays 1; the new item kind is additive. Older shitaku versions throw `ManifestError` on a manifest containing `kind: 'rule'` (same as hooks/agents): README downgrade note says to `uninstall`/`undo` rules before downgrading. Older versions reading a newer catalog ignore `items.rules` and `recommended`.

Delivery as five chained PRs (delivery strategy `ask-on-risk`, 400-line budget), aligned with the proposal:

| PR  | Slice                        | Contents                                                                                                                                                                                                         | Inert until                                                               |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Domain catalog               | `rule.ts`, schema (`items.rules`, `recommended`), `Catalog.rules`, listing, folder loader + recommended validation, `rules: []` in test catalog literals, `test/helpers/rules.ts`                                | `list rules` works with a `--source` catalog; bundled catalog still empty |
| 2   | Manifest + plan              | manifest kind/`FlatFileKind`/`deriveRuleOwnership`/`OwnedItem`, `ChangePlan.rules`, `rulesDir` (port + Claude target), `InitRequest.rules`, `UnknownRuleError`, `planInit` rules, `rules: []` in plan literals   | Plan computed, never applied (no CLI flag)                                |
| 3   | Apply + lifecycle            | `applyPlan` refresh/steps/empty check, uninstall `expectedPath`, installed-state `desiredFor`, doctor `rule-missing` map, round-trip tests (undo/uninstall/status)                                               | Reachable only from the application API                                   |
| 4   | Seed rules + docs generators | 10 `catalog/rules/*.md`, `catalog.json` (`items.rules`, `recommended.rules`), bundled-catalog test, both generators, README `catalog:rules` markers + generated table, generated website pages                   | `list` shows rules; install still not exposed in CLI                      |
| 5   | CLI + user docs              | `--rules`, `hasKindFlag`, `selectRules` (port, clack, fakes), conflicts, `printPlan`, `--kind rule`, `guarded`, help texts, README/CONTRIBUTING/website CLI docs, doc token test, manual Claude Code smoke check | Feature live                                                              |

Each PR targets the previous slice branch (Feature Branch Chain) or `main` in order (stacked-to-main); the choice is the orchestrator's cached delivery decision. Reverting PR 5 hides the feature; reverting 4 removes the data; 1–3 are inert without 5.

## Open Questions

- [ ] **Validate in slice 5 (non-blocking)**: install one seed rule with `name`/`description` frontmatter into a scratch project, start Claude Code, and confirm via `/memory` that the rule is listed and loaded without error; also confirm a rule with a quoted `paths:` list loads conditionally. If Claude Code rejects or misreads the extra keys, fall back to keeping `name`/`description` only in `catalog.json` metadata (a breaking change to the rule file contract, so it must be decided before release).
- [ ] Whether README/website should mark recommended rules visually (e.g. a "Recommended" column). Not required by the proposal; default is no.
