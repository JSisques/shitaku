# Exploration: catalog-add-hooks (issue #211)

Engram: `sdd/catalog-add-hooks/explore` (id 1471).

## Current state

- `src/domain/manifest.ts`: items are a discriminated union on kind (`mcp`, `skill`, `script`, `command`). `mcp` items live inside a JSON config file (path + name); the others are identified by `root`.
- `src/domain/json-merge.ts`: parse, mutate, `JSON.stringify` with detected indent and trailing newline. `mergeAtPath` / `removeAtPath` / `readAtPath` handle object keys only and throw `ConfigError` on arrays.
- MCP flow: plan classifies create/update/skip/conflict via `hashEntry`; `applyPlan` re-reads the file (`StaleFileError`), backs up, writes atomically, rolls back on failure, appends to the manifest. `settings.json` is not handled anywhere today.
- Commands kind (#202-#210) is the template; hooks touch the same ~40 places (domain, ports, adapters, application, generators, docs, tests).
- Undo is whole-file with `afterHash` drift check and backup restore, LIFO per file path. Any later edit to `settings.json` makes undo refuse (exit 3) unless `--force`.

## Ownership identity options

| Option                             | Pros                           | Cons                                                             |
| ---------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| Marker field on entry              | Exact lookup, survives edits   | Foreign key in user file; Claude Code may reject it (unverified) |
| Manifest hash + content match      | Clean file, reuses `hashEntry` | Edited entry seen as missing; identical entries ambiguous        |
| event + matcher + command identity | Readable                       | Same as above; changed command is a new identity                 |
| Marker in command string           | No extra keys                  | Shell-specific, visible, breaks non-shell types                  |
| Manifest group index only          | -                              | Fragile under reordering                                         |

## Merge / remove strategy

- New domain module `hook-merge.ts` (array-aware). Find/create event array, then matcher group by exact matcher; append handler unless deep-equal exists; never reorder.
- Remove by canonical equality; drop group/event only if we created it (manifest records "created").
- Formatting: `JSON.stringify` + indent detection (matches MCP path); `jsonc-parser` would give byte-preserving edits at the cost of a dependency. Undo restores byte-identical from backup either way.

## Concurrency

Claude Code also writes `settings.json`. Existing guards (re-read + hash, atomic write) leave a small window. Claude Code reportedly snapshots hooks at startup (unverified). Scopes: `~/.claude/settings.json`, `./.claude/settings.json`, `./.claude/settings.local.json`.

## Recommendation

Manifest identity + content match, no marker, `JSON.stringify` with indent detection. New `hook` manifest kind keyed by scope/settings path/event/matcher/hash; `AgentTarget.settingsPath(scope, paths)`; `hook-plan` module; audit all `kind === 'mcp'` branches. Stacked chain of 5-6 PRs: schema/loader/profile, hook-merge/manifest/plan, install/undo/uninstall, status/doctor, CLI/prompter, docs.

## Open product questions

1. Catalog hook file shape; can it reference or ship a script?
2. Project-scope target: `settings.json` or `settings.local.json`?
3. Mandatory confirmation even with `--yes`; allow hooks from `--source`?
4. One hook = one handler, or bundle of events?
5. Clean file vs. marker; edited hook reports "modified" or "missing"?
6. Profiles get a `hooks` array?

## Risks

Hooks execute shell commands (strongest trust risk); whole-file undo refusal on later edits; shared text file with no unique root; manifest backward compatibility; concurrent writes; generators/CI drift checks assume one section per kind.
