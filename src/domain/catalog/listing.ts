import type { Catalog } from '@/domain/catalog/schema.js';

/** Plural kinds accepted by the `list` command. */
export const LIST_KINDS = ['mcps', 'skills', 'profiles', 'scripts'] as const;
export type ListKind = (typeof LIST_KINDS)[number];
export type EntryKind = 'mcp' | 'profile' | 'skill' | 'script';

export interface CatalogEntry {
  kind: EntryKind;
  name: string;
  description: string | null;
}

export interface ListRequest {
  kind?: ListKind;
  search?: string;
}

const ENTRY_KIND: Record<ListKind, EntryKind> = {
  mcps: 'mcp',
  skills: 'skill',
  profiles: 'profile',
  scripts: 'script',
};

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Replaces every run of whitespace with a single space and trims the ends. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Flattens the catalog into entries, filtered by kind and search, sorted by kind and then name. */
export function listEntries(catalog: Catalog, req: ListRequest): CatalogEntry[] {
  const all: CatalogEntry[] = [
    ...catalog.mcps.map((m) => ({ kind: ENTRY_KIND.mcps, name: m.name, description: m.description })),
    ...catalog.skills.map((s) => ({ kind: ENTRY_KIND.skills, name: s.name, description: s.description })),
    ...catalog.scripts.map((s) => ({ kind: ENTRY_KIND.scripts, name: s.name, description: s.description })),
    ...catalog.profiles.map((p) => ({ kind: ENTRY_KIND.profiles, name: p.name, description: p.description ?? null })),
  ];
  const wanted = req.kind === undefined ? undefined : ENTRY_KIND[req.kind];
  const query = (req.search ?? '').toLowerCase();
  return all
    .filter((e) => wanted === undefined || e.kind === wanted)
    .filter(
      (e) =>
        query === '' ||
        e.name.toLowerCase().includes(query) ||
        (e.description !== null && collapseWhitespace(e.description).toLowerCase().includes(query)),
    )
    .sort((a, b) => compare(a.kind, b.kind) || compare(a.name, b.name));
}
