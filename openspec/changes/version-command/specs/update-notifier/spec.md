# Delta for Update Notifier

## ADDED Requirements

### Requirement: Version reporting skips update check

`version`, `-v`, and `--version` MUST NOT run the update check (no cache read, fetch, or notifier stderr), even with update deps wired and no env skip. Other commands MUST keep existing notifier behavior.

#### Scenario: Version entry points skip notifier

- GIVEN update deps wired, newer cached, interactive, no env skip
- WHEN `shitaku version`, `-v`, or `--version` runs
- THEN that invocation does no update-check I/O and prints no notifier line

#### Scenario: Other commands still notify

- GIVEN update deps wired, newer available, interactive, no skip
- WHEN a non-version command such as `status` runs
- THEN existing update-notifier behavior still applies
