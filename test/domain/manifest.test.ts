import { describe, expect, it } from 'vitest';
import {
  deriveCommandOwnership,
  deriveHookOwnership,
  deriveOwnedItems,
  deriveOwnership,
  deriveScriptOwnership,
  deriveSkillOwnership,
  emptyManifest,
  ManifestError,
  parseManifest,
  type Install,
  type Manifest,
} from '@/domain/manifest.js';

const install = (id: string, name: string, entryHash: string, over: Partial<Install> = {}): Install => ({
  id,
  createdAt: '2026-10-02T10:15:00.000Z',
  undoneAt: null,
  source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
  files: [
    {
      path: '/p/.mcp.json',
      scope: 'project',
      backup: null,
      beforeHash: null,
      afterHash: 'after',
      items: [{ kind: 'mcp', name, action: 'create', entryHash }],
    },
  ],
  createdDirs: [],
  ...over,
});

const skillInstall = (id: string, root: string, entryHash: string, over: Partial<Install> = {}): Install => ({
  id,
  createdAt: '2026-10-02T10:15:00.000Z',
  undoneAt: null,
  source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
  files: ['SKILL.md', 'notes.md'].map((f) => ({
    path: `${root}/${f}`,
    scope: 'user' as const,
    backup: null,
    beforeHash: null,
    afterHash: 'h',
    items: [{ kind: 'skill' as const, name: root.split('/').pop() ?? '', action: 'create' as const, entryHash, root }],
  })),
  createdDirs: [root],
  ...over,
});

const commandInstall = (id: string, path: string, entryHash: string, over: Partial<Install> = {}): Install => ({
  id,
  createdAt: '2026-10-02T10:15:00.000Z',
  undoneAt: null,
  source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
  files: [
    {
      path,
      scope: 'project',
      backup: null,
      beforeHash: null,
      afterHash: entryHash,
      items: [
        {
          kind: 'command',
          name: path.split('/').pop()?.replace(/\.md$/, '') ?? '',
          action: 'create',
          entryHash,
          root: path,
        },
      ],
    },
  ],
  createdDirs: [],
  ...over,
});

const removeCommandInstall = (id: string, path: string, over: Partial<Install> = {}): Install => {
  const base = commandInstall(id, path, 'observed');
  return {
    ...base,
    files: base.files.map((f) => ({
      ...f,
      backup: `backups/${id}/review.md`,
      beforeHash: 'observed',
      afterHash: null,
      items: f.items.map((i) => ({ ...i, action: 'remove' as const })),
    })),
    ...over,
  };
};

const manifest = (installs: Install[]): Manifest => ({ version: 1, installs });

const removeInstall = (id: string, name: string, over: Partial<Install> = {}): Install => ({
  ...install(id, name, 'observed'),
  files: [
    {
      path: '/p/.mcp.json',
      scope: 'project',
      backup: 'backups/x/0-.mcp.json',
      beforeHash: 'before',
      afterHash: 'after2',
      items: [{ kind: 'mcp', name, action: 'remove', entryHash: 'observed' }],
    },
  ],
  ...over,
});

const removeSkillInstall = (id: string, root: string, over: Partial<Install> = {}): Install => ({
  ...skillInstall(id, root, 'observed'),
  files: ['SKILL.md', 'notes.md'].map((f) => ({
    path: `${root}/${f}`,
    scope: 'user' as const,
    backup: `backups/${id}/${f}`,
    beforeHash: 'h',
    afterHash: null,
    items: [
      {
        kind: 'skill' as const,
        name: root.split('/').pop() ?? '',
        action: 'remove' as const,
        entryHash: 'observed',
        root,
      },
    ],
  })),
  createdDirs: [],
  ...over,
});

