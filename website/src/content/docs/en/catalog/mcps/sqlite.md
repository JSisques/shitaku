---
title: 'sqlite'
description: 'Inspect and query a local SQLite database file (can write); set SQLITE_DB_PATH; requires uvx (Astral uv)'
---

# `sqlite`

Inspect and query a local SQLite database file (can write); set SQLITE_DB_PATH; requires uvx (Astral uv)

## Server

| Field     | Value                                                   |
| --------- | ------------------------------------------------------- |
| `type`    | `stdio`                                                 |
| `command` | `uvx`                                                   |
| `args`    | `["mcp-server-sqlite","--db-path","${SQLITE_DB_PATH}"]` |

## Environment

| Name                | Required | Description                               |
| ------------------- | -------- | ----------------------------------------- |
| `${SQLITE_DB_PATH}` | yes      | Absolute path to the SQLite database file |

Secrets appear only as `${VAR}` placeholder names — never as values.
