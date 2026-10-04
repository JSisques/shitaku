# Delta for Install Status

## ADDED Requirements

### Requirement: Uninstalled items not reported

Items removed by an uninstall (action `remove`) MUST NOT be listed by `status`, as they are no longer owned.

#### Scenario: Uninstalled item hidden

- GIVEN `demo` was installed and then uninstalled
- WHEN `status` runs
- THEN `demo` is not listed

#### Scenario: Reappears after undo

- GIVEN that uninstall was undone
- WHEN `status` runs
- THEN `demo` is listed again
