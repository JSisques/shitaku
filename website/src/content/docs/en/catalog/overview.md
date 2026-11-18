---
title: Catalog overview
description: Browse MCP servers, skills, scripts, slash commands, hooks, agents, rules, and profiles from the bundled catalog.
---

# Catalog overview

Catalog pages are generated from `catalog/` in the repository. Item descriptions stay in English in every locale. The bundled catalog ships **`complexity`** and **`dead-code`** under `catalog/scripts/`; list more names in `items.scripts` and regenerate website pages to add them here. Slash commands (`catalog/commands/<name>.md`) get their own pages under `commands/` once the catalog lists any; the bundled catalog ships none yet. Hooks (`catalog/hooks/<name>.json`) get pages under `hooks/` the same way, each with its event, matcher and command and a warning that hooks run code; the bundled catalog ships none yet. Agents (`catalog/agents/<name>.md`) get pages under `agents/` the same way, with a note that an agent's frontmatter can grant tools or permissions; the bundled catalog ships none yet. Rules (`catalog/rules/<name>.md`) get pages under `rules/`, one per bundled rule, with a note that a rule instructs the agent; the bundled catalog ships ten, and `init --rules <names>` installs them.
