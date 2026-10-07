---
title: Seguridad
description: Cómo shitaku trata los secretos y la confianza.
---

# Seguridad

Los secretos se escriben solo como placeholders `${VAR}`, nunca como valores. Trata los catálogos personalizados (`--source`) como código que ejecutas: usa solo carpetas en las que confíes. Los hooks de una carpeta `--source` se fusionan en tu configuración de Claude Code y ejecutan comandos con todos tus permisos de usuario.

## Comandos slash

Claude Code trata el texto de un comando slash como instrucciones cuando ejecutas `/<name>`; shitaku no lo ejecuta, no lo analiza ni lo aísla. Un archivo de comando distinto que shitaku no instaló solo se reemplaza con `--force`, después de una copia de seguridad que `undo` restaura. Solo se escribe el archivo `<name>.md` indicado, nunca los demás archivos de `commands/`, y se rechazan los enlaces simbólicos. Revisa los comandos de una carpeta `--source` antes de usarlos.

## Seguridad de los hooks

- Un comando de hook se ejecuta con todos tus permisos de usuario cada vez que Claude Code dispara su evento. shitaku nunca lo ejecuta, pero lo escribe en un archivo que Claude Code ejecuta.
- Los hooks no deben contener secretos literales; usa referencias `${VAR}`. La comprobación del catálogo es heurística (formas conocidas de token y credenciales `NOMBRE=valor`), así que no puede demostrar que un comando esté limpio. Revisa los comandos tú mismo.
- Los hooks de una carpeta `--source` siguen el mismo modelo de confianza y la misma confirmación que los incluidos. Usa solo carpetas en las que confíes.
- `init` muestra el evento, el matcher y el comando exactos y te pide confirmación. `--yes` no es consentimiento: sin `--allow-hooks`, una ejecución no interactiva no escribe nada y termina con código `1`.
- Los hooks de proyecto viven en `./.claude/settings.json`. Si haces commit de ese archivo, se ejecutan para cada colaborador que abra el proyecto.
- shitaku solo toca `settings.json` (nunca `settings.local.json`, la configuración gestionada ni los hooks de plugins), no escribe ninguna marca en él y vuelve a localizar sus hooks por contenido exacto. La configuración debe ser JSON estricto: los comentarios o las comas finales se rechazan indicando el archivo y no se escribe nada.
- Un hook editado deja de coincidir: `status` lo informa como `missing` (código `hook-missing` en `doctor`) y `uninstall` lo informa como ya ausente.
- `undo` restaura los bytes originales. Si el archivo cambió después, se niega (código `3`); con `--force` elimina solo los manejadores que shitaku instaló y conserva todo lo demás.
- Claude Code recarga los hooks en caliente y también puede escribir `settings.json`, por ejemplo desde `/config`. shitaku vuelve a leer el archivo antes de escribir, aborta si cambió, hace una copia de seguridad y escribe de forma atómica; aun así, evita `/config` mientras se ejecuta una instalación o un `undo`.
- Las versiones anteriores de shitaku lanzan un `ManifestError` ante una entrada del manifiesto con `kind: 'hook'`: ejecuta `undo` o `uninstall` antes de bajar de versión.
