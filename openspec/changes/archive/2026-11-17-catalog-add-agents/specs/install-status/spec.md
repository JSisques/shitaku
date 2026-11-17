# Delta for Install Status

## ADDED Requirements

### Requirement: Doctor findings for agents

`doctor` MUST report an owned agent whose file is absent as a finding with code `agent-missing`, naming the agent and its path. A present agent (modified or not) MUST NOT produce `agent-missing`. `doctor` MUST NOT write.

#### Scenario: Agent removed

- GIVEN owned agent `reviewer` whose file was deleted
- WHEN `doctor` runs
- THEN it reports `reviewer` as `agent-missing` and writes nothing

#### Scenario: Healthy agent

- GIVEN owned `reviewer` present on disk
- WHEN `doctor` runs
- THEN no finding is reported for `reviewer`

## MODIFIED Requirements

### Requirement: Manifest-driven read-only report

`status` MUST list only items recorded by installs with `undoneAt === null`. It MUST NOT write to configs, settings files, skill, script, command, or agent files, backups, or the manifest. Each item MUST carry `kind` (`mcp`, `skill`, `script`, `command`, `hook`, or `agent`; the model MUST allow further kinds), `name`, `scope`, `state`, `path`, and `installId`. Items MUST be keyed by scope, path, and name. Text output MUST group items by scope, then by kind. An agent's `path` MUST be its file path.
(Previously: kinds were mcp|skill|script|command|hook)

#### Scenario: Active agent listed

- GIVEN one active install with agent `reviewer`
- WHEN `shitaku status` runs
- THEN `reviewer` is listed with kind `agent`, scope, state, and path

#### Scenario: Same name in two scopes

- GIVEN agent `reviewer` installed in project and user scope
- WHEN `status` runs
- THEN two distinct `reviewer` items are listed, one per scope

#### Scenario: Skill and agent with same name

- GIVEN skill `x` and agent `x` are both owned
- WHEN `status` runs
- THEN both are listed, each with its own kind and path

### Requirement: Item states

The state table and ordering are unchanged, extended so that an agent file counts under `missing` when absent, and the hash used for agents is the file-bytes hash (as for commands). A user edit to an agent file MUST yield `modified`; `modified` MUST win over `out-of-date`.
(Previously: no agent file state)

#### Scenario: Installed agent

- GIVEN disk, manifest, and catalog hashes equal for `reviewer`
- WHEN `status` runs
- THEN `reviewer` is `installed`

#### Scenario: Modified agent

- GIVEN the user edited `reviewer.md` and the catalog also changed
- WHEN `status` runs
- THEN `reviewer` is `modified`

#### Scenario: Out of date agent

- GIVEN `reviewer.md` is untouched and the catalog bytes differ
- WHEN `status` runs
- THEN `reviewer` is `out-of-date`

#### Scenario: Missing agent and missing from catalog

- GIVEN `reviewer.md` was deleted and agent `old` was removed from the catalog
- WHEN `status` runs
- THEN `reviewer` is `missing` and `old` is `missing-from-catalog`
