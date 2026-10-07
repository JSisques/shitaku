# Contributing to shitaku

Thanks for helping. This guide covers local setup, adding catalog items (MCPs, skills, scripts, slash commands, profiles), commit conventions and what a pull request needs to pass.

## Local setup

Requirements: Node `>=22.13` (`engines`; `.nvmrc` pins 22.22.1, which CI uses, and `nvm use` reads it) and pnpm. The pnpm version is pinned in the `packageManager` field of `package.json`. Run `corepack enable` once so it is used automatically (Node 25+ no longer bundles Corepack: run `npm i -g corepack` first). Without Corepack, `npm i -g pnpm@10` also works. `npm install` is not supported for development.

```sh
pnpm install
```

| Command                  | What it does                                       |
| ------------------------ | -------------------------------------------------- |
| `pnpm run typecheck`     | Type-check without emitting                        |
| `pnpm run lint`          | ESLint (typescript-eslint, type-aware)             |
| `pnpm run lint:fix`      | ESLint with autofixes                              |
| `pnpm test`              | Run all tests (Vitest)                             |
| `pnpm run test:changed`  | Only tests affected vs `origin/main`               |
| `pnpm run test:coverage` | Run tests with coverage (minimum 80%)              |
| `pnpm run build`         | Compile to `dist/` and check the path aliases      |
| `pnpm run format`        | Rewrite files with Prettier                        |
| `pnpm run format:check`  | Fail if any file is not formatted                  |
| `pnpm run smoke:pack`    | Pack and install the package like a consumer would |

Run the built CLI with `node dist/main.js init --dry-run ...` (after `pnpm run build`). Tests never touch your real home directory; see `test/setup.ts`.

### Git hooks

`pnpm install` installs Husky hooks:

| Hook         | Runs                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| `pre-commit` | ESLint then Prettier on staged `ts`/`mjs`/`js` files, Prettier on the rest (lint-staged) |
| `commit-msg` | commitlint with Conventional Commits                                                     |
| `pre-push`   | `pnpm run typecheck`, `pnpm run test:changed`, `pnpm run build`                          |

Bypass with `git commit --no-verify`, `git push --no-verify` or `HUSKY=0`. CI runs the same checks, so bypassing only delays the failure.

## Adding to the catalog

The catalog lives in `catalog/`:

```
catalog/
  catalog.json        index: lists every item by name
  mcps/<name>.json
  profiles/<name>.json
  skills/<name>/SKILL.md
  scripts/<name>/index.mjs
  scripts/<name>/script.json
  commands/<name>.md
  hooks/<name>.json
```

Every item must be listed in `catalog/catalog.json` under `items.mcps`, `items.profiles`, `items.skills`, `items.scripts`, `items.commands` or `items.hooks`. The loader (`src/adapters/catalog/folder-source.ts`) validates items with the zod schemas in `src/domain/catalog/`. An invalid or unlisted item is skipped with a warning.

After adding or changing an MCP, skill, script, slash command or hook, run `pnpm run docs:catalog` to regenerate the catalog tables in `README.md`. CI fails (`pnpm run docs:catalog:check`) when they are out of date.

When catalog items change, also refresh the docs site pages:

```sh
pnpm run docs:website-catalog
pnpm run docs:website-catalog:check
```

That regenerates Markdown under `website/src/content/docs/{en,es}/catalog/` from `catalog/` (read-only). Profiles stay browse-only with a not-installable callout. The isolated `.github/workflows/website.yml` workflow runs the same emit step before the Astro build; root `ci.yml` / `cd.yml` do not.

Names for MCPs, skills, scripts, slash commands and hooks must match `^[a-z0-9][a-z0-9-]*$` (lowercase letters, digits and hyphens; no leading hyphen).

### Add a skill

1. Create `catalog/skills/<name>/SKILL.md`. Add any supporting files (scripts, templates, assets) next to it in the same directory.
2. Start `SKILL.md` with frontmatter:

   ```md
   ---
   name: my-skill
   description: One line that says what the skill does and when to use it.
   ---

   # My skill

   Instructions for the agent.
   ```

   - `name` must equal the directory name and match the naming rule.
   - `description` is required and non-empty.
   - Only single-line `key: value` frontmatter is supported. Multi-line values (indented lines, `|`, `>`) are rejected.
   - No symlinks. Limits: 100 files, depth 8, 1 MiB per file, 5 MiB per skill.

3. Add the name to `items.skills` in `catalog/catalog.json`:

   ```json
   "skills": ["example-skill", "my-skill"]
   ```

