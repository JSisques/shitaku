# Tasks: Catalog slash commands (`command` kind)

Strict TDD per task group: RED (failing test) -> GREEN (minimal code) -> REFACTOR. Every PR body ends with "Part of #47". Hooks are out of scope. Every PR must pass `pnpm run typecheck`, `lint`, `format:check`, `test`, `build` on its own.

## Review Workload Forecast

| Field                   | Value                                                    |
| ----------------------- | -------------------------------------------------------- |
| Estimated changed lines | ~1,750 total (370 / 260 / 350 / 220 / 200 / 350)         |
| 400-line budget risk    | Medium (no slice above 400; PR 1, 2b, 3b sit at 350-370) |
| Chained PRs recommended | Yes                                                      |
| Suggested split         | PR 1 -> 2a -> 2b -> 2c -> 3a -> 3b                       |
| Delivery strategy       | auto-chain                                               |
| Chain strategy          | stacked-to-main                                          |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

Estimated changed lines per slice: PR 1 ~370, PR 2a ~260, PR 2b ~350, PR 2c ~220, PR 3a ~200, PR 3b ~350.

No slice is estimated above 400. Contingency (apply only if PR 1 or 3b measures above 400 mid-apply):

- PR 1 -> 1a (frontmatter extraction + `command.ts` + tests, ~170) and 1b (schema, profile, listing, loader, `commands: []` literals, ~200).
- PR 3b -> 3b-i (generators + website en/es, ~230) and 3b-ii (README, CONTRIBUTING, hand-written CLI docs, ~120).

### Suggested Work Units

| Unit | Goal                                                                     | Likely PR | Focused test command                                                                                                                    | Runtime harness                                                    | Rollback boundary                         |
| ---- | ------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| 1    | Catalog loads/validates/lists commands, profile field                    | PR 1      | `pnpm vitest run test/domain/catalog test/adapters/catalog`                                                                             | `list --json` against fixture catalog                              | catalog files + literals; no install code |
| 2a   | Domain install model (classify, flat-file plan, manifest, `commandsDir`) | PR 2a     | `pnpm vitest run test/domain/plan test/domain/manifest.test.ts test/adapters/claude-code`                                               | N/A: pure domain, unreachable from CLI                             | `src/domain/plan`, `manifest.ts`, target  |
| 2b   | `init` apply + undo for commands                                         | PR 2b     | `pnpm vitest run test/application/init-mcps.test.ts test/application/undo-install.test.ts`                                              | N/A: no CLI flag until 3a; use fake fs tests                       | `init-mcps.ts`, `undo-install.ts`         |
| 2c   | Uninstall, status, doctor                                                | PR 2c     | `pnpm vitest run test/application/uninstall-item.test.ts test/application/installed-state.test.ts test/domain/plan/doctor-plan.test.ts` | N/A: no CLI flag until 3a                                          | uninstall/status/doctor files             |
| 3a   | CLI surface (`--commands`, prompter, `--kind command`)                   | PR 3a     | `pnpm vitest run test/adapters/cli`                                                                                                     | `shitaku init --commands review --dry-run` against fixture catalog | `src/adapters/cli`, `ports/prompter.ts`   |
| 3b   | Docs, generators, website en+es                                          | PR 3b     | `pnpm vitest run test/tooling.test.ts` plus generator `--check` scripts                                                                 | generators in check mode                                           | docs, scripts, `website/**`               |

Merge order: 1 -> 2a -> 2b -> 2c -> 3a -> 3b (each rebased on main after the previous merge).
Commit scopes: PR 1 `feat(catalog)`; 2a `feat(plan)`; 2b `feat(init)`; 2c `feat(status)` (uninstall/doctor in body); 3a `feat(cli)`; 3b `docs(website)` (plus `docs(readme)` for README/CONTRIBUTING). OpenSpec artifacts: `docs(openspec)`.

---

## PR 1: Catalog (frontmatter, command, schema, profile, listing, loader)