const scriptInstall = (id: string, root: string, entryHash: string, over: Partial<Install> = {}): Install => ({
  id,
  createdAt: '2026-10-02T10:15:00.000Z',
  undoneAt: null,
  source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
  files: ['index.mjs', 'script.json'].map((f) => ({
    path: `${root}/${f}`,
    scope: 'project' as const,
    backup: null,
    beforeHash: null,
    afterHash: 'h',
    items: [{ kind: 'script' as const, name: root.split('/').pop() ?? '', action: 'create' as const, entryHash, root }],
  })),
  createdDirs: [root],
  ...over,
});

const removeScriptInstall = (id: string, root: string, over: Partial<Install> = {}): Install => ({
  ...scriptInstall(id, root, 'observed'),
  files: ['index.mjs', 'script.json'].map((f) => ({
    path: `${root}/${f}`,
    scope: 'project' as const,
    backup: `backups/${id}/${f}`,
    beforeHash: 'h',
    afterHash: null,
    items: [
      {
        kind: 'script' as const,
        name: root.split('/').pop() ?? '',
        action: 'remove' as const,
        entryHash: 'observed',
        root,
      },
    ],
  })),
  createdDirs: [],
  ...over,
});

describe('remove action replay', () => {
  const root = '/h/.claude/skills/demo';
  const undoneAt = '2026-10-03T00:00:00.000Z';

  it('an MCP remove drops only the removed entry from ownership', () => {
    const m = manifest([install('a', 'github', 'h1'), install('b', 'fs', 'h2'), removeInstall('c', 'github')]);
    expect(deriveOwnership(m)).toEqual({ '/p/.mcp.json': { fs: 'h2' } });
    // Removing the last entry of a file leaves no empty per-file map behind.
    expect(deriveOwnership(manifest([install('a', 'github', 'h1'), removeInstall('c', 'github')]))).toEqual({});
  });

  it('a reinstall after a remove owns the item again', () => {
    const m = manifest([install('a', 'github', 'h1'), removeInstall('b', 'github'), install('c', 'github', 'h3')]);
    expect(deriveOwnership(m)['/p/.mcp.json']).toEqual({ github: 'h3' });
    expect(deriveOwnedItems(m).map((o) => [o.name, o.hash, o.installId])).toEqual([['github', 'h3', 'c']]);
  });

  it('an undone uninstall leaves the earlier install owning the item', () => {
    const m = manifest([install('a', 'github', 'h1'), removeInstall('b', 'github', { undoneAt })]);
    expect(deriveOwnership(m)['/p/.mcp.json']).toEqual({ github: 'h1' });
    expect(deriveOwnedItems(m).map((o) => [o.name, o.hash])).toEqual([['github', 'h1']]);
  });

  it('deriveOwnedItems drops a removed MCP', () => {
    expect(deriveOwnedItems(manifest([install('a', 'github', 'h1'), removeInstall('b', 'github')]))).toEqual([]);
  });

  it('a skill remove drops the root from skill ownership and owned items', () => {
    const m = manifest([skillInstall('a', root, 'tree1'), removeSkillInstall('b', root)]);
    expect(deriveSkillOwnership(m)).toEqual({});
    expect(deriveOwnedItems(m)).toEqual([]);
  });

  it('skill remove then reinstall, and undone skill uninstall', () => {
    const steps = [skillInstall('a', root, 'tree1'), removeSkillInstall('b', root), skillInstall('c', root, 'tree3')];
    expect(deriveSkillOwnership(manifest(steps))).toEqual({ [root]: 'tree3' });
    const undone = manifest([skillInstall('a', root, 'tree1'), removeSkillInstall('b', root, { undoneAt })]);
    expect(deriveSkillOwnership(undone)).toEqual({ [root]: 'tree1' });
    expect(deriveOwnedItems(undone).map((o) => o.hash)).toEqual(['tree1']);
  });

  it('parses a remove action for MCPs and skills, keeping manifest version 1', () => {
    const m = manifest([install('a', 'github', 'h1'), removeInstall('b', 'github'), removeSkillInstall('c', root)]);
    const parsed = parseManifest(JSON.stringify(m));
    expect(parsed).toEqual(m);
    expect(parsed.version).toBe(1);
  });
});

