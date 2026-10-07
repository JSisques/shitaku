import { describe, expect, it } from 'vitest';
import { addHook, hasHook, removeHook, updateHook, type HookSpec } from '@/domain/hook-merge.js';
import { ConfigError } from '@/domain/json-merge.js';

const FILE = '/home/u/.claude/settings.json';
const handler = { type: 'command', command: 'prettier --write', timeout: 30 };
const spec: HookSpec = { event: 'PostToolUse', matcher: 'Edit|Write', handler };

const json = (value: unknown, indent: number | string = 2, trailing = '\n'): string =>
  JSON.stringify(value, null, indent) + trailing;
const parse = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe('addHook', () => {
  it('creates the whole structure when the file is absent', () => {
    const result = addHook(null, FILE, spec);
    expect(result).toEqual({
      text: json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [handler] }] } }),
      action: 'create',
      createdEvent: true,
      createdGroup: true,
    });
  });

  it('appends a new event after the existing ones and keeps unknown keys and order', () => {
    const before = json({
      theme: 'dark',
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'user' }] }] },
      permissions: { allow: ['Bash(ls)'] },
    });
    const result = addHook(before, FILE, spec);
    const doc = parse(result.text);
    expect(Object.keys(doc)).toEqual(['theme', 'hooks', 'permissions']);
    expect(Object.keys(doc.hooks as object)).toEqual(['PreToolUse', 'PostToolUse']);
    expect((doc.hooks as Record<string, unknown>).PreToolUse).toEqual([
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'user' }] },
    ]);
    expect(doc.permissions).toEqual({ allow: ['Bash(ls)'] });
    expect(result).toMatchObject({ action: 'create', createdEvent: true, createdGroup: true });
  });

  it('appends to the group with the same matcher, after the user handler', () => {
    const user = { type: 'command', command: 'user' };
    const before = json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [user] }] } });
    const result = addHook(before, FILE, spec);
    expect(parse(result.text)).toEqual({
      hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [user, handler] }] },
    });
    expect(result).toMatchObject({ action: 'create', createdEvent: false, createdGroup: false });
  });

  it('appends a new group after a group with another matcher', () => {
    const user = { matcher: 'Bash', hooks: [{ type: 'command', command: 'user' }] };
    const result = addHook(json({ hooks: { PostToolUse: [user] } }), FILE, spec);
    expect(parse(result.text)).toEqual({
      hooks: { PostToolUse: [user, { matcher: 'Edit|Write', hooks: [handler] }] },
    });
    expect(result).toMatchObject({ createdEvent: false, createdGroup: true });
  });

  it('treats an omitted matcher as equal only to an omitted matcher', () => {
    const noMatcher: HookSpec = { event: 'Stop', matcher: null, handler };
    const matched = { matcher: 'Bash', hooks: [{ type: 'command', command: 'a' }] };
    const bare = { hooks: [{ type: 'command', command: 'b' }] };

    const joined = addHook(json({ hooks: { Stop: [matched, bare] } }), FILE, noMatcher);
    expect(parse(joined.text)).toEqual({ hooks: { Stop: [matched, { hooks: [bare.hooks[0], handler] }] } });
    expect(joined.createdGroup).toBe(false);

    const created = addHook(json({ hooks: { Stop: [matched] } }), FILE, noMatcher);
    const groups = (parse(created.text).hooks as { Stop: object[] }).Stop;
    expect(groups[1]).toEqual({ hooks: [handler] });
    expect(Object.keys(groups[1] as object)).toEqual(['hooks']);
    expect(created.createdGroup).toBe(true);
  });

  it('skips a deep-equal handler without rewriting the file, whatever its key order', () => {
    const reordered = { timeout: 30, command: 'prettier --write', type: 'command' };
    const before = json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [reordered] }] } }, '\t', '');
    const result = addHook(before, FILE, spec);
    expect(result).toEqual({ text: before, action: 'skip', createdEvent: false, createdGroup: false });
  });

  it('fills empty arrays and an empty hooks object', () => {
    const emptyEvent = addHook(json({ hooks: { PostToolUse: [] } }), FILE, spec);
    expect(parse(emptyEvent.text)).toEqual({
      hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [handler] }] },
    });
    expect(emptyEvent).toMatchObject({ createdEvent: false, createdGroup: true });

    const emptyHooks = addHook(json({ hooks: {} }), FILE, spec);
    expect(emptyHooks).toMatchObject({ createdEvent: true, createdGroup: true });

    const emptyGroup = addHook(json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [] }] } }), FILE, spec);
    expect(parse(emptyGroup.text)).toEqual({
      hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [handler] }] },
    });
    expect(emptyGroup.createdGroup).toBe(false);
  });

  it.each([
    ['tab', '\t'],
    ['4-space', 4],
  ])('keeps the %s indent', (_label, indent) => {
    const before = json({ theme: 'dark' }, indent);
    expect(addHook(before, FILE, spec).text).toBe(
      json({ theme: 'dark', hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [handler] }] } }, indent),
    );
  });

  it('keeps a missing trailing newline missing, and a present one present', () => {
    const noNewline = addHook(json({ a: 1 }, 2, ''), FILE, spec).text;
    expect(noNewline.endsWith('}')).toBe(true);
    expect(addHook(json({ a: 1 }), FILE, spec).text.endsWith('}\n')).toBe(true);
  });

  it.each([
    ['invalid JSON', '{ nope', 'is not valid JSON'],
    ['JSON with comments', '{ // c\n "a": 1 }', 'is not valid JSON'],
    ['a non-object root', '[]', 'must be a JSON object'],
    ['hooks that is not an object', '{"hooks": []}', "'hooks' must be a JSON object"],
    ['an event that is not an array', '{"hooks": {"PostToolUse": {}}}', "'hooks.PostToolUse' must be an array"],
    ['a group that is not an object', '{"hooks": {"PostToolUse": ["x"]}}', 'hooks.PostToolUse[0]'],
    [
      'a group without a hooks array',
      '{"hooks": {"PostToolUse": [{"matcher": "Edit|Write"}]}}',
      'hooks.PostToolUse[0]',
    ],
    [
      'an array matcher',
      '{"hooks": {"PostToolUse": [{"matcher": ["Edit"], "hooks": []}]}}',
      "matcher' must be a string",
    ],
  ])('fails closed naming the file on %s', (_label, text, reason) => {
    const attempt = () => addHook(text, FILE, spec);
    expect(attempt).toThrow(ConfigError);
    expect(attempt).toThrow(FILE);
    expect(attempt).toThrow(reason);
  });
});

