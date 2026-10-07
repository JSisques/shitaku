---
title: Commands
description: Full shitaku CLI command reference — init, undo, uninstall, status, list, doctor, version, with slash command support.
---

# Commands

After a global install the binary is `shitaku`. With `npx`, prefix every command with `npx @jsisques/shitaku`.

## `init`

Install MCP servers, skills, slash commands and hooks from a catalog. Interactive by default; use flags to skip prompts.

```sh
shitaku init
shitaku init --mcps github,context7 --scope project --yes
shitaku init --skills example-skill --scope user --dry-run
shitaku init --commands review --scope project
shitaku init --hooks fmt --scope project
shitaku init --hooks fmt --scope project --yes --allow-hooks
```

Scopes: `project` writes MCPs to `./.mcp.json` and skills to `./.claude/skills/`; `user` writes MCPs to `~/.claude.json` and skills to `~/.claude/skills/` (close Claude Code first when writing `~/.claude.json`). Slash commands are single files written flat to `./.claude/commands/` (`project`) or `~/.claude/commands/` (`user`). Hooks are merged into `./.claude/settings.json` (`project`) or `~/.claude/settings.json` (`user`).

`--mcps`, `--skills`, `--commands` and `--hooks` are independent and optional, but at least one kind must be selected. `--yes` skips confirmation and needs `--scope` plus at least one of them. `--force` overwrites entries, command files and skill directories that differ; a command file that differs and was not installed by shitaku is a conflict (exit `2`) without `--force`, and `--force` backs it up first. `--source <folder>` reads a custom catalog instead of the bundled one.

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

Remove one installed MCP server, skill, slash command or hook that shitaku owns. Never prompts.

```sh
shitaku uninstall github
shitaku uninstall github --scope user
shitaku uninstall demo --kind skill
shitaku uninstall review --kind command
shitaku uninstall fmt --kind hook
shitaku uninstall github --dry-run
shitaku uninstall github --force
```

A name shitaku did not install exits `1` and writes nothing, even with `--force`. If the name matches several owned items, the command exits `1` and lists the candidates.

## Slash commands

A slash command is a Markdown file that Claude Code runs as `/<name>`; it is not a shitaku CLI subcommand. The bundled catalog ships none yet. Each one is a catalog page under [Catalog](/en/catalog/overview/). Before downgrading shitaku, run `shitaku undo` for installs that included commands: older versions throw a `ManifestError` on a manifest entry with `kind: 'command'`.

## Hooks

A hook adds one Claude Code `command` handler to the `hooks` key of a `settings.json`. Hooks run commands with your full user permissions, so `init` always shows the exact event, matcher and command and asks you to confirm. Read [Security](/en/security/#hooks-safety) before installing one. The bundled catalog ships none yet.

```sh
shitaku list hooks
shitaku init --hooks fmt --scope project --dry-run
shitaku init --hooks fmt --scope project --allow-hooks
shitaku uninstall fmt --kind hook
```

- `--yes` is not consent. Without `--allow-hooks`, a non-interactive run prints the commands on stderr, exits `1` and writes nothing. `--allow-hooks` is the only way to skip the confirmation; `--dry-run` prints the commands and never prompts.
- `list hooks` shows the hooks of the catalog; with none it prints `no matching items` and exits `0`.
- `uninstall <name> --kind hook` removes only that handler, matched by exact content. A hook you edited reads as already absent.
- Before downgrading shitaku, run `shitaku undo` or `shitaku uninstall` for installs that included hooks: older versions throw a `ManifestError` on a manifest entry with `kind: 'hook'`.

## `status`

Report what shitaku installed and whether it changed. Read-only; never writes.

```sh
shitaku status
shitaku status --scope project --json
shitaku status --source ./mine
```

| State                  | Meaning                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `installed`            | On disk, as installed, and equal to the catalog                      |
| `modified`             | Differs from what was installed                                      |
| `out-of-date`          | Untouched, but the catalog has a newer version                       |
| `missing`              | The MCP entry, hook handler, skill directory or command file is gone |
| `missing-from-catalog` | No longer offered by the catalog                                     |
| `unknown`              | The catalog failed to load                                           |

Exits `0` even when items drifted — inspect states (or JSON), not the exit code.

## `list`

Browse what a catalog offers. Read-only.

```sh
shitaku list
shitaku list mcps --search github
shitaku list skills --json
shitaku list profiles --source ./mine
shitaku list commands
shitaku list hooks
```

Pass one kind (`mcps`, `skills`, `profiles`, `scripts`, `commands` or `hooks`, plural only) to narrow. `--search <text>` filters by name or description (case-insensitive).

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
| `command-missing`   | problem  | An installed slash command file is gone                        |
| `hook-missing`      | problem  | The installed hook handler is gone or was edited               |
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
