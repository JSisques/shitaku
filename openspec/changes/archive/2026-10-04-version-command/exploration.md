# Exploration: version-command (issue #111)

## Current State

- No `version` subcommand and no `--version` / `-v` flags. Commander is never given `.version(...)`.
- `src/main.ts` already has `readVersion()`: reads `../package.json` relative to `import.meta.url` (works from both `src/` and `dist/`), returns `string | undefined`. Missing/invalid JSON or non-string `version` → `undefined`.
- That value is used only to wire optional `CliDeps.updates` (`currentVersion` + npm registry source). When unreadable, the update check is **silently skipped** — different from the hard-fail the version command needs.
- `runCli` in `src/adapters/cli/program.ts` registers: `init`, `undo`, `uninstall`, `status`, `list`, `doctor`. Pattern: inject deps, `exitOverride()`, route I/O through `deps.out` / `deps.err`, wrap actions in `guarded`.
- Package version today: `0.2.0` (`package.json`). Bin entry: `shitaku` → `./dist/main.js`.
- Related shipped feature: update notifier (#49 / `openspec/specs/update-notifier`). Related open issue: `upgrade` (#50) — shows current+target and mutates the install; out of scope here.
- Active sibling OpenSpec change: `uninstall-command` (code already present on this branch). Coexist only; do not edit its artifacts or rework uninstall.

### Commander flag fact (verified)

Default `.version('x.y.z')` registers **`-V` / `--version`**, not `-v`. `-v` is unknown unless flags are customized: `.version(ver, '-v, --version')`. Both paths print bare `x.y.z` to stdout and exit 0 under `exitOverride`. A `version` **subcommand** is separate and must print via `deps.out` itself.

## Affected Areas

| Path                                   | Why                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`                          | Pass existing `readVersion()` result into CLI deps (not only into `updates`)                                    |
| `src/adapters/cli/program.ts`          | Register `version` command + `-v`/`--version`; handle missing version                                           |
| `test/adapters/cli/program.test.ts`    | Command, flags, unreadable case (same `run(...)` harness as `list`/`status`)                                    |
| `test/main.test.ts`                    | Assert composition root forwards package version (optional but valuable; today no `updates`/`version` coverage) |
| `README.md`                            | Usage line + short Version section (cognitive load: happy path first, bare output for scripts)                  |
| New OpenSpec capability (later phases) | e.g. `cli-version` delta under `openspec/changes/version-command/specs/`                                        |

Unlikely to need new domain/application modules: printing an injected string is adapter-level.

## Approaches

1. **Inject `cliVersion?: string` on `CliDeps` + commander `.version` + `version` subcommand** (recommended)
   - When defined: `program.version(cliVersion, '-v, --version')` and `command('version')` → `deps.out(cliVersion)`.
   - When undefined: same entry points print a clear `error: ...` on stderr and exit non-zero (do not call commander `.version` with a fake string).
   - Pros: Matches issue; keeps package I/O in `main.ts`; scripting-friendly bare version; easy unit tests via deps injection; ~under 400-line budget.
   - Cons: Duplicates the string already on `updates.currentVersion` when notifier is wired (acceptable; avoid refactoring notifier in this change).
   - Effort: Low

2. **Reuse only `updates.currentVersion`**
   - Pros: No new field.
   - Cons: Offline/unit tests leave `updates` undefined to skip network; version would vanish unless every test wires updates. Couples “show version” to “enable notifier”.
   - Effort: Low, poor fit

3. **Application use case / re-read `package.json` inside `program.ts`**
   - Pros: None for this scope.
   - Cons: Over-layered, or breaks “package location only in `main.ts`” boundary.
   - Effort: Medium, reject

## Recommendation

Approach 1. Plug-in points:

1. `main.ts`: `cliVersion: version` on the object passed to `runCli` (reuse `const version = readVersion()`).
2. `program.ts` `runCli`: before other commands (or after — order only affects help listing), register version UX as above.
3. Tests: `describe('version')` in `program.test.ts` with injected `cliVersion`; unreadable = omit/`undefined`. Optionally assert `bootMain()` deps include `cliVersion` matching `package.json`.
4. README: one Usage example `shitaku version` / `shitaku --version` and note that stdout is the bare semver string.

Strict TDD (`pnpm test`): RED tests for happy path + flags + missing version, then GREEN wiring.

## Overlap notes

| Feature                      | Relationship                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update notifier (#49)        | Shares `readVersion()` source; stderr notice after commands (TTY/`CI`/opt-out gated). Leave notifier behavior unchanged when version is unreadable (still skip). |
| Upgrade (#50)                | Future consumer of “current version”; this change only reports it. Do not implement upgrade.                                                                     |
| `uninstall-command` OpenSpec | Parallel active change; touch only version-related slices of `program.ts` / README / tests.                                                                      |

## Open product decisions (for propose)

1. Exact stderr message when version is unreadable (suggest: `error: cannot read package version`).
2. Keep only `-v, --version` (issue) vs also accept commander’s historic `-V` (recommend: only `-v, --version`).
3. Should `version` / `--version` still run the update check when `updates` is wired? (Default today: yes for every successful parse; TTY-gated so scripts stay clean. Recommend leave consistent unless propose opts out.)
4. Error exit code: `1` (consistent with other CLI errors) vs another code — recommend `1`.

## Risks

- Help/`--help` tests that snapshot command lists need to include `version`.
- Asymmetry: unreadable version skips notifier silently but fails `version` loudly — intentional; document in proposal.
- Merge churn with `uninstall-command` on the same `program.ts` / README / `program.test.ts` files.
- Do not import JSON at build time (`rootDir: src`); keep runtime read in `main.ts` (already established by update-notifier).

## Ready for Proposal

Yes — scope is clear, plug-in points are concrete, and remaining items are small product wording/flag choices for `sdd-propose`.
