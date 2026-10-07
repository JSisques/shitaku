import type { HookItem } from '@/domain/catalog/hook.js';
import type { CatalogSource } from '@/ports/catalog-source.js';

/** A catalog source that serves the given hooks and no other kind. */
export const hookSource = (hooks: HookItem[]): CatalogSource => ({
  ref: () => ({ kind: 'bundled', location: '/catalog' }),
  load: () => Promise.resolve({ mcps: [], skills: [], scripts: [], commands: [], hooks, profiles: [], issues: [] }),
});

/** A hook with a matcher and a newer catalog version of it. */
export const FMT_V1: HookItem = {
  name: 'fmt',
  description: 'Format after edits',
  event: 'PostToolUse',
  matcher: 'Edit|Write',
  command: 'prettier -w .',
};
export const FMT_V2: HookItem = { ...FMT_V1, command: 'prettier -w . && eslint --fix .', timeout: 30 };
/** A hook on an event without a matcher. */
export const GUARD: HookItem = {
  name: 'guard',
  description: 'Stop guard',
  event: 'Stop',
  command: './guard.sh',
};