describe('deriveOwnership', () => {
  it('is empty for an empty manifest', () => {
    expect(deriveOwnership(emptyManifest())).toEqual({});
  });

  it('maps each file and entry name to its installed hash', () => {
    expect(deriveOwnership(manifest([install('a', 'github', 'h1')]))).toEqual({ '/p/.mcp.json': { github: 'h1' } });
  });

  it('lets a later install replace the hash of an earlier one', () => {
    const owned = deriveOwnership(manifest([install('a', 'github', 'h1'), install('b', 'github', 'h2')]));
    expect(owned['/p/.mcp.json']?.github).toBe('h2');
  });

  it('ignores undone installs', () => {
    const undone = install('b', 'github', 'h2', { undoneAt: '2026-10-03T00:00:00.000Z' });
    expect(deriveOwnership(manifest([install('a', 'github', 'h1'), undone]))['/p/.mcp.json']?.github).toBe('h1');
    expect(deriveOwnership(manifest([undone]))).toEqual({});
  });
});

describe('deriveOwnership with skill items', () => {
  it('ignores skill items so file-keyed MCP ownership stays untouched', () => {
    expect(deriveOwnership(manifest([skillInstall('a', '/h/.claude/skills/demo', 'tree1')]))).toEqual({});
  });
});

describe('deriveSkillOwnership', () => {
  const root = '/h/.claude/skills/demo';

  it('is empty for an empty manifest or one with only MCP items', () => {
    expect(deriveSkillOwnership(emptyManifest())).toEqual({});
    expect(deriveSkillOwnership(manifest([install('a', 'github', 'h1')]))).toEqual({});
  });

  it('maps each skill root to its installed tree hash', () => {
    expect(deriveSkillOwnership(manifest([skillInstall('a', root, 'tree1')]))).toEqual({ [root]: 'tree1' });
  });

  it('lets a later install replace the hash and ignores undone installs', () => {
    const undone = skillInstall('c', root, 'tree3', { undoneAt: '2026-10-03T00:00:00.000Z' });
    const owned = deriveSkillOwnership(
      manifest([skillInstall('a', root, 'tree1'), skillInstall('b', root, 'tree2'), undone]),
    );
    expect(owned).toEqual({ [root]: 'tree2' });
  });

  it('ignores script items', () => {
    expect(deriveSkillOwnership(manifest([scriptInstall('a', '/w/.shitaku/scripts/lint', 'tree1')]))).toEqual({});
  });
});

describe('deriveScriptOwnership', () => {
  const root = '/w/.shitaku/scripts/lint';

  it('is empty for an empty manifest or one with only MCP/skill items', () => {
    expect(deriveScriptOwnership(emptyManifest())).toEqual({});
    expect(deriveScriptOwnership(manifest([install('a', 'github', 'h1')]))).toEqual({});
    expect(deriveScriptOwnership(manifest([skillInstall('a', '/h/.claude/skills/demo', 'tree1')]))).toEqual({});
  });

  it('maps each script root to its installed tree hash', () => {
    expect(deriveScriptOwnership(manifest([scriptInstall('a', root, 'tree1')]))).toEqual({ [root]: 'tree1' });
  });

  it('lets a later install replace the hash and ignores undone installs', () => {
    const undone = scriptInstall('c', root, 'tree3', { undoneAt: '2026-10-03T00:00:00.000Z' });
    const owned = deriveScriptOwnership(
      manifest([scriptInstall('a', root, 'tree1'), scriptInstall('b', root, 'tree2'), undone]),
    );
    expect(owned).toEqual({ [root]: 'tree2' });
  });

  it('a script remove drops the root; remove then reinstall owns again', () => {
    expect(
      deriveScriptOwnership(manifest([scriptInstall('a', root, 'tree1'), removeScriptInstall('b', root)])),
    ).toEqual({});
    const steps = [
      scriptInstall('a', root, 'tree1'),
      removeScriptInstall('b', root),
      scriptInstall('c', root, 'tree3'),
    ];
    expect(deriveScriptOwnership(manifest(steps))).toEqual({ [root]: 'tree3' });
  });
});

