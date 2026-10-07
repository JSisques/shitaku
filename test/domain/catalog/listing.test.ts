import { describe, expect, it } from 'vitest';
import { collapseWhitespace, listEntries, LIST_KINDS } from '@/domain/catalog/listing.js';
import type { Catalog, McpItem, Profile } from '@/domain/catalog/schema.js';
import type { CommandItem } from '@/domain/catalog/command.js';
import type { ScriptItem } from '@/domain/catalog/script.js';
import type { SkillItem } from '@/domain/catalog/skill.js';

const mcp = (name: string, description: string): McpItem => ({
  name,
  description,
  server: { type: 'stdio', command: 'npx', args: [] },
  env: [],
});
const skill = (name: string, description: string): SkillItem => ({ name, description, files: [] });
const script = (name: string, description: string): ScriptItem => ({ name, description, tools: [], files: [] });
const command = (name: string, description: string): CommandItem => ({
  name,
  description,
  bytes: new Uint8Array(),
});
const profile = (name: string, description?: string): Profile => ({
  name,
  ...(description === undefined ? {} : { description }),
  extends: [],
  mcps: [],
  skills: [],
  scripts: [],
  commands: [],
});

const catalog: Catalog = {
  mcps: [mcp('b', 'Second server'), mcp('a', 'First server'), mcp('fs', 'Filesystem access')],
  skills: [skill('fs-tips', 'Browser automation'), skill('c', 'Third')],
  scripts: [script('lint', 'Run lint'), script('a-script', 'Alpha script')],
  commands: [command('review', 'Review a diff'), command('a-cmd', 'Alpha command')],
  profiles: [profile('base'), profile('full', 'Everything')],
};

describe('LIST_KINDS', () => {
  it('exposes the plural kinds accepted by the CLI', () => {
    expect(LIST_KINDS).toEqual(['mcps', 'skills', 'profiles', 'scripts', 'commands']);
  });
});

describe('collapseWhitespace', () => {
  it('collapses runs of whitespace and trims', () => {
    expect(collapseWhitespace('  a \n\t b   c\r\n')).toBe('a b c');
  });

  it('leaves an already clean text untouched', () => {
    expect(collapseWhitespace('a b')).toBe('a b');
  });
});

describe('listEntries', () => {
  it('maps all five kinds and sorts by kind, then name', () => {
    expect(listEntries(catalog, {})).toEqual([
      { kind: 'command', name: 'a-cmd', description: 'Alpha command' },
      { kind: 'command', name: 'review', description: 'Review a diff' },
      { kind: 'mcp', name: 'a', description: 'First server' },
      { kind: 'mcp', name: 'b', description: 'Second server' },
      { kind: 'mcp', name: 'fs', description: 'Filesystem access' },
      { kind: 'profile', name: 'base', description: null },
      { kind: 'profile', name: 'full', description: 'Everything' },
      { kind: 'script', name: 'a-script', description: 'Alpha script' },
      { kind: 'script', name: 'lint', description: 'Run lint' },
      { kind: 'skill', name: 'c', description: 'Third' },
      { kind: 'skill', name: 'fs-tips', description: 'Browser automation' },
    ]);
  });

  it('keeps the same name when it exists as an MCP and as a skill', () => {
    const both: Catalog = { mcps: [mcp('x', 'm')], skills: [skill('x', 's')], scripts: [], commands: [], profiles: [] };
    expect(listEntries(both, {}).map((e) => `${e.kind}:${e.name}`)).toEqual(['mcp:x', 'skill:x']);
  });

  it('uses singular kind script for JSON-compatible entries', () => {
    expect(listEntries(catalog, { kind: 'scripts' }).map((e) => e.kind)).toEqual(['script', 'script']);
  });

  it.each([
    ['mcps', 'mcp', 3],
    ['skills', 'skill', 2],
    ['profiles', 'profile', 2],
    ['scripts', 'script', 2],
    ['commands', 'command', 2],
  ] as const)('filters by kind %s', (kind, entryKind, count) => {
    const entries = listEntries(catalog, { kind });
    expect(entries).toHaveLength(count);
    expect(entries.every((e) => e.kind === entryKind)).toBe(true);
  });

  it('uses singular kind command for JSON entries and searches the description', () => {
    expect(listEntries(catalog, { kind: 'commands', search: 'DIFF' })).toEqual([
      { kind: 'command', name: 'review', description: 'Review a diff' },
    ]);
  });

  it('matches the search on the description, case-insensitively', () => {
    expect(listEntries(catalog, { search: 'BROWSER' })).toEqual([
      { kind: 'skill', name: 'fs-tips', description: 'Browser automation' },
    ]);
  });

  it('matches the search on the name, case-insensitively', () => {
    expect(listEntries(catalog, { search: 'FULL' }).map((e) => e.name)).toEqual(['full']);
  });

  it('combines the search with the kind filter', () => {
    expect(listEntries(catalog, { kind: 'mcps', search: 'fs' }).map((e) => `${e.kind}:${e.name}`)).toEqual(['mcp:fs']);
    expect(listEntries(catalog, { search: 'fs' }).map((e) => `${e.kind}:${e.name}`)).toEqual([
      'mcp:fs',
      'skill:fs-tips',
    ]);
  });

  const multi: Catalog = { mcps: [mcp('m', 'two\n   words')], skills: [], scripts: [], commands: [], profiles: [] };

  it('searches the whitespace-collapsed description', () => {
    expect(listEntries(multi, { search: 'two words' })).toHaveLength(1);
  });

  it('returns nothing when no entry matches', () => {
    expect(listEntries(catalog, { search: 'zzz-nothing' })).toEqual([]);
  });

  it('treats an empty search as no filter', () => {
    expect(listEntries(catalog, { search: '' })).toHaveLength(11);
  });

  it('keeps raw descriptions untouched', () => {
    expect(listEntries(multi, {})[0]?.description).toBe('two\n   words');
  });
});
