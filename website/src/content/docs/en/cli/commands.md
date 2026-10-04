---
title: Commands
description: Full shitaku CLI command reference — init, undo, uninstall, status, list, doctor, version.
---

# Commands

After a global install the binary is `shitaku`. With `npx`, prefix every command with `npx @jsisques/shitaku`.

## `init`

Install MCP servers and skills from a catalog. Interactive by default; use flags to skip prompts.

```sh
shitaku init
shitaku init --mcps github,context7 --scope project --yes
shitaku init --skills example-skill --scope user --dry-run
```

Scopes: `project` writes MCPs to `./.mcp.json` and skills to `./.claude/skills/`; `user` writes MCPs to `~/.claude.json` and skills to `~/.claude/skills/` (close Claude Code first when writing `~/.claude.json`).

`--mcps` and `--skills` are independent and optional, but at least one kind must be selected. `--yes` skips confirmation and needs `--scope` plus at least one of `--mcps` / `--skills`. `--force` overwrites entries and skill directories that differ. `--source <folder>` reads a custom catalog instead of the bundled one.

Before changing a file, shitaku backs it up under `~/.claude/.shitaku/backups/` and records the install in `~/.claude/.shitaku/manifest.json`.

## `undo`

Restore the files changed by the last install (or a specific install id).

```sh
shitaku undo
shitaku undo --id <id> --force
shitaku undo --dry-run
```

Refuses (exit `3`) when a recorded file changed since the install unless `--force` is set.

## `uninstall`

Remove one installed MCP server or skill that shitaku owns. Never prompts.

```sh
shitaku uninstall github
shitaku uninstall github --scope user
shitaku uninstall demo --kind skill
shitaku uninstall github --dry-run
shitaku uninstall github --force
```

A name shitaku did not install exits `1` and writes nothing, even with `--force`. If the name matches several owned items, the command exits `1` and lists the candidates.

## `status`

Report what shitaku installed and whether it changed. Read-only; never writes.

```sh
shitaku status
shitaku status --scope project --json
shitaku status --source ./mine
```

| State                  | Meaning                                         |
| ---------------------- | ----------------------------------------------- |
| `installed`            | On disk, as installed, and equal to the catalog |
| `modified`             | Differs from what was installed                 |
| `out-of-date`          | Untouched, but the catalog has a newer version  |
| `missing`              | The MCP entry or skill directory is gone        |
| `missing-from-catalog` | No longer offered by the catalog                |
| `unknown`              | The catalog failed to load                      |

Exits `0` even when items drifted — inspect states (or JSON), not the exit code.

## `list`

Browse what a catalog offers. Read-only.

```sh
shitaku list
shitaku list mcps --search github
shitaku list skills --json
shitaku list profiles --source ./mine
```

Pass one kind (`mcps`, `skills`, or `profiles`, plural only) to narrow. `--search <text>` filters by name or description (case-insensitive).

## `doctor`

Diagnose installed items and suggest fixes. Read-only. Exits `4` when problems exist.

```sh
shitaku doctor
shitaku doctor --scope user --json
```

| Code                | Severity | Meaning                                                        |
| ------------------- | -------- | -------------------------------------------------------------- |
| `config-missing`    | problem  | A config file shitaku wrote is gone                            |
| `config-unreadable` | problem  | A config file cannot be read or parsed                         |
| `mcp-missing`       | problem  | The installed MCP entry is gone                                |
| `skill-missing`     | problem  | An installed skill directory is gone                           |
| `env-unset`         | problem  | A required `${VAR}` is unset (name only; values never printed) |
| `duplicate-mcp`     | problem  | Same MCP in user scope and project `.mcp.json`                 |
| `modified`          | info     | Item differs from what was installed                           |
| `out-of-date`       | info     | Catalog has a newer version                                    |

## `version`

Print the installed package version as bare semver on stdout.

```sh
shitaku version
shitaku -v
shitaku --version
```

There is no `-V` alias. These entry points do not run the update check.