- [ ] 1.1 RED: create `test/domain/catalog/frontmatter.test.ts` (single-line keys, missing/unclosed block, multi-line value rejected; skill messages unchanged).
- [ ] 1.2 GREEN: create `src/domain/catalog/frontmatter.ts` (`readFrontmatter(text, file)`); modify `src/domain/catalog/skill.ts` to use it; existing `test/domain/catalog/skill.test.ts` must stay green. [Catalog: Command catalog entries]
- [ ] 1.3 RED: create `test/domain/catalog/command.test.ts`: valid with passthrough `argument-hint`; names `Review`, `-x`, `a_b` rejected; missing/blank `description`; multi-line value; empty body. [Commands Install: Command name and frontmatter]
- [ ] 1.4 GREEN: create `src/domain/catalog/command.ts` (`CommandNameSchema`, `parseCommand` -> `{ name, description, bytes }`).
- [ ] 1.5 RED: extend `test/domain/catalog/schema.test.ts` (`items.commands` optional/default `[]`), `profile.test.ts` (commands resolved once, unknown `ghost` fails, no field = empty, cycle), `listing.test.ts` (`kind: 'command'`, `list commands --search DIFF`). [Catalog: Old catalog, Commands resolved, Unknown reference, Profile without commands; Catalog List: JSON command kind, Search]
- [ ] 1.6 GREEN: modify `src/domain/catalog/schema.ts`, `profile.ts`, `listing.ts` (`items.commands`, `ProfileSchema.commands`, `Catalog.commands` required, `LIST_KINDS`); add `commands: []` to the ~26 `Catalog` literals in `test/**` and `test/helpers/`, add `commandSource` helper.
- [ ] 1.7 RED: extend `test/adapters/catalog/folder-source.test.ts` with fixtures under `test/fixtures/**/commands/`: valid, unlisted `*.md`, ghost entry, `../evil`, symlink, bad frontmatter; valid items stay usable. [Catalog: Valid command, Invalid or guarded]
- [ ] 1.8 GREEN: modify `src/adapters/catalog/folder-source.ts` (`loadCommands` via `readFileNoFollow` + realpath containment, unlisted-file issue); `catalog/catalog.json` add `"commands": []`; extend `test/adapters/catalog/bundled-catalog.test.ts` (empty commands valid; `hooks/` still ignored).
- [ ] 1.9 REFACTOR + gate: dedupe parsing helpers (jscpd), then run typecheck, lint, format:check, test, build.

## PR 2a: Domain install model

- [ ] 2a.1 RED: create `test/domain/plan/classify.test.ts` (create/skip/update-owned/force/conflict, noun in reason); keep `skill-plan.test.ts` and `script-plan.test.ts` green.
- [ ] 2a.2 GREEN: create `src/domain/plan/classify.ts` (`classifyOwned(present, desired, owned, force, noun)`); modify `skill-plan.ts`, `script-plan.ts` so `classifySkill`/`classifyScript` delegate (exports kept). REFACTOR: confirm no duplicated classifier.
- [ ] 2a.3 RED: create `test/domain/plan/flat-file-plan.test.ts`: absent=`create`; identical=`skip`; owned+unchanged+catalog changed=`update`; unmanaged different=`conflict`; `--force`=`update`; hashes are `sha256(bytes)`. [Commands Install: Plan classification]
- [ ] 2a.4 GREEN: create `src/domain/plan/flat-file-plan.ts` (`FlatFileChange`, `buildFlatFilePlan`); modify `change-plan.ts` (`ChangePlan.commands`).
- [ ] 2a.5 RED: extend `test/domain/manifest.test.ts`: `kind: 'command'` parses with `root` = file path; `afterHash: null` allowed for command; `deriveCommandOwnership`; old manifest without commands loads, version unchanged. [Install Safety: Manifest; Commands Install: Old manifest]
- [ ] 2a.6 GREEN: modify `src/domain/manifest.ts` (`TreeItemSchema.extend({ kind: 'command' })`, refine for skill|script|command, `deriveCommandOwnership`, `OwnedItem.kind`).
- [ ] 2a.7 RED: extend `test/adapters/claude-code/target.test.ts`: `commandsDir` is `~/.claude/commands` (user) and `<cwd>/.claude/commands` (project). [Commands Install: Command install roots]
- [ ] 2a.8 GREEN: modify `src/ports/agent-target.ts`, `src/adapters/claude-code/target.ts` (`commandsDir`); update fake targets in `test/helpers/`.
- [ ] 2a.9 Gate: typecheck, lint, format:check, test, build.

## PR 2b: `init` apply + undo

