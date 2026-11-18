---
title: Seguridad
description: Cómo shitaku trata los secretos y la confianza.
---

# Seguridad

Los secretos se escriben solo como placeholders `${VAR}`, nunca como valores. Trata los catálogos personalizados (`--source`) como código que ejecutas: usa solo carpetas en las que confíes. Los hooks de una carpeta `--source` se fusionan en tu configuración de Claude Code y ejecutan comandos con todos tus permisos de usuario.

## Comandos slash

Claude Code trata el texto de un comando slash como instrucciones cuando ejecutas `/<name>`; shitaku no lo ejecuta, no lo analiza ni lo aísla. Un archivo de comando distinto que shitaku no instaló solo se reemplaza con `--force`, después de una copia de seguridad que `undo` restaura. Solo se escribe el archivo `<name>.md` indicado, nunca los demás archivos de `commands/`, y se rechazan los enlaces simbólicos. Revisa los comandos de una carpeta `--source` antes de usarlos.

## Seguridad de los hooks

Un hook es un archivo JSON, `catalog/hooks/<name>.json`, que añade un manejador `command` a la clave `hooks` de `settings.json`:

| Campo         | Obligatorio | Notas                                                               |
| ------------- | ----------- | ------------------------------------------------------------------- |
| `name`        | sí          | Igual al nombre del archivo                                         |
| `description` | sí          | Texto no vacío                                                      |
| `event`       | sí          | Nombre de un evento de hooks de Claude Code, como `PostToolUse`     |
| `command`     | sí          | El comando de shell que ejecuta Claude Code; sin secretos literales |
| `matcher`     | no          | A qué herramienta u origen se aplica; si se omite, a todos          |
| `timeout`     | no          | Número positivo, se escribe en el manejador tal cual                |

Los campos desconocidos y varios manejadores en un mismo archivo se rechazan.

- Un comando de hook se ejecuta con todos tus permisos de usuario cada vez que Claude Code dispara su evento. shitaku nunca lo ejecuta, pero lo escribe en un archivo que Claude Code ejecuta.
- Los hooks no deben contener secretos literales; usa referencias `${VAR}`. La comprobación del catálogo es heurística (formas conocidas de token y credenciales `NOMBRE=valor`), así que no puede demostrar que un comando esté limpio. Revisa los comandos tú mismo.
- Los hooks de una carpeta `--source` siguen el mismo modelo de confianza y la misma confirmación que los incluidos. Usa solo carpetas en las que confíes.
- `init` muestra el evento, el matcher y el comando exactos y te pide confirmación. `--yes` no es consentimiento: sin `--allow-hooks`, una ejecución no interactiva no escribe nada y termina con código `1`.
- Los hooks de proyecto viven en `./.claude/settings.json`. Si haces commit de ese archivo, se ejecutan para cada colaborador que abra el proyecto.
- shitaku solo toca `settings.json` (nunca `settings.local.json`, la configuración gestionada ni los hooks de plugins), no escribe ninguna marca en él y vuelve a localizar sus hooks por contenido exacto. La configuración debe ser JSON estricto: los comentarios, las comas finales, un BOM o un archivo vacío se rechazan indicando el archivo y no se escribe nada. El archivo se vuelve a serializar, así que se conservan las claves existentes y su orden, la sangría, los saltos de línea (LF o CRLF; un archivo que mezcla ambos se escribe con LF) y el salto de línea final, pero los arrays en una sola línea se expanden, las claves con forma de entero pasan al principio, una clave duplicada conserva solo su último valor, los enteros mayores que 2^53 pierden precisión y las secuencias `\u` se escriben como el carácter normal. `undo` sin ediciones posteriores restaura los bytes originales exactos.
- Desinstalar el hook cuya instalación creó la clave `hooks` puede dejar `"hooks": {}` en el archivo; `undo` restaura los bytes originales exactos.
- Un hook editado deja de coincidir: `status` lo informa como `missing` (código `hook-missing` en `doctor`) y `uninstall` lo informa como ya ausente.
- `undo` restaura los bytes originales. Si el archivo cambió después, se niega (código `3`); con `--force` elimina solo los manejadores que shitaku instaló y conserva todo lo demás.
- Claude Code recarga los hooks en caliente y también puede escribir `settings.json`, por ejemplo desde `/config`. shitaku vuelve a leer el archivo antes de escribir; si cambió, vuelve a planificar y aborta solo cuando las acciones planificadas difieren, y después hace una copia de seguridad y escribe de forma atómica; aun así, evita `/config` mientras se ejecuta una instalación o un `undo`.
- Las versiones anteriores de shitaku lanzan un `ManifestError` ante una entrada del manifiesto con `kind: 'hook'`: ejecuta `undo` o `uninstall` antes de bajar de versión.

