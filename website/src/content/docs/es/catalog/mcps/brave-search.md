---
title: 'brave-search'
description: 'Official Brave Search MCP for current web results; requires BRAVE_API_KEY'
---

# `brave-search`

Official Brave Search MCP for current web results; requires BRAVE_API_KEY

## Server

| Field               | Value                                     |
| ------------------- | ----------------------------------------- |
| `type`              | `stdio`                                   |
| `command`           | `npx`                                     |
| `args`              | `["-y","@brave/brave-search-mcp-server"]` |
| `env.BRAVE_API_KEY` | `${BRAVE_API_KEY}`                        |

## Environment

| Name               | Required | Description          |
| ------------------ | -------- | -------------------- |
| `${BRAVE_API_KEY}` | yes      | Brave Search API key |

Secrets appear only as `${VAR}` placeholder names — never as values.