- [ ] 2b.1 RED: extend `test/application/init-mcps.test.ts`: user/project roots with catalog-identical bytes; neighbor `mine.md` untouched; conflict + no force writes nothing; `--force` backup then replace; dry-run no writes; unknown command `ghost` throws `UnknownCommandError` and writes nothing. [Commands Install: roots, Conflict refused, Forced replace, Dry run, Unknown command]
- [ ] 2b.2 RED: add failure cases via `faultyFs`: create failure removes file + created dir, no manifest entry; forced-replace failure restores original byte-identical; stale file raises `StaleFileError`; temp-then-rename write. [Install Safety: Failure on create, Failure during forced replace]
- [ ] 2b.3 GREEN: modify `src/application/init-mcps.ts` (`InitRequest.commands`, `UnknownCommandError`, `refreshFlatFile`, generalized `ByteStep`, 6th positional `commandNames` in profile API, journal `{kind:'command', root:path}`, `createdDirs` rollback).
- [ ] 2b.4 RED: extend `test/application/undo-install.test.ts`: no `UnsafeTreeError`; created empty `./.claude/commands` pruned; pre-existing or non-empty dir kept; drift refused without `--force`; forced-replace backup restored; missing backup fails before any change. [Commands Install: Undo scenarios; Install Safety: Command in shared directory, Missing backup]
- [ ] 2b.5 GREEN: modify `src/application/undo-install.ts` (split `itemRoots` for LIFO+prune from `treeRoots` for `unrecordedFiles`; command files via `readBytes`/`writeBytes`; non-recursive `removeDir`).
- [ ] 2b.6 REFACTOR + gate: typecheck, lint, format:check, test, build. No CLI entry point exists yet.

## PR 2c: Uninstall, status, doctor

- [ ] 2c.1 RED: extend `test/application/uninstall-item.test.ts`: unmodified removed with backup, exit 0; modified refused (exit 3); `--force` removes only the file, keeps `mine.md` and dir; already absent exit 0 writes nothing; undo restores and re-owns; kind collision lists candidates (skill+command, mcp+command). [Item Uninstall: all scenarios]
- [ ] 2c.2 GREEN: modify `src/application/uninstall-item.ts` (command kind via `readBytes`, journal `afterHash: null`, `emptiedDirs` yields nothing for file roots, collision includes command).
- [ ] 2c.3 RED: extend `test/application/installed-state.test.ts`: command hashing = file bytes; states `installed|modified|missing|out-of-date|missing-from-catalog`; directory/symlink/special file at path = `modified` and other items still classified; unlisted `mine.md` ignored; same name in two scopes distinct; no writes. [Install Status scenarios]
- [ ] 2c.4 GREEN: modify `src/application/installed-state.ts` (single-file observation, never tree walkers).
- [ ] 2c.5 RED: extend `test/domain/plan/doctor-plan.test.ts`: deleted owned command -> `command-missing` (severity `problem`); healthy -> no finding; no writes. [Doctor findings for commands]
- [ ] 2c.6 GREEN: modify `src/domain/plan/doctor-plan.ts` (`command-missing`; `skill-missing` unchanged).
- [ ] 2c.7 Gate: typecheck, lint, format:check, test, build.

## PR 3a: CLI surface (flag lands last)

- [ ] 3a.1 RED: extend `test/adapters/cli/program.test.ts`: `init --commands review` selects; `--commands ghost` exits non-zero naming `ghost`; `--yes` conflict without `--force` exits 2; `list` shows five kinds; `list commands` and empty = `no matching items` exit 0; `list widgets` commander error (pin exit code under `exitOverride`); `uninstall --kind command` accepted, `--kind widget` rejected. [Selection; Catalog List: Kind filter; Item Uninstall: Command surface]
- [ ] 3a.2 RED: extend `test/adapters/cli/clack-prompter.test.ts`: commands select appears only when catalog has commands; conflict warn+ask; `printPlan` shows commands. [Prompt hidden when empty]
- [ ] 3a.3 GREEN: modify `src/ports/prompter.ts`, `src/adapters/cli/clack-prompter.ts`, `src/adapters/cli/program.ts` (`--commands`, select, conflicts, `printPlan`, `--kind` choices, `list` kind).
- [ ] 3a.4 Gate: typecheck, lint, format:check, test, build; manual `init --commands review --dry-run` against a fixture catalog.

## PR 3b: Docs, generators, website (en + es)

- [ ] 3b.1 RED: extend generator/tooling tests (`test/tooling.test.ts` or the existing generator test) so check mode fails on command-page drift and passes with an empty catalog. [Website: Generated and checked, Empty command catalog]
- [ ] 3b.2 GREEN: modify `scripts/generate-*.mjs` to emit command pages (en+es, "slash commands" wording) and profile `commands` lists with the not-installable callout; regenerate `website/**`.
- [ ] 3b.3 Modify `README.md`, `CONTRIBUTING.md` (add "Adding catalog items: commands"), and hand-written CLI docs under `website/**` (en+es): `--commands`, `list commands`, `uninstall --kind command`. [Website: Flags documented]
- [ ] 3b.4 Add changelog note: older shitaku versions throw `ManifestError` on `kind: 'command'`.
- [ ] 3b.5 Gate: typecheck, lint, format:check, test, build, generators in check mode.

## Open Questions

- v1 ships no bundled example command (proposal assumption, confirm in review of PR 1); tests use fixtures.
