---
title: Security
description: Secrets, placeholders, backups, and trust boundaries for shitaku.
---

# Security

## Secrets

Secrets are written only as `${VAR}` placeholders, never as values. The plan warns, by name, about required variables that are not set. Environment values are never printed by `doctor` or other commands.

## Custom catalogs

`--source <folder>` reads a catalog from a folder instead of the bundled one. Treat it as code you run: stdio entries are written to your config and Claude Code executes their `command` later. Skills from a `--source` folder are copied into your skills directory, and slash commands into your commands directory. Only use folders you trust.

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

## Profiles

Profiles appear in `list` and on this site for browsing. The CLI cannot select a profile yet — they are not installable by name.
