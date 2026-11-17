# Archive Report: catalog-add-agents

## Summary

Change `catalog-add-agents` (issue #42) adds Claude Code sub-agents as a new catalog kind (`agent`): one flat `<name>.md` per agent, installed into `~/.claude/agents/` (user scope) or `<cwd>/.claude/agents/` (project scope), with the same safety model as `commands-install` (SHA-256 classification, ownership by absolute path, conflict refusal, `--force`, `--dry-run`, undo, uninstall, status and doctor). Agent frontmatter is read with an opt-in nested-YAML reader so nested `tools`/`hooks` blocks are preserved verbatim. No concrete agent ships in the bundled catalog (`agents: []`).

## Final State at Close

| Field    | Value                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verdict  | PASS WITH WARNINGS (see `verify-report.md`; no critical issues)                                                                                                                       |
| Delivery | 9 stacked PRs: #239, #240, #241, #242, #243, #246, #247, #248, #249 (the last one closes issue #42), plus verify follow-up PR #251 (merged in order after #249)                       |
| Warnings | Resolved by #251 and #249: W1 (stale README agents note, fixed in #249 itself), W3 and the kind-list suggestion (docs kind lists now include agents), and the five test-coverage gaps |
| Tests    | Full suite: 1459 tests passing at that point. Coverage threshold is CI-only and was not verified locally.                                                                             |
| Deferred | Follow-up issue #238 (multi-line block scalar `name`/`description` in agent frontmatter) is the only intentionally deferred item                                                      |
| Bundled  | No concrete agent ships (`agents: []`)                                                                                                                                                |

The final-state facts above outrank the stale snapshots in `apply-progress.md` and `verify-report.md`.

## Specs Synced

Delta requirements were merged by name into the main specs: MODIFIED requirements replace the existing block in place, ADDED requirements are appended; all other requirements are preserved.

| Domain           | Action  | Details                                                                                                                                                                                                            |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agents-install` | Created | New main spec (Purpose plus 7 requirements: install roots, plan classification, conflict/force/dry-run, undo and related). Delta `## ADDED Requirements` renamed to `## Requirements`, as `commands-install` does. |
| `catalog`        | Updated | MODIFIED: "Catalog layout and schema", "Profile extends". ADDED: "Agent catalog entries", "Opt-in nested frontmatter reader", "Trust copy for custom sources". 8 requirements became 11.                           |
| `catalog-list`   | Updated | MODIFIED: "Kind filter". ADDED: "Agents list shape". 8 requirements became 9.                                                                                                                                      |
| `install-status` | Updated | MODIFIED: "Manifest-driven read-only report", "Item states". ADDED: "Doctor findings for agents". 12 requirements became 13.                                                                                       |
| `item-uninstall` | Updated | MODIFIED: "Command surface", "Kind collision". ADDED: "Agent uninstall resolution". 9 requirements became 10.                                                                                                      |

## Archive Move

- Source: `openspec/changes/catalog-add-agents`
- Destination: `openspec/changes/archive/2026-11-17-catalog-add-agents`
- Method: `git mv` (whole folder, including exploration, proposal, specs, design, tasks, apply-progress, verify-report and this report)
- Naming: date prefix is the archive day, as in earlier archives
