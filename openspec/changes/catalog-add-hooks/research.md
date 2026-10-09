# Research: catalog-add-hooks (gentle-ai.sdd-research/v1)

```yaml
request_id: rr-catalog-add-hooks-1
revision: 1
outcome: partial
accessed_at: 2026-10-07
source_class: documentation
```

## Questions

1. Hooks schema and matcher semantics.
2. Unknown-key tolerance.
3. Startup snapshot / hot reload.
4. Scopes, precedence, dedup.
5. How Claude Code writes settings.json; concurrency.
6. Security guidance.

## Sources

| ID  | Class         | Title                         | Publisher | URL                                               | Excerpt                                                                                                                                                                                                                                                 |
| --- | ------------- | ----------------------------- | --------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | documentation | Hooks reference               | Anthropic | https://code.claude.com/docs/en/hooks             | "`"*"`, `""`, or omitted: Match all"; handler type is command, http, mcp_tool, prompt or agent; "If the same handler is defined in multiple settings files, it runs once"; "Command hooks execute shell commands with your full user permissions."      |
| S2  | documentation | Settings files and precedence | Anthropic | https://code.claude.com/docs/en/settings          | "Settings files are strict JSON: a `//` comment or a trailing comma is a syntax error"; unknown hook event name: Claude Code skips the value and keeps the rest of the file; file watcher reloads edits to `hooks`; list keys are combined across files |
| S3  | documentation | Debug your configuration      | Anthropic | https://code.claude.com/docs/en/debug-your-config | A `matcher` array is an invalid setting; under `PreToolUse`/`PermissionRequest` none of that file's other hooks load; edits take effect in the running session without restart                                                                          |

(S4, hooks-guide, returned only a page header; no claims rely on it.)

## Claims

- C1 (S1): structure is `hooks.<Event>[] = { matcher?, hooks: [ {type, ...} ] }`.
- C3 (S1): matcher `"*"`, `""` or omitted matches all; simple strings are exact or `|`/`,` lists; anything else is an unanchored JS regex.
- C4/C5 (S1): handler fields: `type`, `if`, `timeout`, `statusMessage`; command adds `command`, `args`, `async`, `asyncRewake`, `shell`.
- C8 (S3): user/project hooks live under the `hooks` key of settings.json; only plugins use `hooks/hooks.json`.
- C9 (S2): unknown hook event name yields a warning and the entry is skipped.
- C10 (S2): invalid JSON yields a Settings Error (dialog interactively; silent skip with `-p`).
- C11 (S3): array-typed matcher is invalid and, under PreToolUse/PermissionRequest, drops all of that file's hooks.
- C13 (S2, S3): edits to `hooks` apply live via a file watcher; no documented review prompt.
- C16-C18 (S1, S2): precedence managed > CLI > settings.local.json > settings.json > ~/.claude/settings.json; hooks merge across scopes; identical handler across files runs once.
- C19 (S1, S2): interactive sessions hold back hooks until workspace trust is accepted.
- C21 (S2): Claude Code writes settings.json on `/config` changes and settings.local.json on standing permission approvals.
- C23-C25 (S1): command hooks run with full user permissions; documented best practices: sanitize input, quote variables, absolute paths, `${CLAUDE_PROJECT_DIR}`.

## Gaps and uncertainty

- Whether an unknown key inside a handler object is rejected or ignored is undocumented (Q2 partial).
- How Claude Code writes settings.json (atomic or not) and any locking guidance is undocumented (Q5 partial).
- settings-reference page not fetched; hooks reference read only partially.

## Revision 2 (outcome: partial, documentation only)

Additional sources (Anthropic, accessed 2026-10-07): S8 hooks-guide, S9 https://code.claude.com/docs/en/managed-settings, S10 https://code.claude.com/docs/en/settings-reference. S11 claude-directory was fetched but not searchable.

- Q2: no page states whether an unknown key inside a handler or matcher-group object is rejected, warned on or ignored. Documented adjacent behavior: unknown hook event name is skipped with a warning (S5, S9); the settings schema "can lag behind the newest CLI releases" (S5).
- Q5: reload after a brief file-stability delay, the watcher may miss changes (`/hooks` or restart as remedy) (S6, S8). Claude Code's own write mechanism (atomic, temp file, lock) and concurrent-edit guidance are undocumented.
- Limits: no documented maximum number of hooks, groups or handlers.
- Residual uncertainty: Q2 and Q5 are "documented as absent", not proof of runtime behavior; only an empirical test or the published schema would settle them (outside the `documentation` class).

## Product choices

None recorded here; product decisions are separate and non-authoritative.
