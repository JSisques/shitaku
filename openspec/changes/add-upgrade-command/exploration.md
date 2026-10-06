## Exploration: add-upgrade-command (issue #50)

### Current State

- No `shitaku upgrade` subcommand. Registered commands today: `init`, `undo`, `uninstall`, `status`, `list`, `doctor`, `run`, `version` (+ `-v`/`--version`). Composition root: `src/main.ts` → `runCli` in `src/adapters/cli/program.ts`.
- **Install-method detection already ships** in `src/domain/install-method.ts` (pure domain, no Node globals). Types: `npx` | `npm-global` | `pnpm-global` | `unknown`. `detectInstallMethod(signals)` and `upgradeCommand(method)` return the exact shell strings the notifier already prints. File comment explicitly marks this as shared with “(later) `shitaku upgrade`”.
- Composition root already gathers signals (`npm_command`, `npm_execpath`, `npm_config_user_agent`, `argv[1]`) and passes `installMethod` into `CliDeps.updates`. Tests: `test/domain/install-method.test.ts`, `test/main.test.ts` (wires `npx`).
- **Latest-version plumbing already ships**: port `LatestVersionSource`, adapter `NpmRegistryVersionSource` (registry `…/@jsisques%2Fshitaku/latest`), use case `checkForUpdate` + domain `isNewer` / `updateNotice`. Package name constant in `main.ts`: `@jsisques/shitaku`. Current package version: `0.2.0`; bin: `shitaku` → `./dist/main.js`.
- Update notifier (#49) prints `Update available: shitaku {current} -> {latest}. Run: {upgradeCommand}` on stderr after non-version commands. Issue #50 notes the notice should eventually point users at `shitaku upgrade` (wording change can land with this change or stay as the package-manager hint until propose decides).
- **Process spawning already exists**: port `ProcessRunner` + `NodeProcessRunner` (`shell: false`, `stdio: 'inherit'`), used by `shitaku run`. Suitable for spawning `npm`/`pnpm` upgrade argv without a shell string.
- Issue **#46 `shitaku update`** (catalog sync for installed items) is **open and unimplemented**. Naming collision is intentional: `upgrade` = CLI self-update; `update` = catalog re-sync. Do not register `update` here.
- README documents Usage + Update notifications with per-method upgrade hints; no `upgrade` command section yet. Website CLI docs likewise omit it.
- Hexagonal constraints (`test/architecture.test.ts`): domain stays free of `fs`/`os`/`path`/`child_process`/`process`; package-location I/O and `homedir` only in `main.ts`; path aliases `@/` / `@test/`.

### Affected Areas

- `src/adapters/cli/program.ts` — register `upgrade` command; skip or keep notifier for this invocation; wire deps.
- `src/main.ts` — pass `installMethod` (and version source / process runner) into upgrade path, not only into `updates`.
- `src/application/` (new use case, e.g. `upgrade-cli.ts`) — fetch latest, compare, decide run-vs-print, invoke runner, map failures.
- `src/domain/install-method.ts` — likely add argv-shaped upgrade invocation (or mark which methods are runnable vs print-only); keep string `upgradeCommand` for messages.
- `src/ports/process-runner.ts` / existing runner — reuse for global package-manager upgrades.
- `src/ports/version-source.ts` / `NpmRegistryVersionSource` — reuse for target version (prefer fresh fetch for explicit upgrade, not the 24h notifier cache alone).
- `test/adapters/cli/program.test.ts` — command registration, already-latest, detection-driven messaging, failure paths (injected fakes).
- `test/application/upgrade-cli.test.ts` (new) — detection/runnability + already-latest matrix per AC.
- `test/domain/install-method.test.ts` — extend if argv/runnability helpers land.
- `README.md` (+ optionally website `cli/commands.md`) — document `shitaku upgrade`.
- OpenSpec later: new capability (e.g. `cli-upgrade`) and possible `update-notifier` MODIFIED if notice text switches to `shitaku upgrade`.

### Approaches

1. **Application use case + typed run/print policy (recommended)** — `upgradeCli` deps: `LatestVersionSource`, current version, `InstallMethod`, `ProcessRunner`, out/err. Flow: resolve current (fail clearly if missing) → fetch latest (fail with explanation if unreachable) → if not newer, report already-latest and exit 0 → print current→target → for `npm-global`/`pnpm-global` spawn argv (`npm install -g @jsisques/shitaku` / `pnpm add -g @jsisques/shitaku`) via `ProcessRunner`; for `npx` (and optionally `unknown` if treated unsafe) print the matching `upgradeCommand` without mutating; non-zero child exit → leave install as package manager left it and explain manual next step.
   - Pros: Matches AC; reuses detection, version source, runner, `isNewer`; hexagonal; testable with fakes; aligns with domain comment foreshadowing upgrade.
   - Cons: Need clear product rules for npx / unknown / self-overwrite edge cases; ProcessRunner today returns only exit codes (stdio inherit is fine for UX).
   - Effort: Medium

2. **CLI-only shell-out of `upgradeCommand(method)` string** — parse/split the display string in the adapter and spawn, or use `shell: true`.
   - Pros: Tiny surface.
   - Cons: Fragile argv splitting; fights `shell: false` convention; blurs domain policy; harder to unit-test “print when unsafe”.
   - Effort: Low, poor fit

3. **Print-only always (never spawn)** — always show current/target and the package-manager command.
   - Pros: Safest; zero mutation risk.
   - Cons: Fails AC “upgrades the CLI… for the detected package manager” for global installs.
   - Effort: Low, reject as sole approach

### Recommendation

Approach 1. Reuse existing detection and registry plumbing; add a dedicated application use case and a thin `program.ts` registration. Treat `npx` as print-only (ephemeral cache; “cannot be run safely” per issue). Default `npm-global` detection already covers typical global bins; `unknown` can share the npm-global command string but propose should decide run vs print-only. Prefer a **fresh** registry fetch for `upgrade` (user-initiated), independent of notifier TTL. Skip the post-command update notice for `upgrade` (same rationale as `version`: avoid overlapping messaging). Point the notifier line at `shitaku upgrade` once the command exists (small delta to `updateNotice` / README).

Strict TDD (`pnpm test`): RED tests for detection wiring, already-latest, runnable global upgrade (fake runner), print-only npx, and failure messaging — then GREEN.

### Risks

- **npx / dlx semantics**: “upgrade” cannot persist an npx cache install; must print, not pretend success via spawn.
- **Self-replacement**: upgrading the running global binary while it executes can fail on some OS/package-manager combos; AC says failures leave install untouched and explain recovery — rely on npm/pnpm exit codes, do not attempt custom rollback of node_modules.
- **False `npm-global` default**: mis-detected yarn/bun/Homebrew installs may get the wrong command; keep print-on-uncertainty if new methods are out of scope.
- **Naming confusion with #46 `update`**: docs and help text must say “upgrade the CLI package”, not “update catalog items”.
- **Notifier wording drift**: `openspec/specs/update-notifier` still hard-codes `npm install -g …` in one requirement; changing the notice to `shitaku upgrade` needs a MODIFIED delta.
- **Network required**: unlike the silent notifier, explicit upgrade must surface fetch failures (do not swallow like `checkForUpdate`).

### Ready for Proposal

Yes — requirements are clear, most building blocks exist, plug-in points are concrete. Propose should lock: npx/unknown run-vs-print policy, whether notifier text switches to `shitaku upgrade`, fresh-fetch vs cache, and exact user-facing messages for already-latest / failure.