describe('deriveOwnedItems', () => {
  const root = '/h/.claude/skills/demo';
  const scriptRoot = '/w/.shitaku/scripts/lint';

  it('is empty for an empty manifest', () => {
    expect(deriveOwnedItems(emptyManifest())).toEqual([]);
  });

  it('lists MCPs by config path and skills by root, each with its install id', () => {
    const owned = deriveOwnedItems(manifest([install('a', 'github', 'h1'), skillInstall('b', root, 'tree1')]));
    expect(owned).toEqual([
      { kind: 'mcp', scope: 'project', path: '/p/.mcp.json', name: 'github', hash: 'h1', installId: 'a' },
      { kind: 'skill', scope: 'user', path: root, name: 'demo', hash: 'tree1', installId: 'b' },
    ]);
  });

  it('lists scripts by root with kind script', () => {
    const owned = deriveOwnedItems(manifest([scriptInstall('s', scriptRoot, 'tree1')]));
    expect(owned).toEqual([
      { kind: 'script', scope: 'project', path: scriptRoot, name: 'lint', hash: 'tree1', installId: 's' },
    ]);
  });

  it('excludes undone installs', () => {
    const undone = install('b', 'github', 'h2', { undoneAt: '2026-10-03T00:00:00.000Z' });
    expect(deriveOwnedItems(manifest([undone]))).toEqual([]);
    expect(deriveOwnedItems(manifest([install('a', 'github', 'h1'), undone]))).toEqual([
      { kind: 'mcp', scope: 'project', path: '/p/.mcp.json', name: 'github', hash: 'h1', installId: 'a' },
    ]);
  });

  it('keeps the newest install hash and its install id', () => {
    const owned = deriveOwnedItems(manifest([install('a', 'github', 'h1'), install('b', 'github', 'h2')]));
    expect(owned).toEqual([
      { kind: 'mcp', scope: 'project', path: '/p/.mcp.json', name: 'github', hash: 'h2', installId: 'b' },
    ]);
  });

  it('keeps the same name in two scopes apart', () => {
    const user = install('b', 'fs', 'h2', {
      files: [{ ...install('b', 'fs', 'h2').files[0]!, path: '/h/.claude.json', scope: 'user' }],
    });
    const owned = deriveOwnedItems(manifest([install('a', 'fs', 'h1'), user]));
    expect(owned.map((o) => [o.scope, o.path, o.hash, o.installId])).toEqual([
      ['project', '/p/.mcp.json', 'h1', 'a'],
      ['user', '/h/.claude.json', 'h2', 'b'],
    ]);
  });

  it('lists a skill once even though its install records one item per file', () => {
    expect(deriveOwnedItems(manifest([skillInstall('a', root, 'tree1')]))).toHaveLength(1);
  });

  it('drops a removed script from owned items', () => {
    expect(
      deriveOwnedItems(manifest([scriptInstall('a', scriptRoot, 'tree1'), removeScriptInstall('b', scriptRoot)])),
    ).toEqual([]);
  });
});