describe('removeHook', () => {
  const created = { createdEvent: true, createdGroup: true };
  const user = { type: 'command', command: 'user' };

  it('drops the group and the event when shitaku created them and they are empty', () => {
    const added = addHook(json({ theme: 'dark' }), FILE, spec);
    const result = removeHook(added.text, FILE, spec, added);
    expect(result.removed).toBe(true);
    expect(parse(result.text)).toEqual({ theme: 'dark', hooks: {} });
  });

  it('keeps the group when it still holds a user handler', () => {
    const before = json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [user, handler] }] } });
    const result = removeHook(before, FILE, spec, { createdEvent: false, createdGroup: false });
    expect(parse(result.text)).toEqual({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [user] }] } });
    expect(result.removed).toBe(true);
  });

  it('keeps an empty group or event it did not create', () => {
    const before = json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [handler] }] } });
    const result = removeHook(before, FILE, spec, { createdEvent: false, createdGroup: false });
    expect(parse(result.text)).toEqual({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [] }] } });
  });

  it('drops only the created group and keeps the event holding other groups', () => {
    const other = { matcher: 'Bash', hooks: [user] };
    const before = json({ hooks: { PostToolUse: [other, { matcher: 'Edit|Write', hooks: [handler] }] } });
    const result = removeHook(before, FILE, spec, { createdEvent: false, createdGroup: true });
    expect(parse(result.text)).toEqual({ hooks: { PostToolUse: [other] } });
  });

  it('is a no-op that reports not removed when the handler is absent', () => {
    const before = json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [user] }] } });
    expect(removeHook(before, FILE, spec, created)).toEqual({ text: before, removed: false });
    expect(removeHook(json({ a: 1 }), FILE, spec, created).removed).toBe(false);
  });

  it('does not match a handler under another matcher', () => {
    const before = json({ hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [handler] }] } });
    expect(removeHook(before, FILE, spec, created)).toEqual({ text: before, removed: false });
  });

  it('keeps unknown keys, order, and indent', () => {
    const before = json({ z: 1, hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [user, handler] }] }, a: 2 }, 4);
    const result = removeHook(before, FILE, spec, { createdEvent: false, createdGroup: false });
    expect(result.text).toBe(
      json({ z: 1, hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [user] }] }, a: 2 }, 4),
    );
  });

  it('fails closed naming the file on malformed settings', () => {
    expect(() => removeHook('{ nope', FILE, spec, created)).toThrow(`${FILE}: config is not valid JSON`);
    expect(() => removeHook('{"hooks": {"PostToolUse": {}}}', FILE, spec, created)).toThrow(FILE);
  });
});

describe('updateHook', () => {
  const next = { type: 'command', command: 'prettier --write --cache', timeout: 60 };

  it('replaces the handler in place between user handlers', () => {
    const a = { type: 'command', command: 'a' };
    const b = { type: 'command', command: 'b' };
    const before = json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [a, handler, b] }] } });
    const result = updateHook(before, FILE, spec, next);
    expect(parse(result.text)).toEqual({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [a, next, b] }] } });
    expect(result.updated).toBe(true);
  });

  it('reports not updated and leaves the bytes when the previous handler is absent', () => {
    const before = json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [next] }] } }, '\t');
    expect(updateHook(before, FILE, spec, next)).toEqual({ text: before, updated: false });
    expect(updateHook(null, FILE, spec, next)).toEqual({ text: '', updated: false });
  });

  it('keeps indent and a missing trailing newline', () => {
    const before = json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [handler] }] } }, 4, '');
    const result = updateHook(before, FILE, spec, next);
    expect(result.text).toBe(json({ hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [next] }] } }, 4, ''));
  });

  it('fails closed naming the file on malformed settings', () => {
    expect(() => updateHook('[]', FILE, spec, next)).toThrow(`${FILE}: config root must be a JSON object`);
  });
});

