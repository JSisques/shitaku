# Exploration: resolve skills declared by agents on `shitaku init` (#280)

Full report: Engram `sdd/resolve-agent-skills/explore` (project `shitaku`).

## Current state

- `parseAgent` (`src/domain/catalog/agent.ts`) validates only `name` and `description`; `skills:` is treated as an opaque key.
- `readBlockMapping` in `src/domain/catalog/frontmatter.ts` reads one-level mappings, not a top-level sequence. The module must stay import-free (portability test).
- `planInit` (`src/application/init-mcps.ts`) builds skill entries from `req.skills` only; `ChangePlan` has no warnings field.
- Every entry in `plan.skills` already gets backup, journal and undo via `applyPlan`.
- Bundled agents declaring skills: `docs-writer`, `pr-creator`, `socratic-challenger`.

## Approaches

1. Auto-add in `planInit`, visible in the plan with a reason, warning for missing skills (recommended).
2. Per-skill confirmation prompt (new port method, breaks `--yes` and scripting).
3. Warn only (does not meet the acceptance criteria).
4. Approach 1 plus a `--no-agent-skills` opt-out (possible follow-up).

## Recommendation

Approach 1. The plan and confirm gate are already the consent surface; resolving inside `planInit` keeps conflict-skip and hook-decline re-planning correct.

## Open items for the proposal

- Inline `skills: [a, b]` support versus multi-line only.
- Warn when a skill is absent from the catalog but already installed on disk.
- Warning channel (plan field printed by `printPlan`).
- Auto-added skills use the agent's scope; uninstalling an agent does not remove them.
- Design so #300 (MCPs required by an agent) can reuse the mechanism.
- #285 (profiles removal) is orthogonal; limit CONTRIBUTING edits to the agents section.

## Suggested slicing (400-line budget)

PR 1: frontmatter list reader and `AgentItem.skills`. PR 2: resolver, `planInit`, warnings, CLI output. PR 3: docs.
