# Pre-proposal: catalog-complexity-script

```yaml
schema: gentle-ai.sdd-preproposal/v1
change: catalog-complexity-script
revision: 3
```

## Exploration

| Field                | Value                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| outcome              | complete                                                                                        |
| reference_openspec   | `openspec/changes/catalog-complexity-script/exploration.md`                                     |
| reference_engram     | `sdd/catalog-complexity-script/explore` (observation #1262)                                     |
| recommended_approach | ESLint core `complexity` + `eslint-plugin-sonarjs` cognitive-complexity via shipped flat config |

## Research request

| Field             | Value                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| selected          | true                                                                        |
| classes_requested | documentation, open-web                                                     |
| questions         | npx+plugin resolve; TypeScript parser/tool set; ignore-file behavior        |
| admission         | documentation usable; open-web declared but runtime-unavailable to subagent |
| outcome           | done                                                                        |
| evidence_openspec | `openspec/changes/catalog-complexity-script/research.md`                    |
| evidence_engram   | `sdd/catalog-complexity-script/research`                                    |
| evidence_revision | 2                                                                           |

## Product decisions

| Field        | Value                                                |
| ------------ | ---------------------------------------------------- |
| status       | confirmed                                            |
| owner        | orchestrator                                         |
| confirmed_at | 2026-10-05                                           |
| confirmed_by | user                                                 |
| tokens       | D1A D2A D3A D4A (user typed d41; interpreted as D4A) |

### Confirmed choices

1. **D1A — Plugin/module resolution:** Install/resolve required tools into the script install root (`…/scripts/complexity/node_modules`) and run the local `eslint` binary. Do not rely on multi `-p` alone for flat-config `import` resolution.
2. **D2A — Tool list:** Declare and resolve `eslint`, `eslint-plugin-sonarjs`, `typescript-eslint`, `typescript`, and `@eslint/js`. Document the deviation from issue #145’s two-tool list as required for TS parsing under flat config.
3. **D3A — Ignore policy:** Wire the consumer project’s `.gitignore` via `includeIgnoreFile`, plus fixed ignores (`node_modules`, `.git`, and any other shipped defaults).
4. **D4A — JSON contract:** Lock the versioned complexity JSON envelope from exploration (`schema`, `tool`, `functions[]` with file/name/line/cyclomatic/cognitive, worst-first sort) so #148 can consume it.

## Proposal readiness

| Field          | Value       |
| -------------- | ----------- |
| proposal_ready | true        |
| blockers       | none        |
| next           | sdd-propose |