4. Update `test/adapters/catalog/bundled-catalog.test.ts`, which asserts the exact bundled item lists and counts.
5. Verify:

   ```sh
   pnpm run build
   node dist/main.js init --skills my-skill --scope project --dry-run
   pnpm test
   ```

   The dry run prints `my-skill: create` and writes nothing. If the output says `not listed in catalog.json` or `unknown skill`, check step 3. `catalog/skills/example-skill` is a reference.

### Add an MCP

1. Create `catalog/mcps/<name>.json`. The `name` field must equal the file name and match the naming rule.
2. Fields:
   - `name`, `description`: required strings.
   - `server`: either `{ "type": "stdio", "command": "...", "args": [...], "env": {...} }` or `{ "type": "http" | "sse", "url": "https://...", "headers": {...} }`.
   - `env`: list of `{ "name": "UPPER_SNAKE", "required": true, "description": "..." }` for every variable the server references. `required` defaults to `true`.
   - `targets`: optional list of agent targets; omit it for all (the only target today is `claude-code`).
3. Secrets: values in `headers` and `server.env` must reference a `${VAR}` placeholder; literal values are rejected. Every `${VAR}` used anywhere in the server definition must be declared in `env`. Defaults (`${VAR:-x}`) are not allowed in headers. Never commit a real token.
4. Add the name to `items.mcps` in `catalog/catalog.json`, then update `test/adapters/catalog/bundled-catalog.test.ts`.
5. Verify with `pnpm run build`, `node dist/main.js init --mcps <name> --scope project --dry-run` and `pnpm test`.

Examples: `catalog/mcps/github.json` (http with a secret header) and `catalog/mcps/context7.json` (stdio).

### Add a script

1. Create `catalog/scripts/<name>/` with:
   - `index.mjs` — ESM entry point (Node `>=22.13`). shitaku runs it with `process.execPath` and `shell:false`.
   - `script.json` — metadata. Required: `name` (must equal the directory name) and non-empty `description`. Optional: `tools` (binaries expected on PATH / `.bin`), `args`, `output`, `exitCodes`.
2. Add the name to `items.scripts` in `catalog/catalog.json`:

   ```json
   "scripts": ["my-script"]
   ```

3. Update `test/adapters/catalog/bundled-catalog.test.ts` when you add or change bundled scripts (the shipped catalog currently lists `complexity` and `dead-code` in `items.scripts`).
4. Verify:

   ```sh
   pnpm run build
   node dist/main.js init --scripts my-script --scope project --dry-run
   node dist/main.js run my-script
   pnpm test
   ```

   The dry run prints `my-script: create` and writes nothing. After a real install, `shitaku run` lists it and `shitaku run my-script` executes `index.mjs`. Regenerate README and website catalog tables with `pnpm run docs:catalog` and `pnpm run docs:website-catalog` when bundled scripts change.

Install roots: project `./.shitaku/scripts/<name>/`, user `~/.claude/.shitaku/scripts/<name>/` — never agent skill directories.

### Adding catalog items: slash commands

A slash command is a single Markdown file that Claude Code runs as `/<name>`. It is not a shitaku CLI subcommand.

1. Create `catalog/commands/<name>.md`. The file name (without `.md`) is the command name and must match `^[a-z0-9][a-z0-9-]*$`.
2. Start the file with frontmatter that has a non-empty single-line `description`; other single-line keys such as `argument-hint` pass through untouched. Multi-line values are rejected. The body after the frontmatter must not be empty.

   ```md
   ---
   description: Review the staged changes and list risks.
   argument-hint: [focus]
   ---

   Review the staged changes. Focus on $ARGUMENTS.
   ```

3. Add the name to `items.commands` in `catalog/catalog.json`:

   ```json
   "commands": ["review"]
   ```

   A file that is not listed, or a listed one that is missing or invalid, is skipped with a warning. No symlinks.

4. Verify:

   ```sh
   pnpm run build
   node dist/main.js list commands
   node dist/main.js init --commands my-command --scope project --dry-run
   pnpm test
   ```

   The dry run prints `my-command: create` and writes nothing. Regenerate the README and website tables with `pnpm run docs:catalog` and `pnpm run docs:website-catalog`.

Install behavior: the file is copied flat to `~/.claude/commands/<name>.md` (`user`) or `./.claude/commands/<name>.md` (`project`). Other files in that directory are never touched.

- A different `<name>.md` that shitaku did not install (or that changed since) is a conflict: `init` exits `2` and writes nothing.
- `--force` backs the file up under `~/.claude/.shitaku/backups/` and replaces it; `shitaku undo` restores the original bytes. Undo refuses (exit `3`) if the file changed after the install, unless `--force` is set.
- `shitaku uninstall <name> --kind command` removes only that file. The bundled catalog ships no command yet, so tests use fixtures and never depend on a bundled one.

