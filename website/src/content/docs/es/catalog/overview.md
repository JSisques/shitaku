---
title: Resumen del catálogo
description: Explora los servidores MCP, skills, scripts, comandos slash, hooks y perfiles del catálogo incluido.
---

# Resumen del catálogo

Las páginas del catálogo se generan a partir de `catalog/` en el repositorio. Las descripciones de los elementos permanecen en inglés en todos los idiomas. El catálogo incluido trae **`complexity`**, **`dead-code`** y **`duplication`** en `catalog/scripts/`; añade más nombres en `items.scripts` y regenera las páginas del sitio para verlos aquí.

Los comandos slash (`catalog/commands/<name>.md`) tienen su propia página en `commands/` cuando el catálogo lista alguno. El catálogo incluido todavía no trae ninguno.

Los hooks (`catalog/hooks/<name>.json`) tienen su propia página en `hooks/` de la misma forma, con su evento, matcher y comando y un aviso de que los hooks ejecutan código. El catálogo incluido todavía no trae ninguno.
