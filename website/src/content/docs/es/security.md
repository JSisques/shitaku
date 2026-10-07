---
title: Seguridad
description: Cómo shitaku trata los secretos y la confianza.
---

# Seguridad

Los secretos se escriben solo como placeholders `${VAR}`, nunca como valores. Trata los catálogos personalizados (`--source`) como código que ejecutas: usa solo carpetas en las que confíes.

## Comandos slash

Claude Code trata el texto de un comando slash como instrucciones cuando ejecutas `/<name>`; shitaku no lo ejecuta, no lo analiza ni lo aísla. Un archivo de comando distinto que shitaku no instaló solo se reemplaza con `--force`, después de una copia de seguridad que `undo` restaura. Solo se escribe el archivo `<name>.md` indicado, nunca los demás archivos de `commands/`, y se rechazan los enlaces simbólicos. Revisa los comandos de una carpeta `--source` antes de usarlos.
