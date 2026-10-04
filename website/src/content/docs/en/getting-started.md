---
title: Getting started
description: Install shitaku and run your first init with one command.
---

# Getting started

shitaku installs a curated AI agent setup (MCP servers and skills) for Claude Code.

## Requirements

- Node `>=22.13`

## One command

```sh
npx @jsisques/shitaku init
```

That opens an interactive plan: pick MCP servers and skills from the catalog, preview the changes, then apply them at project or user scope.

## Non-interactive install

```sh
npx @jsisques/shitaku init --mcps github,context7 --scope project --yes
```

## Undo the last install

```sh
npx @jsisques/shitaku undo
```

## Next

- [Commands](/en/cli/commands/) — full CLI surface
- [Flags](/en/cli/flags/) — common options
- [Exit codes](/en/cli/exit-codes/) — how the process exits
- [Security](/en/security/) — secrets and trust
