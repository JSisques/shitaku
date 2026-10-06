---
title: 'hyperconsciousness'
description: 'Developer-alpha encrypted, append-only knowledge store with scoped, expiring MCP grants; build hc from source and add it to PATH, then initialize a store and grant access: https://github.com/louis030195/hyperconsciousness#install-from-source'
---

# `hyperconsciousness`

Developer-alpha encrypted, append-only knowledge store with scoped, expiring MCP grants; build hc from source and add it to PATH, then initialize a store and grant access: https://github.com/louis030195/hyperconsciousness#install-from-source

## Server

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| `type`    | `stdio`                                                     |
| `command` | `hc`                                                        |
| `args`    | `["mcp","--as","${HC_GRANT_ID}","--dir","${HC_STORE_DIR}"]` |

## Environment

| Name              | Required | Description                                                                                                                                     |
| ----------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `${HC_GRANT_ID}`  | yes      | ID of an existing, unexpired grant for this store and local device; create a narrowly scoped grant with hc grant before starting the MCP client |
| `${HC_STORE_DIR}` | yes      | Absolute path to a store initialized with hc start; the MCP process must run as the OS user that can unlock its keys                            |

Secrets appear only as `${VAR}` placeholder names — never as values.
