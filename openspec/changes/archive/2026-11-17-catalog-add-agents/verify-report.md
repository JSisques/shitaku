# Verify Report: catalog-add-agents (#42)

Branch `feat/agents-8-cli` (stacked PRs 1-8 vs origin/main). No source, test or doc file was modified by this verification.

## Verdict: PASS WITH WARNINGS

No critical issues. One stale documentation sentence that contradicts shipped behavior (WARNING) and a few test-coverage gaps (WARNING/SUGGESTION).

## 1. Tasks

`tasks.md`: 54 checkboxes, 54 `[x]`, 0 unchecked.

## 5. Command results

| Command                               | Result                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm run typecheck`                  | exit 0                                                                                  |
| `pnpm run lint`                       | exit 0                                                                                  |
| `pnpm run format:check`               | exit 0 (all files formatted)                                                            |
| `pnpm run docs:catalog:check`         | exit 0 (README tables up to date)                                                       |
| `pnpm run docs:website-catalog:check` | exit 0 (website pages up to date)                                                       |
| `pnpm run test`                       | 59 files, 1445 tests passed, ~86s (includes `test/architecture.test.ts`, `test/naming`) |
| `pnpm run build`                      | exit 0, `check-dist-aliases: 58 files clean`                                            |
| `pnpm run test:coverage`              | NOT RUN: `@vitest/coverage-v8` not installed locally (coverage gate unverified)         |

Only noise: pnpm "Unsupported engine" warning (node 26.7.0 vs wanted 26.10.0).

## 2. Spec compliance matrix

Legend: COVERED = test and source found and read. Paths are under `test/` and `src/`.

### agents-install

| Scenario                                                    | Status  | Test evidence                                                                                                                                                                                                                                                                    | Source                                        |
| ----------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| User and project roots                                      | COVERED | `adapters/claude-code/target.test.ts` "puts agents under ~/.claude/agents..."; init-mcps agents describe; e2e                                                                                                                                                                    | `claude-code/target.ts` `agentsDir`           |
| Nested frontmatter verbatim                                 | COVERED | `domain/catalog/agent.test.ts` "accepts nested YAML...preserving bytes verbatim"; e2e `cmp` identical                                                                                                                                                                            | `agent.ts` returns original `bytes`           |
| Unrelated agents untouched                                  | COVERED | `application/init-mcps.test.ts` "leaves a user-authored neighbor untouched"                                                                                                                                                                                                      | `buildFlatFilePlan`, per-file writes          |
| Create / Skip / Owned update                                | COVERED | `domain/plan/flat-file-plan.test.ts` "names the agent noun...create/skip/update"; init-mcps "skips a byte-identical file without journaling", "updates an owned agent that is unmodified"                                                                                        | `init-mcps.ts` plan + `deriveAgentOwnership`  |
| Unmanaged different / Owned-edited / Force                  | COVERED | init-mcps "words a conflict with the noun agent", "refuses to overwrite...", "replaces a user file with --force after a byte-identical backup"                                                                                                                                   | `classifyOwned`, noun `'agent'`               |
| Conflict refused (exit 2)                                   | COVERED | `adapters/cli/program.test.ts` "exits 2 on a non-interactive agent conflict"; e2e exit 2                                                                                                                                                                                         | program.ts                                    |
| Interactive conflict choice                                 | PARTIAL | skip path: program.test "resolves an interactive agent conflict with the agent kind". Overwrite path for agents has no CLI-level test (command and skill have one); shared code at program.ts ~286-302, wording covered in `clack-prompter.test.ts` "words an agent conflict..." | program.ts                                    |
| Forced replace with backup                                  | COVERED | init-mcps "replaces a user file with --force after a byte-identical backup", "restores a forced replace...when apply fails"; e2e `--force` update                                                                                                                                | `refreshFlatFile`                             |
| Dry run                                                     | COVERED | init-mcps "writes nothing on dry run"; program.test "prints the agent in the plan on --dry-run"; e2e                                                                                                                                                                             | program.ts                                    |
| Stale file at apply                                         | COVERED | init-mcps "aborts with StaleFileError when the file changed between planning and applying" (agents block)                                                                                                                                                                        | `refreshFlatFile`                             |
| Unknown agent                                               | COVERED | init-mcps "rejects an unknown agent naming it"; program.test "exits 1 naming an unknown agent"; e2e exit 1                                                                                                                                                                       | `UnknownAgentError` (init-mcps.ts:96)         |
| Flag selection / kind flag                                  | COVERED | program.test "installs only the selected agent without prompts or a consent gate", "treats --agents as a kind flag"                                                                                                                                                              | program.ts:203, 253                           |
| Prompt hidden when empty                                    | COVERED | program.test "asks for agents only when the catalog has some" (asserts no `agents` call)                                                                                                                                                                                         | program.ts:254                                |
| Undo: clean prune / shared dir / drift / overwrite restored | COVERED | `application/undo-install.test.ts` describe `undoInstall (agents)`: 4 tests; e2e undo                                                                                                                                                                                            | `undo-install.ts` unchanged (0 diff lines)    |
| Unmodified agent removed                                    | COVERED | `uninstall-item.test.ts` "removes an unmodified agent, backs up its bytes and journals a remove with afterHash null"                                                                                                                                                             | `uninstall-item.ts` `isFlatFileKind` branches |
| Modified agent refused                                      | COVERED | "refuses a modified agent with exit 3, and --force removes it keeping a neighbor"; e2e exit 3                                                                                                                                                                                    | same                                          |
| Already absent                                              | COVERED | "reports already-absent without writing when the file was deleted"                                                                                                                                                                                                               | same                                          |
| Undo restores agent                                         | COVERED | "undo restores the original bytes and ownership"; e2e                                                                                                                                                                                                                            | same                                          |
| Old manifest / round trip / null afterHash                  | COVERED | `domain/manifest.test.ts` "loads a manifest without any agent and keeps version 1", "parses an agent item whose root is the file path, accepting a null afterHash", "round-trips..."                                                                                             | `manifest.ts` kind union + refine             |
| Downgrade documented                                        | COVERED | `test/agents-docs.test.ts` downgrade token in README and website security pages                                                                                                                                                                                                  | README.md "Before downgrading shitaku..."     |

### catalog

| Scenario                                       | Status  | Test evidence                                                                                                                                                                                                                    | Source                        |
| ---------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Valid agent loads                              | COVERED | `adapters/catalog/folder-source.test.ts` "loads a valid agent with its exact bytes"                                                                                                                                              | `folder-source.ts` loadAgents |
| Name differs from stem                         | COVERED | `agent.test.ts` "rejects a name that differs from the file stem"                                                                                                                                                                 | `parseAgent`                  |
| Required fields                                | COVERED | `agent.test.ts` it.each "rejects when name/description is missing/whitespace"                                                                                                                                                    | `parseAgent` REQUIRED loop    |
| Empty body                                     | COVERED | `agent.test.ts` "rejects an empty body"                                                                                                                                                                                          | `parseAgent`                  |
| Name regex                                     | COVERED | `agent.test.ts` AgentNameSchema accepts `reviewer2`, rejects `Reviewer`, `-x`, `a_b`                                                                                                                                             | `AgentNameSchema`             |
| No allowed-field list                          | COVERED | `agent.test.ts` "parses a valid agent and keeps the original bytes, including unknown keys"                                                                                                                                      | no field list in `agent.ts`   |
| Nested YAML preserved                          | COVERED | `agent.test.ts` nested test; e2e. Note: test uses `tools`/`hooks`/`future-key`; `skills`, `mcpServers`, `experimental` covered generically by `frontmatter.test.ts` opaque it.each                                               | `readFrontmatter` allowNested |
| Unlisted / ghost / guarded                     | COVERED | folder-source tests: "flags an unlisted...", "flags a listed agent with no file", "skips an agent file that is a symlink", "...directory is a symlink", "rejects...size limit"                                                   | `loadFileItems`               |
| Invalid name in index                          | COVERED | `domain/catalog/schema.test.ts` "rejects an agent name that could traverse paths, failing the whole catalog"                                                                                                                     | `schema.ts:84`                |
| Old catalog without agents                     | COVERED | folder-source "loads an empty agents list when items.agents is absent"; schema "defaults items.agents..."                                                                                                                        | `schema.ts:72`                |
| Strict mode unchanged                          | COVERED | `frontmatter.test.ts` "keeps strict mode unchanged when the option is absent or false"; existing skill/command tests (`skill.test.ts`, `command.test.ts`) still pass                                                             | default branch of reader      |
| Nested mode for agents                         | COVERED | `frontmatter.test.ts` opaque it.each, "collects several opaque keys in order"                                                                                                                                                    | reader                        |
| Missing frontmatter rejected                   | COVERED | `frontmatter.test.ts` "still rejects no block / an unclosed block"                                                                                                                                                               | reader                        |
| Limit documented                               | COVERED | `agents-docs.test.ts` ("not validated" in CONTRIBUTING, block-scalar token in README)                                                                                                                                            | CONTRIBUTING, README          |
| Copy mentions agents / no gate                 | COVERED | program.test "lists --agents in init help and the --source trust copy mentions agents and grants", "installs only the selected agent without prompts or a consent gate"; e2e `--yes` installs                                    | program.ts:628                |
| Layout with agents                             | COVERED | `bundled-catalog.test.ts` (updated), folder-source tests                                                                                                                                                                         | schema                        |
| Profile extends: resolved / unknown / no field | COVERED | `profile.test.ts` "merges agents through extends and de-duplicates", "fails on an unknown agent", "resolves a profile without agents..."; folder-source "resolves profile agents and drops profiles that reference unknown ones" | `profile.ts`                  |

### catalog-list

| Scenario                             | Status  | Test evidence                                                                                                |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------ |
| JSON agent kind                      | COVERED | `domain/catalog/listing.test.ts` "uses singular kind agent..."                                               |
| Search matches agent                 | PARTIAL | Search is generic (listing); no test searches specifically for an agent. Behavior inherited, low risk        |
| No kind / single kind / invalid kind | COVERED | `listing.test.ts` updated; program.test "uninstalls an agent..., and list accepts agents"; e2e `list agents` |
| Empty agents kind                    | COVERED | `listing.test.ts` (empty catalog yields nothing; generic `no matching items` path)                           |

### install-status

| Scenario                                                            | Status  | Test evidence                                                                                                                                                                                        |
| ------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| agent-missing / healthy agent                                       | COVERED | `domain/plan/doctor-plan.test.ts` "reports agent-missing...", "reports nothing for a healthy agent and no agent-missing for an edited one"; e2e doctor exit 4                                        |
| Active agent listed, two scopes, skill+agent same name              | COVERED | `status.test.ts` describe `getStatus (agents)`: 4 tests; e2e `status --json` kind agent                                                                                                              |
| installed / modified / out-of-date / missing / missing-from-catalog | COVERED | `status.test.ts` "reports modified, out-of-date, missing and missing-from-catalog". "modified wins over out-of-date" is implied by shared logic, not asserted separately for agents (PARTIAL, minor) |

### item-uninstall

| Scenario                                             | Status  | Test evidence                                                                                                                   |
| ---------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Agent removed by kind / valid kind                   | COVERED | uninstall-item "removes an unmodified agent..."; program.test "uninstalls an agent with --kind agent"                           |
| Dry run                                              | COVERED | uninstall-item "writes nothing on a dry run"                                                                                    |
| Invalid kind lists `agent`                           | COVERED | program.test "lists agent among the --kind choices on an invalid kind"; e2e                                                     |
| Skill+agent / command+agent collision                | COVERED | uninstall-item `it.each` skill/command: exit-1 candidates list `agent` plus the other kind; `--kind agent` removes the agent    |
| Disambiguated: skill remains                         | PARTIAL | Test asserts the agent file is removed but does not assert the skill remains                                                    |
| Command+agent: `--kind command` removes only command | MISSING | Only the `--kind agent` direction is tested. Source path is shared (`isFlatFileKind` + per-kind `expectedPath`), so risk is low |

Matrix summary: 59 scenarios, 54 COVERED, 4 PARTIAL, 1 MISSING (all low risk).

## 3. Design adherence

- Reader: `readFrontmatter(text, file, { allowNested })` with overloads; opaque keys collected, indented line without owner is an issue, default path unchanged (strict tests and existing skill/command tests pass). Pure: no `node:` or `process` in domain files. OK.
- `parseAgent`: stem regex, `name === stem`, `name`/`description` required non-empty, opaque `name`/`description` rejected with "must be a single-line value", body non-empty, original `bytes` returned verbatim, no allowed-field list. OK.
- Dedupe: `refreshFlatFile(...kind)`, `flatFileStep(change, kind)`, `isFlatFileKind` in `manifest.ts`, `KnownNames`-style profile resolution with `agents`. OK.
- Manifest: `TreeItemSchema.extend({ kind: z.literal('agent') })`, afterHash-null refine uses `isFlatFileKind`, `deriveAgentOwnership`, `OwnedItem.kind` includes `agent`, version unchanged. OK.
- `agentsDir`: `join(scope === 'user' ? homeDir : cwd, '.claude', 'agents')`. OK.
- No consent gate: no confirm path for agents in `program.ts`; e2e `--yes` installs directly. OK.
- `undo-install.ts`: zero diff vs origin/main. OK.
- Architecture: `test/architecture.test.ts` passes; no `../` imports in `src` or `test`; no `fs/os/path/child_process/process` in new domain files. OK.
- Remaining `kind === 'command'`: `uninstall-item.ts:84` and `installed-state.ts:164` are per-kind dispatches for command-specific paths/hashes and are followed by explicit `agent` branches (`uninstall-item.ts:85`, `installed-state.ts:168`); `program.ts:272` maps command conflicts and the next line maps agents. No branch silently excludes agents.

## 4. Issue #42 acceptance criteria

| Criterion                                                           | Status            | Evidence                                                                                                           |
| ------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Catalog schema supports agents and is validated on load             | MET               | `schema.ts` `agents` in index, `parseAgent`, folder-source and schema tests; e2e `list agents`                     |
| `init` installs a selected agent and `undo` reverts it              | MET               | program.test "installs only the selected agent...and undo reverts it"; e2e init exit 0, undo restores bytes        |
| Existing user agents never overwritten silently (conflict in plan)  | MET               | init-mcps "refuses to overwrite a user file without --force"; e2e conflict exit 2 with message; `--force` backs up |
| Tests cover plan, apply and undo; lint, typecheck, test, build pass | MET               | Section 5 (coverage gate not runnable locally)                                                                     |
| README documents the agents kind                                    | MET (with defect) | README "Agents" and "Agents (install)" sections, flags, uninstall; see WARNING W1 (stale sentence)                 |

Also in the issue body: profiles can reference agents (schema + validation covered); interactive prompts and `init` show agents (covered); "no concrete agents shipped" holds (`catalog/agents/.gitkeep`, `"agents": []`).

## 6. End-to-end sandbox run

HOME and cwd were temp dirs (`/private/tmp/claude-501/e2e*/home`, `.../cwd`); the real home was not touched. Fixture catalog: one agent `reviewer` with a multi-line `tools:` list and a nested `hooks:` block.

| Step                                                  | Exit | Result                                                                             |
| ----------------------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `list agents --source fixture`                        | 0    | `reviewer  Reviews code`                                                           |
| `init --agents reviewer --yes --scope user --dry-run` | 0    | plan `reviewer: create`, nothing written                                           |
| `init --agents reviewer --yes --scope user`           | 0    | created `~/.claude/agents/reviewer.md`; `cmp` with fixture: byte-identical         |
| `status --scope user` (bundled catalog)               | 0    | `reviewer: missing-from-catalog` (expected: default source is the bundled catalog) |
| `doctor`                                              | 0    | no problems found                                                                  |
| second `init`                                         | 0    | `reviewer: skip (already installed)`, `nothing to change`                          |
| edit file, `status --scope user`                      | 0    | `reviewer: modified`                                                               |
| `uninstall reviewer --kind agent --scope user`        | 3    | refused: "changed since install ... re-run with --force"                           |
| same with `--force`                                   | 0    | removed file; empty `agents/` dir left in place (only undo prunes)                 |
| `undo`                                                | 0    | restored the edited bytes (backup taken at uninstall)                              |
| `init` over the edited file, no force                 | 2    | `conflict: agent 'reviewer' already exists with different content`                 |
| `init --agents ghost`                                 | 1    | `error: unknown agent: ghost`                                                      |
| `init --force`                                        | 0    | `update (replaced by --force)`                                                     |
| `status --source fixture --json`                      | 0    | `kind: "agent"`, `state: "installed"`, path to file                                |
| `uninstall x --kind widget`                           | 1    | choices error: `mcp, skill, script, command, hook, agent`                          |
| delete file, `doctor`                                 | 4    | `user agent reviewer is missing at <path>`, fix: run init again                    |
| `undo` after the file was deleted (twice)             | 3    | refuses ("changed since install"); would need `--force`                            |

Notes: `undo` has no `--scope` flag (flags: `--id`, `--force`, `--dry-run`). The agent-after-delete `undo` refusal matches the generic drift rule and is the same rule used for commands.

## 7. Risks and doc consistency

- openspec: the five deltas (`agents-install`, `catalog`, `catalog-list`, `install-status`, `item-uninstall`) are not yet synced into `openspec/specs/`; `agents-install` does not exist there yet (new domain). This is the archive step, not a defect.
- Stale or incomplete doc mentions of the kind list (see S1, S2).

## Issues

### CRITICAL

None.

### WARNING

- W1. README.md line 310 says "The `init` flag that selects agents ships in a later release; today `status`, `doctor`, `uninstall` and `undo` already handle agents recorded in a manifest." This is false on this branch: `init --agents` ships (README line 207 and the code). Reword it before merging the final PR; the docs tests do not catch it.
- W2. Coverage gate (`test:coverage`) could not be executed locally, so any coverage thresholds in CI are unverified.
- W3. Test gaps (low risk, shared code): no CLI-level test of the interactive agent conflict "overwrite" choice; no test for `uninstall x --kind command` when `x` is also an agent; the skill-remains assertion is missing in the skill+agent disambiguation test.

### SUGGESTION

- S1. README line 62 ("One command installs MCP servers, skills, scripts, slash commands and hooks") and line 333 ("Remove one MCP server, skill, script, slash command or hook") omit agents; website `en/cli/commands.md` lines 12 and 44 likewise.
- S2. Add an agent-specific `list agents --search` test to match the spec scenario literally.
- S3. After `uninstall --force` of the only agent, the install-created `.claude/agents/` directory remains (empty). Spec only requires pruning on undo, so this is acceptable; document it if desired.

## Key Learnings

1. The full chain passes typecheck, lint, format, both docs generators, 1445 tests and the build, with 54 of 54 tasks checked.
2. The README still claims that the init flag for agents ships in a later release, which contradicts the shipped `--agents` flag.
3. The `undo-install.ts` file has zero diff because agents reuse the generic byte-file path keyed by the manifest root.
4. The sandboxed end-to-end run confirmed byte-identical installs, conflict exit 2, drift-refused uninstall exit 3, and agent-missing doctor exit 4.
5. Coverage thresholds cannot be verified locally because `@vitest/coverage-v8` is not installed in this checkout.