describe('parseManifest', () => {
  it('parses a literal manifest JSON written before skills existed', () => {
    const text = `{"version":1,"installs":[{"id":"20260101T000000-ab12","createdAt":"2026-01-01T00:00:00.000Z",
      "undoneAt":null,"source":{"kind":"bundled","location":"/c","catalogVersion":1},
      "files":[{"path":"/p/.mcp.json","scope":"project","backup":null,"beforeHash":null,"afterHash":"h",
      "items":[{"kind":"mcp","name":"github","action":"create","entryHash":"e"}]}]}]}`;
    const parsed = parseManifest(text);
    expect(parsed.installs[0]?.createdDirs).toEqual([]);
    expect(deriveOwnership(parsed)).toEqual({ '/p/.mcp.json': { github: 'e' } });
  });

  it('rejects a null afterHash on an MCP file but accepts it on a skill file', () => {
    const base = install('a', 'github', 'h1');
    const file = { ...base.files[0]!, afterHash: null };
    expect(() => parseManifest(JSON.stringify(manifest([{ ...base, files: [file] }])))).toThrow(ManifestError);
    const skill = skillInstall('b', '/h/.claude/skills/demo', 'th');
    const dropped = { ...skill, files: skill.files.map((f) => ({ ...f, afterHash: null })) };
    expect(parseManifest(JSON.stringify(manifest([dropped]))).installs[0]?.files[0]?.afterHash).toBeNull();
  });

  it('accepts a null afterHash on a script file', () => {
    const script = scriptInstall('s', '/w/.shitaku/scripts/lint', 'th');
    const dropped = { ...script, files: script.files.map((f) => ({ ...f, afterHash: null })) };
    expect(parseManifest(JSON.stringify(manifest([dropped]))).installs[0]?.files[0]?.afterHash).toBeNull();
  });

  it('parses a manifest written before skills existed, defaulting createdDirs to []', () => {
    const old = { ...install('a', 'github', 'h1'), createdDirs: undefined };
    const parsed = parseManifest(JSON.stringify({ version: 1, installs: [old] }));
    expect(parsed.installs[0]?.createdDirs).toEqual([]);
  });

  it('round-trips a skill install with a null afterHash for a removed file', () => {
    const base = skillInstall('a', '/h/.claude/skills/demo', 'tree1');
    const removed = {
      ...base.files[0]!,
      path: '/h/.claude/skills/demo/old.md',
      backup: 'backups/a/0-old.md',
      beforeHash: 'x',
      afterHash: null,
    };
    const m = manifest([{ ...base, files: [...base.files, removed] }]);
    expect(parseManifest(JSON.stringify(m))).toEqual(m);
  });

  it('rejects a skill item without a root', () => {
    const m = manifest([skillInstall('a', '/r', 'h')]);
    const text = JSON.stringify(m)
      .replace(/"root":"[^"]*",?/g, '')
      .replace(',}', '}');
    expect(text).not.toContain('"root"');
    expect(() => parseManifest(text)).toThrow(ManifestError);
  });

  it('round-trips a valid manifest', () => {
    const m = manifest([install('a', 'github', 'h1')]);
    expect(parseManifest(JSON.stringify(m))).toEqual(m);
  });

  it('rejects invalid JSON and wrong shapes with ManifestError', () => {
    expect(() => parseManifest('{ nope')).toThrow(ManifestError);
    expect(() => parseManifest('{"version":2,"installs":[]}')).toThrow(ManifestError);
  });
});

describe('command items', () => {
  const path = '/w/.claude/commands/review.md';

  it('parses a command item whose root is the file path', () => {
    const parsed = parseManifest(JSON.stringify(manifest([commandInstall('a', path, 'h1')])));
    expect(parsed.installs[0]?.files[0]?.items[0]).toMatchObject({ kind: 'command', name: 'review', root: path });
  });

  it('accepts a null afterHash on a command file but still rejects it on an MCP file', () => {
    const removed = removeCommandInstall('b', path);
    expect(parseManifest(JSON.stringify(manifest([removed]))).installs[0]?.files[0]?.afterHash).toBeNull();
    const mcp = install('c', 'github', 'h1');
    const file = { ...mcp.files[0]!, afterHash: null };
    expect(() => parseManifest(JSON.stringify(manifest([{ ...mcp, files: [file] }])))).toThrow(ManifestError);
  });

  it('loads a manifest without any command and keeps version 1', () => {
    const parsed = parseManifest(JSON.stringify(manifest([install('a', 'github', 'h1')])));
    expect(parsed.version).toBe(1);
    expect(deriveCommandOwnership(parsed)).toEqual({});
  });
});

