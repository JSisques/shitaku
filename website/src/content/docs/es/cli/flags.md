---
title: Flags
description: Flags habituales de la CLI de shitaku.
---

# Flags

Consulta la referencia completa de la CLI para los flags de cada comando. Los habituales incluyen `--scope`, `--source`, `--dry-run`, `--yes`, `--force` y `--json`.

| Flag                                       | Comando     | Significado                                                           |
| ------------------------------------------ | ----------- | --------------------------------------------------------------------- |
| `--commands <a,b>`                         | `init`      | Nombres de comandos slash separados por comas                         |
| `--hooks <a,b>`                            | `init`      | Nombres de hooks separados por comas                                  |
| `--allow-hooks`                            | `init`      | Instala los hooks elegidos sin pedir confirmación; `--yes` no lo hace |
| `--kind mcp\|skill\|script\|command\|hook` | `uninstall` | Desambigua cuando un nombre existe como varios tipos de elemento      |

`--yes` necesita `--scope` y al menos uno de `--mcps`, `--skills`, `--scripts`, `--commands` o `--hooks`. `list` acepta `commands` y `hooks` como tipo.
