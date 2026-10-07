---
title: Comandos
description: Resumen de comandos de la CLI de shitaku.
---

# Comandos

| Comando     | Propósito                                                 |
| ----------- | --------------------------------------------------------- |
| `init`      | Instala servidores MCP, skills y comandos slash           |
| `undo`      | Restaura los archivos cambiados por la última instalación |
| `uninstall` | Elimina un MCP, skill o comando slash instalado           |
| `status`    | Informa qué instaló shitaku y si cambió                   |
| `list`      | Explora lo que ofrece un catálogo (solo lectura)          |
| `doctor`    | Diagnostica elementos instalados y sugiere correcciones   |
| `version`   | Imprime la versión del paquete instalado                  |

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
