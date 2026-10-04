---
title: Flags
description: Flags for shitaku init, undo, uninstall, status, list, and doctor.
---

# Flags

## Shared

| Flag                    | Commands                                | Meaning                                                     |
| ----------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `--scope project\|user` | `init`, `uninstall`, `status`, `doctor` | Target project or user config                               |
| `--source <folder>`     | `init`, `status`, `list`, `doctor`      | Custom catalog folder instead of bundled                    |
| `--dry-run`             | `init`, `undo`, `uninstall`             | Print the plan; write nothing                               |
| `--force`               | `init`, `undo`, `uninstall`             | Overwrite / proceed despite drift                           |
| `--json`                | `status`, `list`, `doctor`              | Machine-readable stdout                                     |
| `--yes`                 | `init`                                  | Skip confirmation (needs `--scope` and `--mcps`/`--skills`) |

## `init`

| Flag             | Meaning                     |
| ---------------- | --------------------------- |
| `--mcps <a,b>`   | Comma-separated MCP names   |
| `--skills <a,b>` | Comma-separated skill names |

## `undo`

| Flag        | Meaning                                       |
| ----------- | --------------------------------------------- |
| `--id <id>` | Undo a specific install instead of the latest |

## `uninstall`

| Flag                | Meaning                                 |
| ------------------- | --------------------------------------- |
| `--kind mcp\|skill` | Disambiguate when a name exists as both |

## `list`

| Flag              | Meaning                                                |
| ----------------- | ------------------------------------------------------ |
| `--search <text>` | Keep items whose name or description contains the text |

## Version shortcuts

`-v` and `--version` are aliases of `version`. There is no `-V`.
