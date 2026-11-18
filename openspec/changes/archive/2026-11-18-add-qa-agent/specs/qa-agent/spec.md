# qa-agent Specification

## Purpose

Catalog-bundled **qa** agent: a generic English Claude Code sub-agent that reviews a caller-supplied change for missing tests, untested edge cases and likely behavioural regressions, writes a failing reproduction test for every confirmed bug, and reports an honest verdict. It has no `Bash`, so it cannot run tests, builds or linters, and it never claims a check it could not run. It is the third bundled agent and uses least-privilege tools plus an optional exact allowlist of Playwright MCP tools. Installable via existing agents-install. Partially addresses issue #44; deferred items are out of scope (see the last requirement).

## Requirements

### Requirement: Bundled registration and valid agent file

The bundled catalog MUST list `qa` in `items.agents` and MUST ship `catalog/agents/qa.md`. The file MUST have YAML frontmatter with a single-line `name` equal to `qa`, a single-line plain-scalar `description` and a `tools` field, followed by a non-empty body. The frontmatter MUST contain exactly three lines between the delimiters. The agent MUST pass `parseAgent` and the catalog MUST load without issues.

#### Scenario: Bundled load succeeds

- GIVEN the default bundled catalog after this change
- WHEN the catalog is loaded
- THEN agent `qa` is available and valid
- AND `items.agents` equals `['pr-creator', 'qa', 'socratic-challenger']` (ordering as produced by the loader)
- AND the catalog reports no issues

#### Scenario: Frontmatter rejects empty or mismatched identity

- GIVEN frontmatter missing `description`, or `name` not equal to `qa`
- WHEN the agent is parsed or the catalog is loaded
- THEN the agent MUST NOT be selectable
- AND the error MUST name the offending path and reason

#### Scenario: Three-line frontmatter

- GIVEN `catalog/agents/qa.md`
- WHEN the lines between the frontmatter delimiters are counted
- THEN there are exactly three (`name`, `description`, `tools`)

### Requirement: Description is a plain single-line scalar

The `description` MUST be a single line and MUST NOT contain a colon followed by a space or any quote character. It MUST state that the agent reviews changes for missing tests, edge cases and regressions, may write test files, and never claims a check it could not run.

#### Scenario: Description shape

- GIVEN `catalog/agents/qa.md`
- WHEN its `description` is inspected
- THEN it is on one line
- AND it contains neither `: ` nor quote characters
- AND it mentions reviewing for missing tests, edge cases and regressions, writing test files, and not claiming checks it could not run

### Requirement: Least-privilege tools with optional Playwright allowlist

Frontmatter `tools` MUST be a single comma-separated line that contains exactly `Read`, `Grep`, `Glob`, `Write` and `Edit`, optionally followed by entries from an exact, fixed allowlist of Playwright MCP tools. Every `mcp__` entry MUST match `^mcp__playwright__[a-z_]+$`. `tools` MUST NOT contain `Bash`, the wildcard `*`, any `mcp__` namespace other than `playwright`, the code-execution Playwright tools (`mcp__playwright__browser_evaluate`, `mcp__playwright__browser_run_code`, `mcp__playwright__browser_run_code_unsafe`) or the file-upload tool (`mcp__playwright__browser_file_upload`). The exact Playwright names are fixed in the design phase.

#### Scenario: Exact base tools

- GIVEN `catalog/agents/qa.md`
- WHEN its `tools` frontmatter is split on commas
- THEN the non-`mcp__` entries are exactly `Read`, `Grep`, `Glob`, `Write`, `Edit`
- AND `Bash` is absent

#### Scenario: Playwright entries are namespaced and bounded

- GIVEN `catalog/agents/qa.md`
- WHEN every `mcp__` entry in `tools` is inspected
- THEN each matches `^mcp__playwright__[a-z_]+$`
- AND none is a code-execution or file-upload tool
- AND there is no `*` entry and no other `mcp__` namespace

### Requirement: No skills dependency

The agent MUST NOT declare a `skills` field in its frontmatter and MUST NOT depend on any catalog skill. This change MUST NOT add a QA skill.

#### Scenario: No skills key

- GIVEN `catalog/agents/qa.md`
- WHEN its frontmatter is inspected
- THEN it contains no `skills:` line
- AND no file is added under `catalog/skills/`

### Requirement: Requirements section with stop-and-ask

The body MUST contain a `## Requirements` section stating that the caller must provide the change under review (files, a diff description or paths). When nothing reviewable is supplied, the agent MUST stop and ask the caller for it, and MUST NOT review the repository speculatively or invent a change.

#### Scenario: Change provided