describe('deriveCommandOwnership', () => {
  const path = '/w/.claude/commands/review.md';

  it('is empty without commands, ignoring MCP, skill and script items', () => {
    expect(deriveCommandOwnership(emptyManifest())).toEqual({});
    expect(deriveCommandOwnership(manifest([install('a', 'github', 'h1')]))).toEqual({});
    expect(deriveCommandOwnership(manifest([skillInstall('a', '/h/.claude/skills/demo', 'tree1')]))).toEqual({});
  });

  it('maps each command file path to its hash; a later install replaces it and undone ones are ignored', () => {
    const undone = commandInstall('c', path, 'h3', { undoneAt: '2026-10-03T00:00:00.000Z' });
    expect(deriveCommandOwnership(manifest([commandInstall('a', path, 'h1')]))).toEqual({ [path]: 'h1' });
    expect(
      deriveCommandOwnership(manifest([commandInstall('a', path, 'h1'), commandInstall('b', path, 'h2'), undone])),
    ).toEqual({ [path]: 'h2' });
  });

  it('a command remove drops the path; reinstalling owns it again', () => {
    expect(
      deriveCommandOwnership(manifest([commandInstall('a', path, 'h1'), removeCommandInstall('b', path)])),
    ).toEqual({});
    const steps = [commandInstall('a', path, 'h1'), removeCommandInstall('b', path), commandInstall('c', path, 'h3')];
    expect(deriveCommandOwnership(manifest(steps))).toEqual({ [path]: 'h3' });
  });

  it('lists commands in owned items by file path with kind command', () => {
    expect(deriveOwnedItems(manifest([commandInstall('a', path, 'h1')]))).toEqual([
      { kind: 'command', scope: 'project', path, name: 'review', hash: 'h1', installId: 'a' },
    ]);
  });
});

type HookItem = Extract<Install['files'][number]['items'][number], { kind: 'hook' }>;

const settings = '/w/.claude/settings.json';
const handler = { type: 'command', command: 'pnpm run fmt', timeout: 30 };

const hookItem = (over: Partial<HookItem> = {}): HookItem => ({
  kind: 'hook',
  name: 'fmt',
  action: 'create',
  entryHash: 'hh1',
  event: 'PostToolUse',
  matcher: 'Edit|Write',
  handler,
  createdEvent: true,
  createdGroup: true,
  ...over,
});

const hookInstall = (id: string, item: HookItem, over: Partial<Install> = {}): Install => ({
  id,
  createdAt: '2026-10-02T10:15:00.000Z',
  undoneAt: null,
  source: { kind: 'bundled', location: '/catalog', catalogVersion: 1 },
  files: [{ path: settings, scope: 'project', backup: null, beforeHash: null, afterHash: 'after', items: [item] }],
  createdDirs: [],
  ...over,
});

describe('hook items', () => {
  it('round-trips a hook item with event, matcher, handler and the created flags', () => {
    const m = manifest([hookInstall('a', hookItem())]);
    const parsed = parseManifest(JSON.stringify(m));
    expect(parsed).toEqual(m);
    expect(parsed.version).toBe(1);
  });

  it('stores a null matcher for a hook declared without one', () => {
    const m = manifest([hookInstall('a', hookItem({ matcher: null, createdGroup: false }))]);
    expect(parseManifest(JSON.stringify(m)).installs[0]?.files[0]?.items[0]).toMatchObject({ matcher: null });
  });

  it('keeps the replaced handler of an update', () => {
    const previous = { type: 'command', command: 'pnpm run fmt:old' };
    const m = manifest([hookInstall('a', hookItem({ action: 'update', previous }))]);
    expect(parseManifest(JSON.stringify(m)).installs[0]?.files[0]?.items[0]).toMatchObject({ previous });
  });

  it('rejects a hook item without an event', () => {
    const text = JSON.stringify(manifest([hookInstall('a', hookItem())])).replace('"event":"PostToolUse",', '');
    expect(text).not.toContain('"event"');
    expect(() => parseManifest(text)).toThrow(ManifestError);
  });

  it('rejects a null afterHash on a hook file: an install never deletes the settings file', () => {
    const base = hookInstall('a', hookItem());
    const file = { ...base.files[0]!, afterHash: null };
    expect(() => parseManifest(JSON.stringify(manifest([{ ...base, files: [file] }])))).toThrow(ManifestError);
  });

  it('parses a manifest that has no hook items and replays it unchanged', () => {
    const text = `{"version":1,"installs":[{"id":"20260101T000000-ab12","createdAt":"2026-01-01T00:00:00.000Z",
      "undoneAt":null,"source":{"kind":"bundled","location":"/c","catalogVersion":1},
      "files":[{"path":"/p/.mcp.json","scope":"project","backup":null,"beforeHash":null,"afterHash":"h",
      "items":[{"kind":"mcp","name":"github","action":"create","entryHash":"e"}]}]}]}`;
    const parsed = parseManifest(text);
    expect(deriveHookOwnership(parsed)).toEqual({});
    expect(deriveOwnedItems(parsed).map((o) => o.kind)).toEqual(['mcp']);
  });
});

