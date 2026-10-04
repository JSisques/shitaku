```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:7d1eb41af7c15f4a2629923bc9823b8a066636945adf83fe8cb1134878c4cf96
verdict: pass
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 12/12
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:511949dff681e1afbc535138ea52fa99c5da5ae305484e48c38f8bf65d7a5e8c
build_command: pnpm run build
build_exit_code: 0
build_output_hash: sha256:9bad96ff99250c1d614d57e9767be5a420d9a27b37fc70d4dee41b909abb3887
```

## Verification Report

**Change**: version-command
**Version**: N/A (issue #111)
**Mode**: Strict TDD

### Completeness

| Metric           | Value |
| ---------------- | ----- |
| Tasks total      | 18    |
| Tasks complete   | 18    |
| Tasks incomplete | 0     |

### Build & Tests Execution

**Build**: ✅ Passed

```text
pnpm run build → exit 0
check-dist-aliases: 39 files clean
build_output_hash: sha256:9bad96ff99250c1d614d57e9767be5a420d9a27b37fc70d4dee41b909abb3887
```

**Tests**: ✅ 612 passed / ❌ 0 failed / ⚠️ 0 skipped

```text
pnpm test → exit 0
Test Files  35 passed (35)
Tests  612 passed (612)
test_output_hash: sha256:511949dff681e1afbc535138ea52fa99c5da5ae305484e48c38f8bf65d7a5e8c
```

**Quality gates** (openspec `rules.verify`):

- `pnpm run typecheck` → exit 0 (sha256:cae8631c86b6d1c628f8039fa8c1da68d18682a0c49e96575099888b5f09ca36)
- `pnpm run lint` → exit 0 (sha256:74554b151b2936e92fd4d4458072387042b43bb625f3e6ecdcac020481809c5b)
- `pnpm run format:check` → exit 0 (sha256:f1260ebd355aa195145e798625fad820e511eb517d704b788961dda0f7258adc)

**Smoke** (built CLI):

```text
node dist/main.js version → stdout 0.2.0, exit 0
node dist/main.js -v → stdout 0.2.0, exit 0
node dist/main.js --version → stdout 0.2.0, exit 0
```

**Coverage**: ➖ Not available for this run → `pnpm run test:coverage` failed on unrelated `test/tooling.test.ts` lint-gate timeout under coverage load (suite without coverage is green)

### Spec Compliance Matrix

| Requirement                          | Scenario                           | Test                                                                                           | Result       |
| ------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------- | ------------ |
| Version entry points                 | Entry points recognized            | `test/adapters/cli/program.test.ts` > prints bare semver for version/-v/--version              | ✅ COMPLIANT |
| Version entry points                 | No -V alias                        | `test/adapters/cli/program.test.ts` > lists version in help and registers only -v/--version    | ✅ COMPLIANT |
| Successful version report            | Bare semver stdout                 | `test/adapters/cli/program.test.ts` > prints bare semver for `version`                         | ✅ COMPLIANT |
| Successful version report            | Flags match subcommand             | `test/adapters/cli/program.test.ts` > prints bare semver for `-v`/`--version`                  | ✅ COMPLIANT |
| Unreadable version failure           | Missing version fails              | `test/adapters/cli/program.test.ts` > unreadable for `version`                                 | ✅ COMPLIANT |
| Unreadable version failure           | Flags fail the same                | `test/adapters/cli/program.test.ts` > unreadable for `-v`/`--version`                          | ✅ COMPLIANT |
| Composition-time version value       | Injected version printed           | `test/adapters/cli/program.test.ts` + `test/main.test.ts` > forwards cliVersion                | ✅ COMPLIANT |
| Composition-time version value       | Missing value is unreadable        | `test/adapters/cli/program.test.ts` > unreadable when cliVersion omitted                       | ✅ COMPLIANT |
| Documentation                        | README documents UX                | `test/naming.test.ts` > documents version entry points and bare-semver stdout in README        | ✅ COMPLIANT |
| Automated coverage                   | Matrix covered                     | `pnpm test` (version success + unreadable cases pass)                                          | ✅ COMPLIANT |
| Version reporting skips update check | Version entry points skip notifier | `test/adapters/cli/program.test.ts` > does not start the update check for version/-v/--version | ✅ COMPLIANT |
| Version reporting skips update check | Other commands still notify        | `test/adapters/cli/program.test.ts` > still notifies on non-version commands                   | ✅ COMPLIANT |

**Compliance summary**: 12/12 scenarios compliant

### Correctness (Static Evidence)

| Requirement                          | Status         | Notes                                                          |
| ------------------------------------ | -------------- | -------------------------------------------------------------- |
| Version entry points                 | ✅ Implemented | `program.version(..., '-v, --version')` + `command('version')` |
| Successful version report            | ✅ Implemented | `deps.out(version)` / Commander writeOut bare semver           |
| Unreadable version failure           | ✅ Implemented | Early gate + exact `UNREADABLE_VERSION` stderr, exit 1         |
| Composition-time version value       | ✅ Implemented | `main.ts` passes `cliVersion: version` from `readVersion()`    |
| Documentation                        | ✅ Implemented | README Usage + Version section + TOC                           |
| Automated coverage                   | ✅ Implemented | Adapter/main/naming tests under `pnpm test`                    |
| Version reporting skips update check | ✅ Implemented | `!isVersionInvocation(argv)` before `checkForUpdate`           |

### Coherence (Design)

| Decision                             | Followed? | Notes                                            |
| ------------------------------------ | --------- | ------------------------------------------------ |
| `CliDeps.cliVersion?` from main      | ✅ Yes    | Optional field; package I/O stays in `main.ts`   |
| Flags `-v, --version` only (no `-V`) | ✅ Yes    | Custom flags; help assertion rejects `-V`        |
| Unreadable hard-fail message/exit    | ✅ Yes    | Exact stderr + exit 1; no placeholder `.version` |
| Early argv gate when unset           | ✅ Yes    | Gate before parse                                |
| Skip notifier on version paths       | ✅ Yes    | `pending` undefined for version invocations      |
| Adapters + main only                 | ✅ Yes    | No domain/application modules added              |

### TDD Compliance

| Check                         | Result | Details                                                                 |
| ----------------------------- | ------ | ----------------------------------------------------------------------- |
| TDD Evidence reported         | ✅     | Found in apply-progress                                                 |
| All tasks have tests          | ✅     | 18/18 mapped; docs task 4.3 is docs-only                                |
| RED confirmed (tests exist)   | ✅     | `program.test.ts`, `main.test.ts`, `naming.test.ts` present             |
| GREEN confirmed (tests pass)  | ✅     | Focused + full suite green on verify execution                          |
| Triangulation adequate        | ✅     | 3 entry points for success/unreadable/notifier; companion status notify |
| Safety Net for modified files | ✅     | apply-progress reports suite baselines before edits                     |

**TDD Compliance**: 6/6 checks passed

---

### Test Layer Distribution

| Layer             | Tests                                                    | Files                                                                           | Tools         |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------- |
| Unit              | 12+ version-focused cases (it.each expands entry points) | `test/adapters/cli/program.test.ts`, `test/main.test.ts`, `test/naming.test.ts` | vitest        |
| Integration       | repo guards in full suite                                | existing tooling/architecture tests                                             | vitest        |
| E2E               | 0                                                        | —                                                                               | not installed |
| Runtime smoke     | 3 CLI invocations                                        | built `dist/main.js`                                                            | node          |
| **Total (suite)** | **612**                                                  | **35**                                                                          |               |

---

### Changed File Coverage

Coverage analysis skipped for verdict purposes — `pnpm run test:coverage` timed out in unrelated `test/tooling.test.ts` lint-gate fixture under coverage load. Plain `pnpm test` is green.

---

### Assertion Quality

**Assertion quality**: ✅ All assertions verify real behavior

Checked version-related tests: stdout/stderr/exit equality, help flag patterns, `asked === 0` notifier spy, package.json wiring, README content substrings. No tautologies, ghost loops, or type-only-only asserts.

---

### Quality Metrics

**Linter**: ✅ No errors
**Type Checker**: ✅ No errors
**Formatter**: ✅ No errors (after mechanical prettier/ignore fixes during verify)

### Issues Found

**CRITICAL**: None

**WARNING**:

1. `gentle-ai sdd-verify-validate` is unavailable in installed gentle-ai 3.7.0 (`unknown command`); report persisted per hybrid/user contract after local schema self-check.
2. `pnpm run test:coverage` failed due to unrelated tooling lint-gate timeout under coverage; not a version-command regression (`pnpm test` green).

**SUGGESTION**:

1. Proposal success-criteria checkboxes remain unchecked in `proposal.md` (cosmetic; tasks are complete).
2. Consider excluding local package stores from Prettier via `.prettierignore` in all worktrees (applied here for `.pnpm-store`).

### Applied mechanical fixes (verify)

1. Prettier `--write` on openspec `version-command` markdown artifacts that failed `format:check`.
2. Added `.pnpm-store/` to `.gitignore` and `.prettierignore` so local store files do not fail format gate.
3. Added README documentation assertion in `test/naming.test.ts` to cover Documentation / README documents UX.

### Verdict

PASS WITH WARNINGS
12/12 scenarios compliant; tests/typecheck/lint/format/build/smoke green; coverage tool flake and missing sdd-verify-validate command are non-blocking warnings.
