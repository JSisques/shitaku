---
title: 'github'
description: 'GitHub remote MCP server (repositories, issues, pull requests)'
---

# `github`

GitHub remote MCP server (repositories, issues, pull requests)

## Server

| Field                   | Value                                |
| ----------------------- | ------------------------------------ |
| `type`                  | `http`                               |
| `url`                   | `https://api.githubcopilot.com/mcp/` |
| `headers.Authorization` | `Bearer ${GITHUB_TOKEN}`             |

## Environment

| Name              | Required | Description                  |
| ----------------- | -------- | ---------------------------- |
| `${GITHUB_TOKEN}` | yes      | GitHub personal access token |

Secrets appear only as `${VAR}` placeholder names — never as values.
