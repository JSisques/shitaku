# Exploration: add-socratic-challenger-agent (issue #183)

## Current state

- One bundled agent exists: `catalog/agents/pr-creator.md`, registered in `catalog/catalog.json` as `items.agents`.
- `parseAgent` (`src/domain/catalog/agent.ts`) validates only `name` (equals file stem), a required `description`, and a non-empty body. Other frontmatter keys, including `skills`, pass through. No schema change is needed.
- There is no skill dependency mechanism: neither `catalog.json` nor `AgentItem` has a `requires` or `skills` field, and init installs only the requested names per kind. Installing the agent does not install `socratic-method`.
- `pr-creator` documents its skill requirement in the description and in a `## Requirements` body section that tells the agent to stop and report if the skill is missing.
- `catalog/skills/socratic-method/SKILL.md` has a fixed, question-first tone and no tone switch, so there is no "installed tone" mechanism to respect.

## Affected areas

- NEW `catalog/agents/socratic-challenger.md`.
- `catalog/catalog.json`: `items.agents` gains `socratic-challenger`.
- Generated docs: README catalog table (`pnpm run docs:catalog`) and website pages en/es (`pnpm run docs:website-catalog`).
- `test/adapters/catalog/bundled-catalog.test.ts`: three hard-coded `['pr-creator']` assertions must change; add a content-contract test mirroring the `pr-creator` one.
- `CONTRIBUTING.md`: wording that says the catalog ships one agent becomes stale.
- No changes in `src/` or `catalog/profiles`.

## Gaps vs acceptance criteria

1. "Install or clearly require the skill": the installer cannot auto-install it; follow the `pr-creator` pattern (description + Requirements section).
2. "Respect the installed tone": reword as following the `socratic-method` skill's rules and tone.
3. Edit/Write only for the Q&A log: `tools` is unvalidated, so enforcement is prompt wording plus a contract test.
4. Description must avoid `: ` and quotes to stay a valid plain scalar.

## Approaches

| Approach                                  | Pros                                 | Cons                                | Effort |
| ----------------------------------------- | ------------------------------------ | ----------------------------------- | ------ |
| A. Content only, requirement documented   | Matches `pr-creator`; no code change | Skill not auto-installed            | Low    |
| B. New dependency field with auto-install | Robust                               | Cross-cutting feature, out of scope | High   |

## Recommendation

Approach A. Optionally open a follow-up issue for agent-to-skill dependency resolution. Strict TDD: update the bundled-catalog test first (RED), then add the file and registration, then regenerate docs.

## Risks

- Hard-coded test arrays break until updated.
- Stale generated docs fail CI.
- Edit/Write restriction is prompt-only.
- Without `socratic-method` installed, the `skills` preload silently does nothing; the stop-and-report instruction mitigates it.
