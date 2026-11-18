---
title: Resumen del catálogo
description: Explora los servidores MCP, skills, scripts, comandos slash, hooks, agentes, reglas y perfiles del catálogo incluido.
---

# Resumen del catálogo

Las páginas del catálogo se generan a partir de `catalog/` en el repositorio. Las descripciones de los elementos permanecen en inglés en todos los idiomas. El catálogo incluido trae **`complexity`**, **`dead-code`** y **`duplication`** en `catalog/scripts/`; añade más nombres en `items.scripts` y regenera las páginas del sitio para verlos aquí.

Los comandos slash (`catalog/commands/<name>.md`) tienen su propia página en `commands/` cuando el catálogo lista alguno. El catálogo incluido todavía no trae ninguno.

Los hooks (`catalog/hooks/<name>.json`) tienen su propia página en `hooks/` de la misma forma, con su evento, matcher y comando y un aviso de que los hooks ejecutan código. El catálogo incluido todavía no trae ninguno.

Los agentes (`catalog/agents/<name>.md`) tienen su propia página en `agents/` de la misma forma, con un aviso de que el frontmatter de un agente puede conceder herramientas o permisos. El catálogo incluido todavía no trae ninguno.

Las reglas (`catalog/rules/<name>.md`) tienen su propia página en `rules/`, una por regla incluida, con un aviso de que una regla orienta al agente. El catálogo incluido trae diez y `init --rules <names>` las instala.