describe('deriveHookOwnership', () => {
  const owned = (over: Partial<HookItem> = {}) => ({
    entryHash: 'hh1',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    handler,
    createdEvent: true,
    createdGroup: true,
    ...over,
  });

  it('maps settings path and hook name to what shitaku last wrote', () => {
    expect(deriveHookOwnership(manifest([hookInstall('a', hookItem())]))).toEqual({ [settings]: { fmt: owned() } });
  });

  it('lets a later install replace the entry and ignores undone installs', () => {
    const later = hookItem({ action: 'update', entryHash: 'hh2', createdEvent: false, createdGroup: false });
    const undone = hookInstall('c', hookItem({ entryHash: 'hh3' }), { undoneAt: '2026-10-03T00:00:00.000Z' });
    const m = manifest([hookInstall('a', hookItem()), hookInstall('b', later), undone]);
    expect(deriveHookOwnership(m)[settings]?.fmt).toMatchObject({ entryHash: 'hh2', createdEvent: false });
  });

  it('a remove drops the hook and the file entry once empty; reinstalling owns it again', () => {
    const removed = hookInstall('b', hookItem({ action: 'remove' }));
    expect(deriveHookOwnership(manifest([hookInstall('a', hookItem()), removed]))).toEqual({});
    const again = hookInstall('c', hookItem({ entryHash: 'hh4' }));
    expect(deriveHookOwnership(manifest([hookInstall('a', hookItem()), removed, again]))[settings]?.fmt).toMatchObject({
      entryHash: 'hh4',
    });
  });

  it('ignores MCP, skill and command items', () => {
    const m = manifest([install('a', 'github', 'h1'), commandInstall('b', '/w/.claude/commands/x.md', 'h2')]);
    expect(deriveHookOwnership(m)).toEqual({});
  });

  it('keeps hooks out of the MCP, skill and command ownership maps', () => {
    const m = manifest([hookInstall('a', hookItem())]);
    expect(deriveOwnership(m)).toEqual({});
    expect(deriveCommandOwnership(m)).toEqual({});
    expect(deriveSkillOwnership(m)).toEqual({});
  });

  it('lists a hook in owned items by its settings file path with kind hook', () => {
    expect(deriveOwnedItems(manifest([hookInstall('a', hookItem())]))).toEqual([
      {
        kind: 'hook',
        scope: 'project',
        path: settings,
        name: 'fmt',
        hash: 'hh1',
        installId: 'a',
        hook: {
          entryHash: 'hh1',
          event: 'PostToolUse',
          matcher: 'Edit|Write',
          handler,
          createdEvent: true,
          createdGroup: true,
        },
      },
    ]);
    expect(
      deriveOwnedItems(manifest([hookInstall('a', hookItem()), hookInstall('b', hookItem({ action: 'remove' }))])),
    ).toEqual([]);
  });
});
