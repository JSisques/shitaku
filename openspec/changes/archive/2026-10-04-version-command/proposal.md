# Proposal: Version Command (issue #111)

## Intent

Users cannot read the installed shitaku version via CLI. Add `shitaku version` and `-v`/`--version` that print bare package semver (or fail clearly), without coupling to the update notifier.

## Scope

### In Scope

- `shitaku version`, `-v`, `--version`
- Happy path: bare semver on stdout (e.g. `0.2.0`), exit `0`
- Unreadable: stderr `Unable to determine shitaku version.`, exit `1`
- Inject `readVersion()` from `main.ts` as `CliDeps.cliVersion`
- README Usage + short Version note; adapter tests via strict TDD (`pnpm test`)

### Out of Scope

- Separate `-V` alias (custom `-v, --version` replaces commander default)
- `upgrade` (#50); domain/application modules for printing a string
- Changing notifier silent-skip on other commands when version is unreadable
- Edits to `uninstall-command` OpenSpec artifacts

## Capabilities

### New Capabilities

- `cli-version`: report package version via subcommand and `-v`/`--version`; unreadable-version error; no update-notifier on these paths

### Modified Capabilities

- `update-notifier`: `version` / `-v` / `--version` MUST NOT run the update check

## Approach

Confirmed approach 1:

1. `main.ts`: pass `cliVersion: version` from existing `readVersion()` (keep `updates` wiring for other commands).
2. `program.ts`: if set → `program.version(cliVersion, '-v, --version')` + `command('version')` → `deps.out(cliVersion)`; if unset → fixed stderr message, exit `1` (no fake version string).
3. Skip update-notifier only on version reporting paths.
4. TDD: RED→GREEN in `program.test.ts`; then README. Adapters + composition root only.

## Affected Areas

| Area                                           | Impact           | Description                      |
| ---------------------------------------------- | ---------------- | -------------------------------- |
| `src/main.ts`                                  | Modified         | Forward `cliVersion`             |
| `src/adapters/cli/program.ts`                  | Modified         | Flags + `version`; skip notifier |
| `test/adapters/cli/program.test.ts`            | Modified         | AC coverage                      |
| `README.md`                                    | Modified         | Document bare stdout             |
| change specs `cli-version` / `update-notifier` | New (spec phase) | Full + delta specs               |

## Risks

| Risk                                                          | Likelihood | Mitigation                           |
| ------------------------------------------------------------- | ---------- | ------------------------------------ |
| Merge churn with `uninstall-command` on shared CLI/docs/tests | Med        | Touch version slices only            |
| Help lists omit `version`                                     | Low        | Update assertions with feature       |
| Accidental notifier on version paths                          | Low        | Explicit skip for those entry points |

## Rollback Plan

Revert the PR (remove `cliVersion` wiring, registration, README/tests, notifier skip). No persisted state.

## Dependencies

- Existing `readVersion()` / `CliDeps` I/O from update-notifier (#49)
- Sibling `uninstall-command` may share files — coexist only

## Success Criteria

- [ ] `version` / `-v` / `--version` print bare semver to stdout, exit 0
- [ ] Unreadable prints exact stderr message, exit 1
- [ ] Those entry points skip update-notifier
- [ ] README documents command/flags and bare stdout
- [ ] `pnpm test`, typecheck, lint, format:check pass
