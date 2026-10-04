# shitaku

> Install a curated AI agent setup (MCP servers and skills) for Claude Code with one command.

> **shitaku** (支度, したく) is Japanese for "preparation" or "getting ready", like getting ready before you head out. shitaku gets your agent environment ready: MCP servers, skills and agents, installed in one go.

<!--
  Badges that are intentionally NOT here yet (add them when their dependency lands):
  TODO(website) (#78): website badge/link once the docs site exists (#52).
-->

<p align="center">
  <a href="https://www.npmjs.com/package/@jsisques/shitaku"><img alt="npm version" src="https://img.shields.io/npm/v/@jsisques/shitaku" /></a>
  <a href="https://www.npmjs.com/package/@jsisques/shitaku"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@jsisques/shitaku" /></a>
  <a href="https://github.com/JSisques/shitaku/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/JSisques/shitaku/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="package.json"><img alt="Node" src="https://img.shields.io/badge/node-%3E%3D22.13-339933?logo=node.js&logoColor=white" /></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <a href="CONTRIBUTING.md"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" /></a>
</p>

<!--
  TODO(demo) (#75): add a GIF or screenshot of `shitaku init` running here, e.g.
  ![shitaku init demo](docs/assets/demo.gif)
  Not recorded yet; do not embed a path that does not exist.
-->

## Quickstart

```sh
# 1. Pick MCPs and skills interactively and review the plan
npx @jsisques/shitaku init

# 2. Or install without prompts
npx @jsisques/shitaku init --mcps github,context7 --scope project --yes

# 3. Changed your mind? Restore the files changed by the last install
npx @jsisques/shitaku undo
```

Requires Node `>=22.13`. After a global install the command is just `shitaku`.

## Table of contents

- [Quickstart](#quickstart)
- [Why shitaku](#why-shitaku)
- [Catalog](#catalog)
- [Usage](#usage)
- [Version](#version)
- [Custom catalogs and trust](#custom-catalogs-and-trust)
- [Update notifications](#update-notifications)
- [Known limitation](#known-limitation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Development](#development)

## Why shitaku

Setting up an AI coding agent means hand-editing config files (`.mcp.json`, `~/.claude.json`, `~/.claude/skills/`) and repeating that on every machine and project. shitaku makes that setup portable and repeatable:

- **One command** installs MCP servers and skills from a curated catalog, at project or user scope.
- **Safe by default**: `--dry-run` previews the plan, conflicting entries are never overwritten silently, and secrets are written only as `${VAR}` placeholders, never as values.
- **Reversible**: every change is backed up and recorded, so `shitaku undo` restores the previous state.
- **Extensible**: point `--source` at your own catalog folder.

## Catalog

The bundled catalog lives in [`catalog/`](catalog/).

The tables below are generated from `catalog/` by `pnpm run docs:catalog`. Do not edit them by hand.

### MCP servers

<!-- catalog:mcps:start -->

| Name                       | Description                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atlassian`                | Official Atlassian Rovo remote MCP for Jira and Confluence; authenticate with Atlassian OAuth in the MCP client                                                                 |
| `brave-search`             | Official Brave Search MCP for current web results; requires BRAVE_API_KEY                                                                                                       |
| `cloudflare-bindings`      | Official Cloudflare Workers Bindings MCP for storage, AI and compute primitives; OAuth in the MCP client                                                                        |
| `cloudflare-docs`          | Official Cloudflare docs MCP for up-to-date product reference; authenticate with Cloudflare OAuth in the MCP client                                                             |
| `cloudflare-observability` | Official Cloudflare Workers Observability MCP for logs and analytics; OAuth in the MCP client                                                                                   |
| `context7`                 | Up-to-date library documentation for coding agents                                                                                                                              |
| `docker`                   | Local Docker containers, images and Compose stacks (can run and stop containers); requires Docker installed and running                                                         |
| `figma`                    | Official Figma remote MCP for design context, Code Connect and canvas write; authenticate with Figma OAuth in the MCP client (no desktop app; available on all seats and plans) |
| `github`                   | GitHub remote MCP server (repositories, issues, pull requests)                                                                                                                  |
| `notion`                   | Official Notion remote MCP for workspace search and page updates; authenticate with Notion OAuth in the MCP client                                                              |
| `playwright`               | Browser automation via accessibility snapshots, screenshots, console messages and viewport resizing; can interact with any page it opens                                        |
| `sqlite`                   | Inspect and query a local SQLite database file (can write); set SQLITE_DB_PATH; requires uvx (Astral uv)                                                                        |
| `supabase`                 | Official Supabase remote MCP for projects and database tools; OAuth in the MCP client; defaults to read-only (?read_only=true)                                                  |
| `vercel`                   | Official Vercel remote MCP for projects, deployments and logs; authenticate with Vercel OAuth in the MCP client (available on all plans)                                        |

<!-- catalog:mcps:end -->

### Skills

<!-- catalog:skills:start -->

| Name            | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `example-skill` | Minimal example skill that shows the catalog skill layout. |

<!-- catalog:skills:end -->

## Usage

```sh
# Interactive: pick MCPs, skills and scope, review the plan, confirm
npx @jsisques/shitaku init

# Non-interactive: no prompts
shitaku init --mcps github,context7 --scope project

# Skills only, or both kinds in one install (one --scope applies to both)
shitaku init --skills example-skill --scope project
shitaku init --mcps github --skills example-skill --scope project

# Preview only: prints the plan, writes nothing (no backups, no manifest)
shitaku init --mcps github --scope user --dry-run

# Restore the files changed by the last install
shitaku undo [--id <id>] [--force] [--dry-run]

# Browse what a catalog offers (read-only)
shitaku list [mcps|skills|profiles] [--search <text>] [--source <folder>] [--json]

# Remove one installed MCP or skill (undo reverts it)
shitaku uninstall <name> [--scope project|user] [--kind mcp|skill] [--force] [--dry-run]

# Report what shitaku installed and whether it changed (read-only)
shitaku status [--scope project|user] [--source <folder>] [--json]

# Diagnose installed items and suggest fixes (read-only, exits 4 on problems)
shitaku doctor [--scope project|user] [--source <folder>] [--json]

# Print the installed package version (bare semver on stdout)
shitaku version
shitaku -v
shitaku --version
```

Scopes: `project` writes MCPs to `./.mcp.json` and skills to `./.claude/skills/`; `user` writes MCPs to `~/.claude.json` and skills to `~/.claude/skills/` (close Claude Code first when writing `~/.claude.json`).

Flags for `init`: `--mcps <a,b>`, `--skills <a,b>`, `--scope project|user`, `--source <folder>`, `--dry-run`, `--yes` (skip confirmation, needs `--scope` and at least one of `--mcps`/`--skills`), `--force` (overwrite entries and skill directories that differ). `--mcps` and `--skills` are independent and optional, but at least one kind must be selected. Interactively, the skills prompt appears only when the catalog has skills.

Exit codes: `0` ok, `1` error, `2` unresolved conflicts (an existing entry with the same name differs; re-run with `--force`), `3` undo or uninstall refused because a file or item changed since the install (use `--force`), `4` `doctor` found problems.

Secrets are written only as `${VAR}` placeholders, never as values. The plan warns, by name, about required variables that are not set. Before changing a file, shitaku backs it up under `~/.claude/.shitaku/backups/` and records the install in `~/.claude/.shitaku/manifest.json`.

### Skills

A skill is a directory `catalog/skills/<name>/` that holds a `SKILL.md` and any supporting files (scripts, templates, binary assets). `SKILL.md` starts with frontmatter that has a single-line `name` (it must equal the directory name and match `^[a-z0-9][a-z0-9-]*$`) and a non-empty single-line `description`. List the skill under `items.skills` in `catalog/catalog.json`. A skill directory that is not listed, or a listed one that is missing or invalid, is skipped with a warning (an invalid name that could escape the directory, such as `../evil`, fails the whole catalog). The bundled `example-skill` shows the layout.

Install behavior: each skill is copied to `<scope skills dir>/<name>/`, with `SKILL.md` written last so a half-written skill never loads. The install is one entry in the manifest, together with any MCPs in the same run, and `shitaku undo` reverts both.

Safety:

- An existing directory with the same name is never overwritten silently. If it differs from the catalog version and shitaku did not install it (or it was modified since), it is reported as a conflict in the plan and `init` exits `2` without writing anything. Interactively you are asked per skill.
- `--force` replaces the whole directory (files that are not in the catalog version are deleted) after backing every replaced file up under `~/.claude/.shitaku/backups/`. `undo` restores them byte for byte.
- If a write fails, everything written so far is rolled back and the directories the install created are removed. Backups stay on disk.
- `undo` refuses (exit `3`) when a recorded file changed, or when you added a file under a skill directory, since the install. `--force` restores the recorded files and leaves unknown files alone. Directories that the install created are removed only when empty.
- Skill symlinks (the directory, a file inside it, or a catalog file) are rejected, and the catalog and target trees are walked with limits on file count, depth, per-file size and total size.

Before downgrading shitaku to a version without skills support, run `shitaku undo` for any install that included skills: older versions do not understand skill entries in the manifest. The same applies to `shitaku uninstall`: older versions reject the `remove` entries it records, so undo any uninstall before downgrading.

Limits: skills are copied as plain files, so shitaku does not run, lint or sandbox them. There is no profile selection on the CLI yet.

### Uninstall

`shitaku uninstall <name>` removes one MCP server or skill that shitaku installed. It never prompts, and it only touches items shitaku owns (see `shitaku status`): a name shitaku did not install exits `1` and nothing is written, even with `--force`.

```sh
shitaku uninstall github                      # scope inferred when the name is owned in one scope
shitaku uninstall github --scope user         # narrow when it is owned in both
shitaku uninstall demo --kind skill           # resolve a name that is both an MCP and a skill
shitaku uninstall github --dry-run            # print the plan, write nothing
shitaku uninstall github --force              # remove even if the item changed since the install
```

Flags: `--scope project|user`, `--kind mcp|skill`, `--dry-run`, `--force`. If the name matches several owned items, the command exits `1` and lists the candidates (kind and scope).

Exit codes: `0` removed, already absent or dry run; `1` error (not installed, ambiguous, corrupt manifest); `3` refused because the item changed since the install. Refusal prints `changed since install: <path>` and a `--force` hint, writes nothing, and also applies to `--dry-run`, so a dry run reports exactly what a real run would do.

Behavior:

- An MCP is removed by deleting only its entry from the config file; other servers, key order and formatting are kept. A skill has its recorded files deleted (`SKILL.md` first) and its directory removed once empty. With `--force`, files you added to a skill directory are kept, and so is the directory.
- Every file is backed up first, and the removal is recorded as an install, so `shitaku undo` restores the previous bytes and `shitaku status` lists the item again. Undo is last-in first-out: undo the uninstall before undoing the install it removed.
- Undoing an MCP uninstall compares the whole config file, so `undo` refuses (exit `3`) if you edited that file after the uninstall; `--force` restores it anyway.
- An item that is owned but already gone is reported as already absent and nothing is written.
- For user-scope MCPs, close Claude Code first: it may rewrite `~/.claude.json` while running.

### Status

`shitaku status` lists every item shitaku installed and has not undone, in both scopes unless `--scope` is given, and never writes anything. The text output is grouped by scope, then by kind (`mcps`, `skills`), and each item shows its name, state and path:

```
target: claude-code
project scope:
  mcps:
    github: installed  /work/app/.mcp.json
  skills:
    example-skill: modified  /work/app/.claude/skills/example-skill
```

In `--json` every item carries `kind` instead. For an MCP only its own entry is compared, so other changes to `~/.claude.json` do not matter.

| State                  | Meaning                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `installed`            | on disk, as installed, and equal to the catalog                                      |
| `modified`             | differs from what was installed; also an unreadable config file or a skill symlink   |
| `out-of-date`          | untouched, but the catalog has a newer version                                       |
| `missing`              | the MCP entry or skill directory is gone                                             |
| `missing-from-catalog` | no longer offered by the catalog                                                     |
| `unknown`              | the catalog failed to load, so `installed`, `out-of-date` and removal cannot be told |

`modified` wins over `out-of-date`, and `missing` wins over everything. When the catalog cannot be loaded, the header says `catalog unavailable` and local drift (`missing`, `modified`) is still reported.

`--json` prints one document, `{ "version": 1, "target", "catalog": "available" | "unavailable", "items": [{ "scope", "kind", "name", "state", "path", "installId" }] }`. Later changes to its shape are additive. Catalog warnings go to stderr, so stdout is always valid JSON.

`status` exits `0` whenever it runs, even when items drifted, so check the states (or the JSON) rather than the exit code. A corrupt manifest prints an `error:` and exits `1`; the same now holds for `init` and `undo`.

Limitation: `status` compares against the bundled catalog unless you pass `--source`. An item installed with `init --source ./mine` shows as `missing-from-catalog` (or `out-of-date`) unless you run `status --source ./mine`.

### List

`shitaku list` shows what a catalog offers and never writes anything. Pass one kind (`mcps`, `skills` or `profiles`, plural only) to narrow it; without one all three kinds are listed. `--search <text>` keeps items whose name or description contains the text, ignoring case, and combines with the kind. `--source <folder>` lists a custom catalog instead of the bundled one.

The text output is grouped by kind (`mcps`, `profiles`, `skills`), sorted by name, with one aligned name column. Descriptions are collapsed onto one line, and a profile without a description prints its name only:

```
mcps:
  atlassian                 Official Atlassian Rovo remote MCP for Jira and Confluence; authenticate with Atlassian OAuth in the MCP client
  brave-search              Official Brave Search MCP for current web results; requires BRAVE_API_KEY
  cloudflare-bindings       Official Cloudflare Workers Bindings MCP for storage, AI and compute primitives; OAuth in the MCP client
  cloudflare-docs           Official Cloudflare docs MCP for up-to-date product reference; authenticate with Cloudflare OAuth in the MCP client
  cloudflare-observability  Official Cloudflare Workers Observability MCP for logs and analytics; OAuth in the MCP client
  context7                  Up-to-date library documentation for coding agents
  docker                    Local Docker containers, images and Compose stacks (can run and stop containers); requires Docker installed and running
  figma                     Official Figma remote MCP for design context, Code Connect and canvas write; authenticate with Figma OAuth in the MCP client (no desktop app; available on all seats and plans)
  github                    GitHub remote MCP server (repositories, issues, pull requests)
  notion                    Official Notion remote MCP for workspace search and page updates; authenticate with Notion OAuth in the MCP client
  playwright                Browser automation via accessibility snapshots, screenshots, console messages and viewport resizing; can interact with any page it opens
  sqlite                    Inspect and query a local SQLite database file (can write); set SQLITE_DB_PATH; requires uvx (Astral uv)
  supabase                  Official Supabase remote MCP for projects and database tools; OAuth in the MCP client; defaults to read-only (?read_only=true)
  vercel                    Official Vercel remote MCP for projects, deployments and logs; authenticate with Vercel OAuth in the MCP client (available on all plans)
profiles:
  backend                   Backend development
  base                      Essentials for any project
  web                       Web development
skills:
  example-skill             Minimal example skill that shows the catalog skill layout.
```

When nothing matches it prints `no matching items`.

`--json` prints one document, `{ "version": 1, "items": [{ "kind", "name", "description" }] }`. Later changes to its shape are additive.

| Field         | Type           | Notes                                                 |
| ------------- | -------------- | ----------------------------------------------------- |
| `version`     | number         | Always `1`                                            |
| `kind`        | string         | `mcp`, `profile` or `skill` (singular, like `status`) |
| `name`        | string         | Item name                                             |
| `description` | string or null | Raw text; `null` for a profile without one            |

`items` is flat and sorted by kind, then name; an empty result is `"items": []`. Whitespace in descriptions is collapsed only in text mode.

Invalid skills, MCPs and profiles are skipped with a `warning: skipped <file>: <reason>` line on stderr (in both modes), so stdout stays valid JSON. Exit codes: `0` ok, including no matches; `1` for an invalid kind or a catalog that cannot be loaded (`error: cannot load catalog from <where>: <message>`).

### Doctor

`shitaku doctor` checks everything shitaku installed and has not undone, in both scopes unless `--scope` is given, and never writes anything. Each finding has a message and a suggested fix; the output ends with a count of problems and info findings:

```
target: claude-code
problems:
  project mcp github: GITHUB_TOKEN is not set in the current environment
    fix: export GITHUB_TOKEN before starting your agent
info:
  project skill example-skill: modified since install  /work/app/.claude/skills/example-skill
1 problems, 1 info
```

A healthy setup prints `no problems found`. Problems depend only on the manifest, the installed files and your environment, never on the catalog.

| Code                | Severity | Meaning                                                                                            |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `config-missing`    | problem  | a config file shitaku wrote is gone (one finding per file)                                         |
| `config-unreadable` | problem  | a config file exists but cannot be read or parsed (one finding per file)                           |
| `mcp-missing`       | problem  | the config file is fine but the installed MCP entry is gone                                        |
| `skill-missing`     | problem  | an installed skill directory is gone                                                               |
| `env-unset`         | problem  | an installed entry needs `${VAR}` (no default) and `VAR` is unset or empty; only the name is shown |
| `duplicate-mcp`     | problem  | the same MCP is in both user scope and the current project's `.mcp.json`                           |
| `modified`          | info     | the item differs from what was installed                                                           |
| `out-of-date`       | info     | untouched, but the catalog has a newer version                                                     |

`--json` prints one document, `{ "version": 1, "target", "healthy", "summary": { "problems", "info" }, "findings": [{ "severity", "code", "scope", "kind", "name", "path", "variable"?, "message", "fix" }] }`. `name` is `null` for `config-*` findings and `variable` appears only for `env-unset`. Later changes to its shape are additive.

The catalog is loaded only to find `out-of-date` items. If it cannot be loaded, a warning goes to stderr (so stdout stays valid JSON), `out-of-date` is skipped, and the exit code is unchanged. Environment values are never printed.

Exit codes: `0` no problems (info findings allowed), `4` at least one problem, `1` error, including a corrupt manifest.

### Version

`shitaku version`, `shitaku -v`, and `shitaku --version` print the installed package version as bare semver on stdout (for example `0.2.0`) and exit `0`. There is no `-V` alias. If the version cannot be determined, they print `Unable to determine shitaku version.` on stderr and exit `1`. These entry points do not run the update check.

### Custom catalogs and trust

`--source <folder>` reads a catalog from a folder instead of the bundled one. Treat it as code you run: stdio entries in a catalog are written to your config and Claude Code executes their `command` later. Skills from a `--source` folder are copied into your skills directory, and Claude Code may follow their instructions or run their scripts. Only use folders you trust.

### Update notifications

After a command finishes, shitaku prints one line on stderr when a newer version is published on npm:

```
Update available: shitaku 0.2.0 -> 0.3.0. Run: npm install -g @jsisques/shitaku
```

The registry is asked at most once every 24 hours (the answer is cached in `~/.claude/.shitaku/update-check.json`) and the lookup gives up after 1.5 seconds, so offline runs are never blocked. stdout is never touched, so `status --json` stays valid JSON, and the exit code does not change.

The check is skipped entirely when `CI` is set to a non-empty value, when stdout or stderr is not a terminal, when `SHITAKU_NO_UPDATE_CHECK` is `1`, `true` or `yes` (case-insensitive), or when the command is `version` / `-v` / `--version`. No request is made and nothing is written in those cases.

### Known limitation

Whether `${VAR}` placeholders are expanded in user-scope `~/.claude.json` entries is unverified. For entries with env placeholders (for example `github`), prefer project scope (`.mcp.json`).

## Roadmap

Planned work and open ideas are tracked as [GitHub issues](https://github.com/JSisques/shitaku/issues).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide (setup, adding catalog items, commits, PRs).

```sh
pnpm install
pnpm run typecheck
pnpm run lint          # ESLint (typescript-eslint, type-aware); `lint:fix` applies autofixes
pnpm test
pnpm run build
pnpm run format        # rewrite files with Prettier
pnpm run format:check  # fail if any file is not formatted
```

This project uses pnpm, pinned through the `packageManager` field. Run `corepack enable` once so the pinned version is used automatically (Node 25+ no longer bundles Corepack: run `npm i -g corepack` first). Without Corepack, `npm i -g pnpm@10` also works. If a global pnpm is already installed, skip Corepack (or remove the global pnpm first), because installing Corepack globally can conflict with its binary. `npm install` is not supported for development.

Tests never touch the real home directory; see `test/setup.ts`.

Contributors need Node `>=22.22.1` (`nvm use` reads `.nvmrc`). Git hooks are installed by `pnpm install` (via Husky):

| Hook         | Runs                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `pre-commit` | ESLint then Prettier on staged `ts`/`mjs`/`js` files, Prettier on the rest (lint-staged)               |
| `commit-msg` | commitlint with Conventional Commits                                                                   |
| `pre-push`   | `pnpm run typecheck`, `pnpm run test:changed` (only tests affected vs `origin/main`), `pnpm run build` |

Bypass hooks with `git commit --no-verify`, `git push --no-verify`, or `HUSKY=0`.

Exception: `pnpm run smoke:pack` (`scripts/smoke-pack.mjs`) intentionally keeps using `npm pack` and `npm install`, because it simulates how consumers install the published package.

### Releasing

Releases are manual: a maintainer dispatches the `CD` workflow on `main`. See [docs/releasing.md](docs/releasing.md) for the bootstrap, dry runs and failure recovery.
