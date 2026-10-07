---
title: Security
description: Secrets, placeholders, backups, and trust boundaries for shitaku.
---

# Security

## Secrets

Secrets are written only as `${VAR}` placeholders, never as values. The plan warns, by name, about required variables that are not set. Environment values are never printed by `doctor` or other commands.

## Custom catalogs

`--source <folder>` reads a catalog from a folder instead of the bundled one. Treat it as code you run: stdio entries are written to your config and Claude Code executes their `command` later. Skills from a `--source` folder are copied into your skills directory, slash commands into your commands directory, and hooks into your Claude Code settings, where they run commands with your full user permissions. Only use folders you trust.

## Backups and undo

Before changing a file, shitaku backs it up under `~/.claude/.shitaku/backups/` and records the install in `~/.claude/.shitaku/manifest.json`. `shitaku undo` restores the previous state. `uninstall` removals are also recorded so undo can reverse them.

## Skills safety

- Existing skill directories are never overwritten silently without conflict reporting or `--force`.
- Skill symlinks are rejected.
- Catalog and target trees are walked with limits on file count, depth, per-file size, and total size.
- Skills are copied as plain files; shitaku does not run, lint, or sandbox them.

## Slash commands safety

- A command file that differs from the catalog and was not installed by shitaku is a conflict; it is replaced only with `--force`, after a backup that `undo` restores.
- Only the named `<name>.md` file is written, never its neighbors in `commands/`. Symlinks are rejected.
- Claude Code treats a command's text as instructions when you run `/<name>`; shitaku does not run, lint, or sandbox it. Read commands from a `--source` folder first.

## Hooks safety

- A hook command runs with your full user permissions, whenever Claude Code fires its event. shitaku never runs it, but it writes it into a file Claude Code executes.
- Hooks must not contain literal secrets; use `${VAR}` references. The catalog check is a heuristic (known token shapes and `NAME=value` credentials), so it cannot prove a command is clean. Review commands yourself.
- Hooks from a `--source` folder follow the same trust model and the same confirmation as bundled ones. Only use folders you trust.
- `init` shows the exact event, matcher and command and asks you to confirm. `--yes` is not consent: without `--allow-hooks` a non-interactive run writes nothing and exits `1`.
- Project hooks live in `./.claude/settings.json`. If you commit it, they run for every collaborator who opens the project.
- shitaku touches only `settings.json` (never `settings.local.json`, managed settings or plugin hooks), writes no marker into it, and finds its hooks again by exact content. Settings must be strict JSON: comments or trailing commas are refused with the file named, and nothing is written.
- An edited hook no longer matches: `status` reports it `missing` (`doctor` code `hook-missing`) and `uninstall` reports it already absent.
- `undo` restores the original bytes. If the file changed afterwards it refuses (exit `3`); with `--force` it removes only the handlers shitaku installed and keeps everything else.
- Claude Code reloads hooks live and may write `settings.json` itself, for example from `/config`. shitaku re-reads the file before writing, aborts if it changed, backs it up and writes atomically; still, avoid `/config` while an install or undo runs.
- Older shitaku versions throw a `ManifestError` on a manifest entry with `kind: 'hook'`: run `undo` or `uninstall` before downgrading.

## Profiles

Profiles appear in `list` and on this site for browsing. The CLI cannot select a profile yet — they are not installable by name.
