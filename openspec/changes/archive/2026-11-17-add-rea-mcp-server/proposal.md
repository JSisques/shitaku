# Proposal: Add REA MCP Server to the Catalog (issue #225)

## Intent

Add the **REA (Reverse Engineer Anything)** MCP server to the bundled catalog (#225) so users can install it with `shitaku init` like any other MCP, instead of running `npx rea-agents setup`, which writes agent configuration outside shitaku's manifest, undo and status tracking. REA exposes reverse-engineering tools to the agent over stdio; native binary analysis requires an existing Hopper, Ghidra or IDA install, which the catalog description must state.

## Scope

### In Scope

- `catalog/mcps/rea.json`: stdio server, `command: "npx"`, `args: ["-y", "rea-agents@6.9.0", "mcp"]`, exact version pin, no `env` block, no placeholders or secrets. Shape mirrors `catalog/mcps/playwright.json`.
- One-line `description` that names the purpose and states that native analysis needs an existing Hopper, Ghidra or IDA install.
- Register `rea` in `catalog/catalog.json` -> `items.mcps` (append; order in that list is free-form).
- Update `test/adapters/catalog/bundled-catalog.test.ts` RED first: add `rea` to the exact bundled MCP name list, then add the catalog files (GREEN).
- Regenerate docs: `pnpm run docs:catalog` (README MCP table) then `pnpm run docs:website-catalog` (new `website/src/content/docs/{en,es}/catalog/mcps/rea.md`); verify with the matching `:check` scripts. Update the hand-kept, alphabetical `shitaku list` sample block in README if it enumerates MCPs.
- PR body notes: the package was checked against the official source (npm `rea-agents`, MIT, repository `morluto/rea`, bins `rea`/`rea-agents`), and the pin is `6.9.0` (npm `latest`) instead of the `6.5.0` written in the issue.

### Out of Scope

- The optional upstream REA skill.
- Adding `rea` to any profile (`base`, `web`, `backend`); profile tests assert exact MCP lists.
- Running or documenting `npx rea-agents setup`.
- Installing or detecting Hopper, Ghidra or IDA.
- Any `src/` change (domain, ports, application, adapters) or schema change.
- Floating version (`@latest`) or automated version bumps.

## Capabilities

Existing specs (`catalog`, `mcp-install`) do not enumerate bundled MCPs, so install and validation behavior need no delta. Following the bundled-skill precedent (`pr-writing-skill`, `docs-writing-skill`), the bundled entry gets its own capability.

### New Capabilities

- `rea-mcp-server`: catalog-bundled REA MCP entry: `items.mcps` listing, stdio server definition with the exact `rea-agents@6.9.0` pin and `mcp` subcommand, no env or secrets, description mentioning the Hopper/Ghidra/IDA prerequisite, exclusion from profiles, and installability acceptance through existing mcp-install.

### Modified Capabilities

None

## Approach

Catalog-data-only change following CONTRIBUTING "Adding to the catalog" and the `playwright.json` shape. Registration through a catalog entry keeps the server under shitaku's merge, manifest, undo and status model, which `rea-agents setup` would bypass. The exact pin (unlike the existing `@latest` entry) makes installs reproducible and reviewable; upgrades become explicit catalog PRs.

Strict TDD (`pnpm test`): extend the bundled-catalog exact list first and observe RED, add `rea.json` and the `catalog.json` entry (GREEN), then regenerate docs.

Delivery: one PR, two Conventional Commits:

1. `feat(catalog): add rea mcp server` (rea.json, catalog.json, test).
2. `docs: list rea mcp server in README and website` (generated README and website pages, README list sample).

## Affected Areas

Hexagonal layers: none. Catalog data, tests and generated docs only.

| Area                                                   | Impact   | Description                                |
| ------------------------------------------------------ | -------- | ------------------------------------------ |
| `catalog/mcps/rea.json`                                | New      | stdio server definition, exact pin         |
| `catalog/catalog.json`                                 | Modified | Append `rea` to `items.mcps`               |
| `test/adapters/catalog/bundled-catalog.test.ts`        | Modified | Exact bundled MCP name list                |
| `README.md`                                            | Modified | Generated MCP table; `shitaku list` sample |
| `website/src/content/docs/{en,es}/catalog/mcps/rea.md` | New      | Website pages (generated)                  |
| `catalog/profiles/*`                                   | None     | Untouched                                  |
| `src/`                                                 | None     | Untouched                                  |

## Risks

| Risk                                                     | Likelihood | Mitigation                                                                      |
| -------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| Pinned version drifts behind upstream                    | Med        | Intentional; bump via explicit catalog PR                                       |
| `mcp` subcommand or bin name changes in a future release | Low        | Exact pin isolates users; re-verify on bump                                     |
| Users expect native analysis without Hopper/Ghidra/IDA   | Med        | Description states the prerequisite                                             |
| Third-party package supply-chain risk via `npx -y`       | Low        | Exact pin, official source verified (npm, MIT, `morluto/rea`), noted in PR body |
| Docs CI drift (README/website out of sync)               | Med        | Run both generators in order and their `:check` scripts                         |
| Reviewers flag mismatch with issue text (6.5.0)          | Low        | PR body states the 6.9.0 deviation and its reason (npm `latest`, user decision) |

## Rollback Plan

Revert the PR (or its two commits): remove `catalog/mcps/rea.json`, the `catalog.json` entry, the test change, and the regenerated README/website pages (or rerun the docs scripts after revert). No `src/`, schema, manifest or migration impact. Users who already installed the server can run `shitaku undo` or remove the `rea` entry from their agent MCP configuration.

## Dependencies

- Existing `mcp-install` capability and catalog docs generators.
- External: npm package `rea-agents@6.9.0` (runtime only, fetched by `npx` on the user's machine; not a project dependency).

## Review Workload Forecast

Expected authored change well under 400 lines: ~10-line JSON file, 1-line catalog entry, a few test lines, a few README sample lines; generated README/website pages excluded. Single PR, two commits. 400-line budget risk: Low. Decision needed before apply: No. Chained PRs recommended: No.

## Success Criteria

- [ ] Bundled-catalog test lists `rea` in the exact MCP list and passes (observed RED first)
- [ ] `catalog/mcps/rea.json` validates: stdio, `npx`, args `["-y", "rea-agents@6.9.0", "mcp"]`, no `env`
- [ ] Description is one line and mentions Hopper, Ghidra or IDA
- [ ] `pnpm run build` then `node dist/main.js init --mcps rea --scope project --dry-run` plans the MCP from the bundled catalog
- [ ] Profiles unchanged; profile tests pass
- [ ] `docs:catalog:check` and the website catalog check pass
- [ ] No `src/` changes
- [ ] `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check` pass
- [ ] PR body records official-source verification and the 6.9.0 deviation from the issue
