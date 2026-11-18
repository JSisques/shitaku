---
title: Flags
description: Flags habituales de la CLI de shitaku.
---

# Flags

Consulta la referencia completa de la CLI para los flags de cada comando. Los habituales incluyen `--scope`, `--source`, `--dry-run`, `--yes`, `--force` y `--json`.

| Flag                                                    | Comando     | Significado                                                                 |
| ------------------------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| `--commands <a,b>`                                      | `init`      | Nombres de comandos slash separados por comas                               |
| `--agents <a,b>`                                        | `init`      | Nombres de agentes separados por comas (pueden dar herramientas o permisos) |
| `--rules <a,b>`                                         | `init`      | Nombres de reglas separados por comas (orientan al agente)                  |
| `--hooks <a,b>`                                         | `init`      | Nombres de hooks separados por comas                                        |
| `--allow-hooks`                                         | `init`      | Instala los hooks elegidos sin pedir confirmación; `--yes` no lo hace       |
| `--kind mcp\|skill\|script\|command\|hook\|agent\|rule` | `uninstall` | Desambigua cuando un nombre existe como varios tipos de elemento            |

`--yes` necesita `--scope` y al menos uno de `--mcps`, `--skills`, `--scripts`, `--commands`, `--agents`, `--rules` o `--hooks`. `list` acepta `commands`, `hooks`, `agents` y `rules` como tipo.
