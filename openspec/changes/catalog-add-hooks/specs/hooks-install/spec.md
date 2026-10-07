# Hooks Install Specification

## Purpose

Plan, apply, and undo Claude Code hooks (the `hook` kind): one `type: command` handler per catalog file, merged into the `hooks` key of a Claude Code `settings.json` without disturbing anything the user owns.

## Requirements

### Requirement: Hook catalog format

A hook is one file in `catalog/hooks/` listed in `items.hooks`. It MUST declare a non-empty `name` (equal to the file stem, matching `^[a-z0-9][a-z0-9-]*$`), a non-empty `description`, `event`, a non-empty `command`, and MAY declare `matcher` (string) and `timeout` (positive number). The handler type MUST be `command`; any other handler type, multiple handlers in one file, or unknown fields MUST be rejected. `command` MAY reference a catalog script. A `command` or `matcher` containing a literal secret MUST be rejected; `${VAR}` placeholders are allowed.

#### Scenario: Valid hook

- GIVEN `hooks/fmt.json` with `event: PostToolUse`, `matcher: Edit|Write`, `command`, `timeout: 30`
- WHEN the catalog is loaded
- THEN hook `fmt` is available

#### Scenario: Invalid hook

- GIVEN a hook with an empty `command`, a non-`command` type, two handlers, or a bad name
- WHEN loaded
- THEN an error names the file and reason and the hook is not installable

#### Scenario: Literal secret

- GIVEN a `command` containing a literal token
- WHEN validated
- THEN the hook is rejected as containing a secret literal

### Requirement: Settings targets

User scope MUST target `~/.claude/settings.json`; project scope MUST target `<cwd>/.claude/settings.json`. `settings.local.json`, managed settings, and plugin `hooks/hooks.json` MUST NOT be touched.

#### Scenario: Scope roots

- GIVEN hook `fmt` and `--scope user` or `--scope project`
- WHEN init applies it
- THEN the handler is present in `~/.claude/settings.json` or `<cwd>/.claude/settings.json` respectively

#### Scenario: Local settings untouched

- GIVEN `.claude/settings.local.json` exists
- WHEN init installs a project-scope hook
- THEN `settings.local.json` is byte-identical afterwards

### Requirement: Array-aware merge

The handler MUST be appended to `hooks.<event>[]` in the matcher group whose `matcher` equals the hook's (an omitted matcher equals an omitted matcher), creating the event array or group only when absent. Existing hooks, groups, and events MUST NOT be overwritten, reordered, or removed. Unknown keys and the existing indentation and trailing newline MUST be preserved. A handler deep-equal to one already in the group MUST NOT be duplicated.

#### Scenario: Existing user hooks preserved

- GIVEN a settings file with user groups under `PreToolUse` and other top-level keys
- WHEN a hook is installed
- THEN user entries keep their content and order, unknown keys remain, and the new handler is appended

#### Scenario: Same event and matcher

- GIVEN a group with matcher `Bash` holding a user handler
- WHEN a hook with event and matcher `Bash` is installed
- THEN the handler is appended to that group, which keeps its user handler first

#### Scenario: Same event, different matcher

- GIVEN a group with matcher `Bash`
- WHEN a hook with matcher `Edit` on the same event is installed
- THEN a new group is appended after the existing one

#### Scenario: Empty arrays and absent file

- GIVEN `hooks.PreToolUse` is `[]`, `hooks` is `{}`, or the settings file is absent
- WHEN a hook is installed
- THEN the structure is created or filled and the file is valid JSON

#### Scenario: Idempotent re-run

- GIVEN the hook is already installed and unchanged
- WHEN init runs again
- THEN the action is `skip` and the file is not rewritten

### Requirement: Malformed settings

A settings file that is not valid JSON, whose `hooks` is not an object, or whose target event is not an array MUST cause a clear error naming the file, MUST write nothing, and MUST exit non-zero.

#### Scenario: Malformed JSON

- GIVEN `settings.json` is invalid JSON
- WHEN init installs a hook
- THEN the error names the file, nothing is written, and exit is non-zero