## Seguridad de los agentes

Un agente es un archivo Markdown, `catalog/agents/<name>.md`, que Claude Code carga como subagente. Necesita un `name` igual al nombre del archivo, una `description` y un cuerpo no vacío; ambos pueden ir en una línea o como bloque escalar. Otras claves, como `tools`, `model`, `hooks` o `mcpServers`, pueden ocupar varias líneas; se copian tal cual, no se validan y las claves desconocidas se ignoran.

- El frontmatter de un agente puede conceder herramientas o permisos. Los agentes instalados se tratan con la misma confianza que las skills y los comandos slash: shitaku copia el archivo y no lo analiza ni lo aísla.
- Los agentes de una carpeta `--source` son código no confiable. Léelos antes de instalarlos y usa solo carpetas en las que confíes.
- Un `name` o una `description` pueden ser un bloque escalar literal (`|`) o plegado (`>`). La descripción se muestra en una sola línea con los espacios colapsados y el archivo se instala tal cual. Otras formas multilínea para estas dos claves se rechazan.
- Los agentes se instalan en `~/.claude/agents/<name>.md` (`user`) o `./.claude/agents/<name>.md` (`project`). Un archivo distinto que shitaku no instaló nunca se sobrescribe en silencio: `init` termina con código `2` y no escribe nada, y `--force` hace antes una copia de seguridad que `undo` puede restaurar.
- `uninstall` rechaza un agente modificado desde la instalación salvo que uses `--force`.
- Las versiones anteriores de shitaku lanzan un `ManifestError` ante una entrada del manifiesto con `kind: 'agent'`: ejecuta `undo` o `uninstall` para los agentes antes de bajar de versión.

## Seguridad de las reglas

Una regla es un archivo Markdown, `catalog/rules/<name>.md`, que Claude Code carga como instrucción. Necesita un `name` de una sola línea igual al nombre del archivo, una `description` de una sola línea y un cuerpo no vacío. Otras claves, como `paths`, pueden ocupar varias líneas; se copian tal cual y no se validan, así que el YAML mal formado en ellas no se detecta (entrecomilla los patrones glob). `check` y `severity` están reservadas y se rechazan.

- Una regla orienta al agente: una regla instalada se carga en su contexto y condiciona lo que hace. Las reglas instaladas se tratan con la misma confianza que las skills y los comandos slash: shitaku copia el archivo y no lo analiza ni lo aísla.
- Las reglas de una carpeta `--source` son instrucciones no confiables. Léelas antes de instalarlas y usa solo carpetas en las que confíes.
- Las reglas se instalan en `~/.claude/rules/<name>.md` (`user`) o `./.claude/rules/<name>.md` (`project`). Un archivo distinto que shitaku no instaló nunca se sobrescribe en silencio: `init` termina con código `2` y no escribe nada, y `--force` hace antes una copia de seguridad que `undo` puede restaurar.
- `uninstall` rechaza una regla modificada desde la instalación salvo que uses `--force`.
- Las versiones anteriores de shitaku lanzan un `ManifestError` ante una entrada del manifiesto con `kind: 'rule'`: ejecuta `undo` o `uninstall` para las reglas antes de bajar de versión.