### Adding catalog items: hooks

A hook is one JSON file that adds a single Claude Code `command` handler to the `hooks` key of a `settings.json`. Hooks run commands with the user's full permissions, so review them as you would code.

1. Create `catalog/hooks/<name>.json`. The `name` field must equal the file name and match the naming rule.
2. Fields: `name`, `description`, `event` (a hook event such as `PostToolUse`) and `command` are required; `matcher` (omitted means all), `timeout` (positive number) and `type` (only `command`) are optional. Unknown fields, several handlers and a non-`command` type are rejected.

   ```json
   {
     "name": "fmt",
     "description": "Format files after Claude edits them.",
     "event": "PostToolUse",
     "matcher": "Edit|Write",
     "command": "${CLAUDE_PROJECT_DIR}/scripts/format.sh",
     "timeout": 30
   }
   ```

3. Secrets: `command` and `matcher` must not contain a literal secret. Write `${VAR}` references; they are copied unchanged and never expanded by shitaku. The check is a heuristic (known token shapes and `NAME=value` credentials), so it does not replace review. Never commit a real token.
4. Add the name to `items.hooks` in `catalog/catalog.json`, and to the `hooks` list of any profile that should include it (it must exist in the catalog). A file that is not listed, or a listed one that is missing or invalid, is skipped with a warning. Update `test/adapters/catalog/bundled-catalog.test.ts` when you add a bundled hook.
5. Verify:

   ```sh
   pnpm run build
   node dist/main.js list hooks
   node dist/main.js init --hooks my-hook --scope project --dry-run
   pnpm test
   ```

   The dry run prints the exact event, matcher and command and `my-hook: create`, and writes nothing. Regenerate the README and website tables with `pnpm run docs:catalog` and `pnpm run docs:website-catalog`.

Install behavior: `init --hooks <name>` merges the handler into `~/.claude/settings.json` (`user`) or `./.claude/settings.json` (`project`), never into `settings.local.json`, and writes no marker key: the manifest records the file, event, matcher and handler and finds the hook by exact content. It always confirms the exact commands first; `--yes` does not skip that, only `--allow-hooks` does, and a non-interactive run without it writes nothing and exits `1`. Hooks from `--source` follow the same gate.

- A hook you edit in `settings.json` no longer matches, so `status` reports it `missing` and `uninstall --kind hook` reports it already absent.
- `shitaku undo` restores the original bytes, and with `--force` removes only the handlers it installed. `shitaku uninstall <name> --kind hook` removes only that handler.
- Settings must be strict JSON; a file with comments or trailing commas is refused and nothing is written.
- Claude Code reloads hooks live and may write `settings.json` itself, so avoid `/config` during an install.
- Older shitaku versions throw a `ManifestError` on a manifest entry with `kind: 'hook'`; undo or uninstall hooks before downgrading.

### Add a profile

A profile is a named bundle of MCPs, skills, scripts, slash commands and hooks.

1. Create `catalog/profiles/<name>.json`. The `name` field must equal the file name.
2. Fields: `name` (required), `description`, `extends` (profile names, applied first), `mcps`, `skills`, `scripts`, `commands`, `hooks` (names that exist in the catalog).
3. Every referenced MCP, skill, script, command, hook and parent profile must exist, and `extends` must not form a cycle. A profile that does not resolve is skipped with a warning.
4. Add the name to `items.profiles` in `catalog/catalog.json`, then update `test/adapters/catalog/bundled-catalog.test.ts` if needed.

The CLI cannot select a profile yet; profiles are validated and resolved but not installable by name.

To try an item without touching the bundled catalog, point the CLI at another folder: `--source <folder>`.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`@commitlint/config-conventional`, enforced by the `commit-msg` hook), for example:

```
feat: add skills catalog loader
fix: reject skill names that escape the directory
docs: add CONTRIBUTING guide
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

## Pull requests

- Open the PR against `main`. Link the issue it closes (`Closes #<n>`).
- Keep it small and focused on one change. Split unrelated work into separate PRs. There is no hard size limit, but smaller PRs get reviewed faster.
- Add or update tests with the code, and update the README when behavior changes.
- CI (`.github/workflows/ci.yml`, job `ci`) must pass. It runs, in order: `pnpm install --frozen-lockfile`, `pnpm run lint`, `pnpm run format:check`, `pnpm run docs:catalog:check`, `pnpm run typecheck`, `pnpm run test:coverage` (fails below 80% coverage), `pnpm run build`, `pnpm run smoke:pack`. Run them locally before pushing.
- `smoke:pack` (`scripts/smoke-pack.mjs`) intentionally uses `npm pack` and `npm install`, because it simulates how consumers install the published package.
