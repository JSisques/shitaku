---
title: Exit codes
description: Process exit codes returned by the shitaku CLI.
---

# Exit codes

| Code | Meaning                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------- |
| `0`  | Ok (also `status` when items drifted; also `list` with no matches; also `doctor` with only info findings) |
| `1`  | Error (invalid args, corrupt manifest, not installed, ambiguous uninstall, catalog load failure)          |
| `2`  | Unresolved conflicts during `init` (existing entry differs; re-run with `--force`)                        |
| `3`  | `undo` or `uninstall` refused because a file or item changed since the install (use `--force`)            |
| `4`  | `doctor` found at least one problem                                                                       |

Update notifications on stderr never change the exit code.
