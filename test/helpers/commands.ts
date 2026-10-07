import type { CommandItem } from '@/domain/catalog/command.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
/** A catalog source that serves the given commands and no MCPs/skills/scripts. */
export const commandSource = (commands: CommandItem[]): CatalogSource => ({
  ref: () => ({ kind: 'bundled', location: '/catalog' }),
  load: () => Promise.resolve({ mcps: [], skills: [], scripts: [], commands, profiles: [], issues: [] }),
});