#### Scenario: Wrong shape

- GIVEN `hooks.PreToolUse` is an object
- WHEN init installs a hook on `PreToolUse`
- THEN init fails naming the path and writes nothing

### Requirement: Confirmation gate

Hook installation MUST present the exact event, matcher, and command text and require explicit confirmation, including under `--yes`. Confirmation MUST be skippable only by one dedicated flag (name decided in design). A non-interactive run without the flag MUST write nothing and exit non-zero. Hooks loaded from `--source` MUST be installable under the same gate. `--dry-run` MUST print the plan and commands without prompting or writing.

#### Scenario: Yes is not enough

- GIVEN `--yes` without the dedicated flag
- WHEN init selects a hook
- THEN the exact command is shown and non-interactive init writes nothing and exits non-zero

#### Scenario: Dedicated flag

- GIVEN the dedicated flag
- WHEN init selects a hook
- THEN the hook installs without prompting

#### Scenario: Source hook gated

- GIVEN `--source ./mine` provides hook `x`
- WHEN init installs it without the flag
- THEN the same confirmation is required

#### Scenario: Declined

- GIVEN an interactive user declines
- WHEN init proceeds
- THEN the hook is not written and other selections follow existing behavior

### Requirement: Selection

`--hooks <names>` MUST select hooks by name. An unknown name MUST exit non-zero naming it and write nothing. Interactive init MUST offer hooks only when the catalog contains at least one. Profiles MUST be able to select hooks.

#### Scenario: Unknown hook

- GIVEN `--hooks ghost`
- WHEN init runs
- THEN it exits non-zero naming `ghost` and writes nothing

#### Scenario: Prompt hidden when empty

- GIVEN a catalog with no hooks
- WHEN interactive init runs
- THEN no hook prompt appears

### Requirement: Ownership

Ownership MUST be recorded in the manifest as scope, settings path, event, matcher, and handler hash, and located by canonical JSON equality. No marker key MUST be written into user files. Whether an edited owned hook reports `modified` or `missing` is OPEN (decided in design).

#### Scenario: Clean file

- GIVEN a hook was installed
- WHEN the settings file is inspected
- THEN the handler contains only catalog fields

### Requirement: Safe writes

Apply MUST re-read the settings file and refuse on concurrent change (`StaleFileError`), back up the pre-write bytes, write atomically, and roll back on failure.

#### Scenario: Concurrent edit

- GIVEN `settings.json` changes between planning and writing
- WHEN apply runs
- THEN it aborts without overwriting and exits non-zero

### Requirement: Undo of hooks

`undo` MUST restore `settings.json` byte-identical to its pre-install bytes when nothing else changed. When the file changed afterwards, undo MUST remove only handlers whose canonical content matches the manifest, and MUST NOT remove foreign entries. It MUST drop a group or event only if the install created it and it is now empty. A drifted file MUST be refused without `--force`, per existing undo behavior.

#### Scenario: Byte-identical restore

- GIVEN a hook was installed and nothing else touched the file
- WHEN `undo` runs
- THEN `settings.json` equals its original bytes, or is removed if the install created it

#### Scenario: Later user edit

- GIVEN the user added another hook after install
- WHEN `undo` runs with `--force`
- THEN only the shitaku handler is removed and the user hook remains

#### Scenario: Shared group kept

- GIVEN the owned handler sits in a group that also holds a user handler
- WHEN undo removes it
- THEN the group and user handler remain in their original order

### Requirement: Manifest backward compatibility

Manifests without `hook` entries MUST load and replay unchanged, and the manifest version MUST NOT change.

#### Scenario: Old manifest

- GIVEN a manifest with no hook entries
- WHEN status, undo, or init runs
- THEN it loads without error

### Requirement: Security documentation

README, the website security page (en and es), and CONTRIBUTING MUST state: hook commands execute code with the user's full permissions; hooks MUST NOT contain literal secrets; hooks from `--source` follow the same trust model and confirmation as bundled ones.

#### Scenario: Security note present

- GIVEN README and the en and es security pages
- WHEN read
- THEN each states the three points and documents the hook file format