- GIVEN the caller names files or describes a diff
- WHEN the agent is invoked
- THEN it reviews that change

#### Scenario: Nothing reviewable provided

- GIVEN the caller supplies no files, diff description or paths
- WHEN the agent is invoked
- THEN it stops and asks for the change under review
- AND it writes no file and reports no findings

### Requirement: Review for missing tests, edge cases and regressions

The body MUST instruct the agent to review the change using Read, Grep and Glob: to locate related tests by heuristic (mirrored test paths and files that import the changed modules), to list missing tests for the changed behavior, to list untested edge cases (empty input, boundaries, error paths, concurrency, platform-specific paths) and to identify likely behavioural regressions.

#### Scenario: Related tests located by heuristic

- GIVEN a changed module with a mirrored test path and another test file importing it
- WHEN the agent reviews the change
- THEN it locates both test files with Read, Grep and Glob
- AND bases its missing-test findings on them

#### Scenario: Edge cases listed

- GIVEN changed behavior whose tests cover only the happy path
- WHEN the agent reviews the change
- THEN its report lists the untested edge cases by category with file locations

### Requirement: Missing tests fail the gate

The body MUST state that missing tests for changed behavior make the verdict a failed gate. The verdict MUST NOT be a pass while any changed behavior lacks a test, regardless of the checks that were not run.

#### Scenario: Changed behavior without tests

- GIVEN the change alters behavior and no test covers it
- WHEN the agent produces its verdict
- THEN the verdict is a failed gate
- AND the missing test is listed as a finding with its file location

#### Scenario: Changed behavior fully covered

- GIVEN every changed behavior has a test and no bug is confirmed
- WHEN the agent produces its verdict
- THEN the missing-tests gate does not fail
- AND checks it could not run are still listed as not run

### Requirement: Failing reproduction test for every confirmed bug

For every bug the agent confirms by reading, the body MUST instruct it to write a test that reproduces the bug and is expected to fail on the current code, and to list that test in its report. The agent MUST NOT fix the bug.

#### Scenario: Bug confirmed

- GIVEN the agent confirms a bug in the changed code
- WHEN it records the finding
- THEN it writes a reproduction test for that bug
- AND lists the test file in the report
- AND does not modify the source containing the bug

#### Scenario: Suspected but unconfirmed bug

- GIVEN the agent suspects a defect it cannot confirm by reading
- WHEN it records the finding
- THEN it reports it as a suspicion with the evidence needed to confirm it
- AND does not claim it as a confirmed bug

### Requirement: Write and Edit only for test files

The body MUST state that Write and Edit are used only to create new test files or to add tests to existing test files. The agent MUST NOT use them to edit source, configuration, specs, documentation or any other non-test file, and MUST NOT fix bugs. Hard enforcement of this rule is out of scope; it is an instruction-level constraint.

#### Scenario: Test file written

- GIVEN a confirmed bug and a test location following the repository's test layout
- WHEN the agent writes the reproduction test
- THEN it creates a new test file or adds to an existing test file
- AND earlier tests in an existing file are not changed or deleted

#### Scenario: Non-test write refused

- GIVEN the caller asks the agent to fix a bug or edit a source, configuration or spec file
- WHEN the agent runs
- THEN it does not write or edit that file
- AND tells the caller it only writes tests

### Requirement: Honest not-run reporting

The agent MUST NOT run tests, builds or linters (it has no `Bash`). The body MUST instruct the agent to report every such check as `not run` together with the command the caller should run, and to never state that a test passes or fails unless the caller supplied that output. The agent MUST NOT invent test output.

#### Scenario: Suite not run

- GIVEN the agent reviewed the change and wrote tests
- WHEN it produces the report
- THEN the test suite, build and lint checks are each listed as `not run`
- AND each entry names the command the caller should run

#### Scenario: Caller supplies test output

- GIVEN the caller supplies a test run output with the request
- WHEN the agent reports
- THEN it may cite that output as the caller-supplied result
- AND does not present it as a check the agent ran

#### Scenario: No claim of pass or fail without output

- GIVEN no test output was supplied
- WHEN the agent describes a test it wrote
- THEN it states the test is expected to fail or pass based on reading only
- AND does not state an observed result

### Requirement: Optional Playwright regression check

The body MUST instruct the agent to use the Playwright tools only when they are available and the caller points to a runnable UI or URL for the change. Otherwise the agent MUST report the browser check as `unavailable` and MUST NOT fabricate browser results. Snapshot baselines are instruction-level only: the agent compares against a baseline the caller provides and MUST NOT invent one. Installing the agent MUST NOT install the Playwright MCP.

