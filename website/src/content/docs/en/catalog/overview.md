---
title: Catalog overview
description: Browse MCP servers, skills, scripts, slash commands, hooks, and profiles from the bundled catalog.
---

# Catalog overview

Catalog pages are generated from `catalog/` in the repository. Item descriptions stay in English in every locale. The bundled catalog ships **`complexity`** and **`dead-code`** under `catalog/scripts/`; list more names in `items.scripts` and regenerate website pages to add them here. Slash commands (`catalog/commands/<name>.md`) get their own pages under `commands/` once the catalog lists any; the bundled catalog ships none yet. Hooks (`catalog/hooks/<name>.json`) get pages under `hooks/` the same way, each with its event, matcher and command and a warning that hooks run code; the bundled catalog ships none yet.
