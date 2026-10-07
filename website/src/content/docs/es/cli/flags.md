---
title: Flags
description: Flags habituales de la CLI de shitaku.
---

# Flags

Consulta la referencia completa de la CLI para los flags de cada comando. Los habituales incluyen `--scope`, `--source`, `--dry-run`, `--yes`, `--force` y `--json`.

| Flag                                 | Comando     | Significado                                                      |
| ------------------------------------ | ----------- | ---------------------------------------------------------------- |
| `--commands <a,b>`                   | `init`      | Nombres de comandos slash separados por comas                    |
| `--kind mcp\|skill\|script\|command` | `uninstall` | Desambigua cuando un nombre existe como varios tipos de elemento |

`--yes` necesita `--scope` y al menos uno de `--mcps`, `--skills`, `--scripts` o `--commands`. `list` acepta `commands` como tipo.