#### Scenario: Playwright available with a target

- GIVEN the Playwright tools are available and the caller supplies a runnable UI target
- WHEN the agent checks for behavioural regressions
- THEN it uses the Playwright tools only against that target
- AND reports what it observed

#### Scenario: Playwright tools absent

- GIVEN the Playwright tools are not available
- WHEN the agent reaches the browser check
- THEN it reports the browser check as `unavailable`
- AND reports no browser result

#### Scenario: No target or no baseline

- GIVEN the caller supplies no UI target, or supplies a target without a baseline
- WHEN the agent runs
- THEN with no target it reports the browser check as `unavailable`
- AND with no baseline it reports no baseline comparison and invents none

#### Scenario: No MCP dependency installed

- GIVEN `init --agents qa` applies on a target without the Playwright MCP
- WHEN the install completes
- THEN only the agent is installed

### Requirement: Structured QA report

The body MUST define an output section for a structured QA report containing: the verdict (pass or failed gate), findings with file locations, tests written, checks not run with the command to run each, and unavailable checks.

#### Scenario: Report sections present

- GIVEN a completed review
- WHEN the agent returns its report
- THEN it contains the verdict, findings with file locations, tests written, checks not run with commands, and unavailable checks
- AND a section with no entries is stated as empty rather than omitted

### Requirement: Never section

The body MUST contain a `## Never` section stating that the agent never claims a gate it could not run, never edits non-test files, never fixes bugs, and never invents test output.

#### Scenario: Never rules present

- GIVEN `catalog/agents/qa.md`
- WHEN its `## Never` section is inspected
- THEN it contains the four prohibitions above

### Requirement: Generic English content without project name or attribution

The agent MUST be written in concise English and be generic (usable in any repository). The file MUST NOT contain the project name `shitaku` nor `Co-Authored-By` or any AI attribution.

#### Scenario: Generic content

- GIVEN `catalog/agents/qa.md`
- WHEN its content is inspected
- THEN it is non-empty English
- AND contains neither `shitaku` nor `Co-Authored-By`

### Requirement: Installable create when absent

When the target is absent, `init --agents qa --dry-run` MUST classify `create` for `./.claude/agents/qa.md` (project scope) and MUST NOT write files, backups or manifest. A user-scope install MUST target `~/.claude/agents/qa.md`. Applied install MUST be byte-identical under existing agents-install (referenced; MUST NOT amend that domain).

#### Scenario: Dry-run create when absent

- GIVEN no target file for `qa`
- WHEN `init --agents qa --scope project --dry-run` runs
- THEN the plan classifies `qa` as `create` for `./.claude/agents/qa.md`
- AND no file, backup or manifest changes occur

#### Scenario: User-scope target path

- GIVEN a user-scope install of `qa`
- WHEN the plan is computed
- THEN the target is `~/.claude/agents/qa.md`

#### Scenario: Byte-identical install

- GIVEN the bundled agent and an absent target
- WHEN `init --agents qa` applies successfully
- THEN the target file is byte-identical to the catalog file

### Requirement: Catalog-only surface with synced docs and deferred scope

Delivery MUST be catalog data, tests, CONTRIBUTING text and regenerated docs only. `src/` hexagonal layers, `catalog/skills/` and `catalog/profiles/` MUST remain unchanged, and `qa` MUST NOT be added to any profile. The README agents table and website catalog pages (en, es) MUST be regenerated so the docs check scripts pass. CONTRIBUTING MUST stay accurate with three bundled agents instead of stating that the catalog ships two. The following issue #44 items are explicitly out of scope: test-map and impact-radius scripts, a `shitaku new` QA phase with a retry rule, router integration, real snapshot-baseline infrastructure, running tests from the agent, and hard enforcement of the test-files-only write rule.

#### Scenario: No src, skill or profile changes

- GIVEN this change is applied
- WHEN the authored diff is reviewed
- THEN `src/`, `catalog/skills/` and `catalog/profiles/` are unchanged

#### Scenario: Generated docs in sync

- GIVEN `qa` is registered in the catalog
- WHEN `docs:catalog:check` and the website catalog check run
- THEN both pass
- AND README and website en/es list `qa`

#### Scenario: CONTRIBUTING updated

- GIVEN the agents section of CONTRIBUTING
- WHEN it is read after this change
- THEN it is accurate with three bundled agents
- AND no longer says the bundled catalog ships two agents

#### Scenario: Partial coverage of the issue

- GIVEN the pull request for this change
- WHEN its body is read
- THEN it references issue #44 with `Refs` and not `Closes`
- AND lists the deferred items as follow-ups