describe('hasHook', () => {
  const present = json({
    hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'user' }, handler] }] },
  });

  it('finds the handler by exact content in its event and matcher group', () => {
    expect(hasHook(present, FILE, spec)).toBe(true);
    expect(hasHook(present, FILE, { ...spec, handler: { ...handler, timeout: 31 } })).toBe(false);
  });

  it('does not find it under another matcher or event, nor in a file without hooks', () => {
    expect(hasHook(present, FILE, { ...spec, matcher: 'Bash' })).toBe(false);
    expect(hasHook(present, FILE, { ...spec, matcher: null })).toBe(false);
    expect(hasHook(present, FILE, { ...spec, event: 'Stop' })).toBe(false);
    expect(hasHook('{}', FILE, spec)).toBe(false);
  });

  it('fails closed naming the file on malformed settings', () => {
    expect(() => hasHook('{ nope', FILE, spec)).toThrow(ConfigError);
    expect(() => hasHook('[]', FILE, spec)).toThrow(`${FILE}: config root must be a JSON object`);
  });
});

describe('file fidelity of an edit', () => {
  const BOM = String.fromCodePoint(0xfeff);
  const crlf = (text: string): string => text.replaceAll('\n', '\r\n');

  it('keeps CRLF line endings on add, update and remove', () => {
    const before = crlf(json({ theme: 'dark' }, 4));
    const added = addHook(before, FILE, spec).text;
    expect(added).toBe(
      crlf(json({ theme: 'dark', hooks: { PostToolUse: [{ matcher: 'Edit|Write', hooks: [handler] }] } }, 4)),
    );
    expect(added.replaceAll('\r\n', '')).not.toContain('\n');
    const next = { ...handler, timeout: 60 };
    const updated = updateHook(added, FILE, spec, next).text;
    expect(updated.replaceAll('\r\n', '')).not.toContain('\n');
    expect(updated).toContain('"timeout": 60');
    const created = { createdEvent: true, createdGroup: true };
    const removed = removeHook(updated, FILE, { ...spec, handler: next }, created).text;
    expect(removed).toBe(crlf(json({ theme: 'dark', hooks: {} }, 4)));
  });

  it('keeps CRLF without a trailing newline, and does not add CR to an LF file', () => {
    const noTrailing = addHook(crlf(json({ a: 1 }, 2, '')), FILE, spec).text;
    expect(noTrailing.endsWith('}')).toBe(true);
    expect(noTrailing).toContain('\r\n');
    expect(noTrailing.replaceAll('\r\n', '')).not.toContain('\n');
    expect(addHook(json({ a: 1 }), FILE, spec).text).not.toContain('\r');
  });

  it('writes LF when the file mixes LF and CRLF, since only a consistently CRLF file keeps CRLF', () => {
    const mixed = '{\r\n  "a": 1,\n  "b": 2\r\n}\r\n';
    const out = addHook(mixed, FILE, spec).text;
    expect(out).not.toContain('\r');
    expect(out.endsWith('}\n')).toBe(true);
  });

  it('refuses a byte order mark with a ConfigError naming the file', () => {
    const attempt = () => addHook(`${BOM}${json({ a: 1 })}`, FILE, spec);
    expect(attempt).toThrow(ConfigError);
    expect(attempt).toThrow(FILE);
    expect(attempt).toThrow('byte order mark');
  });

  it.each([
    ['empty', ''],
    ['whitespace-only', ' \n\t\r\n'],
  ])('refuses an %s file with a message that says so', (_label, text) => {
    const attempt = () => addHook(text, FILE, spec);
    expect(attempt).toThrow(ConfigError);
    expect(attempt).toThrow(`${FILE}: config file is empty`);
  });

  it('keeps the last value of a duplicate key, as JSON.parse does', () => {
    const before = '{\n  "model": "sonnet",\n  "model": "opus"\n}\n';
    expect(parse(addHook(before, FILE, spec).text).model).toBe('opus');
  });

  it('wraps a document nested too deeply to serialize into a ConfigError naming the file', () => {
    const depth = 200_000;
    const before = `{"deep": ${'['.repeat(depth)}${']'.repeat(depth)}}`;
    const attempt = () => addHook(before, FILE, spec);
    expect(attempt).toThrow(ConfigError);
    expect(attempt).toThrow(FILE);
  });
});
