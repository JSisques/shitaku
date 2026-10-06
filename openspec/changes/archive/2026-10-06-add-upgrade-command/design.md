# Design: Add CLI Upgrade Command

## Technical Approach

Implement proposal approach 1 / specs `cli-upgrade` + `update-notifier`: application use case `upgradeCli` orchestrates fresh `LatestVersionSource` fetch, `isNewer` compare, current→target messaging, then domain policy (spawn vs print). Reuse ports `ProcessRunner` (`shell: false`) and `LatestVersionSource`; keep domain free of Node/infra. Thin `program.ts` registration; composition only in `main.ts`.

## Architecture Decisions

| Decision          | Options                                        | Choice                                                                            | Rationale                                                                    |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Layering          | CLI-only shell-out vs use case                 | `upgradeCli` in application; domain argv/runnability                              | Matches hexagonal guards; fakeable like `runScript` / `checkForUpdate`       |
| Spawn vs print    | Always spawn / always print / by method        | Spawn only `npm-global`/`pnpm-global`; print-only `npx`/`unknown`                 | Locked product policy; npx cannot persist                                    |
| Argv source       | Split `upgradeCommand` string vs typed argv    | Domain `upgradeArgv(method)` fixed tokens                                         | Avoids shell parsing; aligns with `ProcessRunner`                            |
| Version target    | Notifier cache vs fresh fetch                  | Always `source.latest(signal)` on upgrade                                         | Spec: must not rely solely on cache                                          |
| Fetch timeout     | 1.5s notifier TTL vs longer                    | ~10s AbortSignal for upgrade                                                      | User-initiated; surface failure instead of silent null                       |
| Detection default | Retarget miss → `unknown` vs keep `npm-global` | Keep `detectInstallMethod` heuristics                                             | Changing default would alter notifier hints; yarn/bun/Homebrew stay OOS risk |
| Notifier skip     | Skip only version vs also upgrade              | Extend skip predicate to include `upgrade`                                        | Spec MODIFIED; no wording change                                             |
| Deps wiring       | Nested `upgrade` settings vs reuse             | `CliDeps.installMethod` + reuse `updates.source` / `cliVersion` / `processRunner` | main already detects method; avoid duplicate source                          |
| #46 `update`      | Alias vs omit                                  | Do not register `update`                                                          | Locked OOS                                                                   |

## Data Flow

```
main (detectInstallMethod, version, NpmRegistryVersionSource, NodeProcessRunner)
  → runCli
       ├─ skip checkForUpdate when argv is upgrade|version|-v|--version
       └─ upgrade action → upgradeCli
              ├─ currentVersion missing / latest null → err, exit 1 (no spawn)
              ├─ !isNewer → already-latest, exit 0
              ├─ out current→target
              ├─ runnable → ProcessRunner.run(cmd, args, {cwd, env}) shell:false
              │     └─ exit≠0 → err recovery, exit ≠0 (no success claim)
              └─ print-only → out upgradeCommand(method), exit 0
```

## File Changes

| File                                   | Action | Description                                                      |
| -------------------------------------- | ------ | ---------------------------------------------------------------- |
| `src/application/upgrade-cli.ts`       | Create | Fetch, compare, message, spawn/print, exit codes                 |
| `src/domain/install-method.ts`         | Modify | `isRunnableUpgrade`, `upgradeArgv`; keep `upgradeCommand`        |
| `src/adapters/cli/program.ts`          | Modify | Register `upgrade`; skip notifier; wire use case                 |
| `src/main.ts`                          | Modify | Pass `installMethod` on `CliDeps` (source already via `updates`) |
| `test/application/upgrade-cli.test.ts` | Create | Matrix: fresh fetch, already-latest, spawn/print, PM fail        |
| `test/domain/install-method.test.ts`   | Modify | Argv + runnability cases                                         |
| `test/adapters/cli/program.test.ts`    | Modify | Registration; upgrade skips notifier; end-to-end fakes           |
| `README.md`                            | Modify | Document `shitaku upgrade` (CLI package, not catalog)            |

## Interfaces / Contracts

```ts
// domain — non-obvious only
isRunnableUpgrade(method: InstallMethod): boolean; // npm-global | pnpm-global
upgradeArgv(method: 'npm-global' | 'pnpm-global'): { command: string; args: readonly string[] };
// npm: ['install','-g','@jsisques/shitaku'] | pnpm: ['add','-g','@jsisques/shitaku']

// application
upgradeCli(deps: {
  source: LatestVersionSource;
  runner: ProcessRunner;
  currentVersion: string;
  installMethod: InstallMethod;
  cwd: string;
  env?: Record<string, string | undefined>;
  out(line: string): void;
  err(line: string): void;
  timeoutMs?: number; // default ~10000
}): Promise<number>;
```

`ProcessRunner` / `LatestVersionSource` unchanged. `NodeProcessRunner` already enforces `shell: false`.

## Testing Strategy

| Layer              | What                                                                                                              | Approach                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Unit (domain)      | `isRunnableUpgrade`, `upgradeArgv` tokens                                                                         | Table cases; no spawn                                                        |
| Unit (application) | Fresh fetch called; already-latest; spawn argv+cwd; print-only no runner; null latest; non-zero PM → recovery msg | Fake `LatestVersionSource` + `ProcessRunner` (pattern: `run-script.test.ts`) |
| Adapter (CLI)      | `upgrade` registered; no `update`; notifier not started for `upgrade`; help text                                  | Extend `program.test.ts` skip matrix                                         |
| Guards             | Domain stays infra-free                                                                                           | Existing `architecture.test.ts`                                              |

Strict TDD: RED tests first (`openspec/config.yaml`).

## Threat Matrix

| Boundary                 | Applicability                           | Design response | Planned RED tests |
| ------------------------ | --------------------------------------- | --------------- | ----------------- |
| Documentation-like paths | N/A — no executable-file classification | —               | —                 |
| Git repository selection | N/A — no git                            | —               | —                 |
| Commit state             | N/A — no commits                        | —               | —                 |
| Push state               | N/A — no push                           | —               | —                 |
| PR commands              | N/A — no PR automation                  | —               | —                 |

Process/PM boundary (not a matrix row): fixed domain argv only; never spawn user-supplied strings; `shell: false` via existing runner; print-only for unsafe methods; non-zero child → non-zero CLI + recovery, no success. RED: spawn argv exact match; npx/unknown zero runner calls; non-zero exit messaging.

## Migration / Rollout

No migration. Ship with package release; users run `shitaku upgrade` after install. Rollback = revert commits.

## Open Questions

- None blocking — product locks and specs cover policy. Exact user-facing copy may be refined in apply to match tone of existing CLI errors.
