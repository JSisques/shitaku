import type { CommandItem } from '@/domain/catalog/command.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
import { enc } from '@test/helpers/skills.js';

/** A catalog source that serves the given commands and no MCPs/skills/scripts. */
export const commandSource = (commands: CommandItem[]): CatalogSource => ({
  ref: () => ({ kind: 'bundled', location: '/catalog' }),
  load: () => Promise.resolve({ mcps: [], skills: [], scripts: [], commands, hooks: [], profiles: [], issues: [] }),
});

/** A command and a newer catalog version of it. */
export const REVIEW_V1: CommandItem = {
  name: 'review',
  description: 'Review a diff',
  bytes: enc('---\ndescription: Review a diff\nargument-hint: [path]\n---\nReview $ARGUMENTS\n'),
};
export const REVIEW_V2: CommandItem = { ...REVIEW_V1, bytes: enc('---\ndescription: Review a diff\n---\nReview v2\n') };
