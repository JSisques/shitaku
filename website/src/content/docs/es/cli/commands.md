---
title: Comandos
description: Resumen de comandos de la CLI de shitaku.
---

# Comandos

| Comando     | Propósito                                                 |
| ----------- | --------------------------------------------------------- |
| `init`      | Instala servidores MCP, skills, comandos slash y hooks    |
| `undo`      | Restaura los archivos cambiados por la última instalación |
| `uninstall` | Elimina un MCP, skill, comando slash o hook instalado     |
| `status`    | Informa qué instaló shitaku y si cambió                   |
| `list`      | Explora lo que ofrece un catálogo (solo lectura)          |
| `doctor`    | Diagnostica elementos instalados y sugiere correcciones   |
| `version`   | Imprime la versión del paquete instalado                  |

## Hooks

Un hook añade un manejador `command` de Claude Code a la clave `hooks` de un `settings.json`. Los hooks ejecutan comandos con todos tus permisos de usuario, así que `init` siempre muestra el evento, el matcher y el comando exactos y te pide confirmación. Lee [Seguridad](/es/security/#seguridad-de-los-hooks) antes de instalar uno. El catálogo incluido todavía no trae ninguno.

```sh
shitaku list hooks
shitaku init --hooks fmt --scope project --dry-run
shitaku init --hooks fmt --scope project --allow-hooks
shitaku uninstall fmt --kind hook
```

- `--hooks <a,b>` los fusiona en `./.claude/settings.json` (`project`) o en `~/.claude/settings.json` (`user`).
- `--yes` no es consentimiento. Sin `--allow-hooks`, una ejecución no interactiva imprime los comandos por stderr, termina con código `1` y no escribe nada. `--allow-hooks` es la única forma de omitir la confirmación; `--dry-run` imprime los comandos y nunca pregunta.
- `list hooks` muestra los hooks del catálogo; sin resultados imprime `no matching items` y termina con código `0`.
- `uninstall <name> --kind hook` elimina solo ese manejador, localizado por contenido exacto. Un hook que editaste se considera ya ausente. En `status` aparece como `missing` y `doctor` informa `hook-missing`.
- Antes de bajar de versión, ejecuta `shitaku undo` o `shitaku uninstall` en las instalaciones que incluyan hooks: las versiones anteriores lanzan un `ManifestError` ante una entrada del manifiesto con `kind: 'hook'`.

## Comandos slash

Un comando slash es un archivo Markdown que Claude Code ejecuta como `/<name>`; no es un subcomando de la CLI de shitaku. El catálogo incluido todavía no trae ninguno.

```sh
shitaku list commands
shitaku init --commands review --scope project
shitaku init --commands review --scope user --dry-run
shitaku uninstall review --kind command
```

- `--commands <a,b>` instala cada comando como un único archivo en `./.claude/commands/` (`project`) o en `~/.claude/commands/` (`user`). No se toca ningún otro archivo de ese directorio.
- Si ya existe un `<name>.md` distinto que shitaku no instaló, hay un conflicto: `init` termina con código `2` y no escribe nada. `--force` crea antes una copia de seguridad y `shitaku undo` la restaura.
- `list commands` muestra los comandos del catálogo; sin resultados imprime `no matching items` y termina con código `0`.
- `uninstall <name> --kind command` elimina solo ese archivo. `status` y `doctor` informan de los comandos igual que del resto de elementos (`command-missing` en `doctor`).
- Antes de bajar de versión, ejecuta `shitaku undo` en las instalaciones que incluyan comandos: las versiones anteriores lanzan un `ManifestError` ante una entrada del manifiesto con `kind: 'command'`.
