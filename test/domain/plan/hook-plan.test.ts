import { describe, expect, it } from 'vitest';
import { hashEntry, sha256 } from '@/domain/hash.js';
import { ConfigError } from '@/domain/json-merge.js';
import type { OwnedHook } from '@/domain/manifest.js';
import { buildHookPlan, hookEntryHash, writesHookFile, type HookPlanEntry } from '@/domain/plan/hook-plan.js';

const path = '/w/.claude/settings.json';
const handler = { type: 'command', command: 'pnpm run fmt', timeout: 30 };
const fmt: HookPlanEntry = { name: 'fmt', event: 'PostToolUse', matcher: 'Edit|Write', handler };

const doc = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
/** Handlers of the first group of an event, parsed from the planned text. */
const firstGroup = (text: string, event: string): unknown =>
  (JSON.parse(text) as { hooks: Record<string, { hooks: unknown }[]> }).hooks[event]?.[0]?.hooks;

const group = (matcher: string | null, ...hooks: unknown[]) => ({
  ...(matcher === null ? {} : { matcher }),
  hooks,
});

const ownedFmt = (over: Partial<OwnedHook> = {}): OwnedHook => ({
  entryHash: hookEntryHash(fmt),
  event: 'PostToolUse',
  matcher: 'Edit|Write',
  handler,
  createdEvent: true,
  createdGroup: true,
  ...over,
});

const plan = (existing: string | null, hooks: HookPlanEntry[] = [fmt], owned: Record<string, OwnedHook> = {}) =>
  buildHookPlan({ path, scope: 'project', existing, hooks, owned });

describe('hookEntryHash', () => {
  it('hashes event, matcher and handler together', () => {
    expect(hookEntryHash(fmt)).toBe(hashEntry({ event: 'PostToolUse', matcher: 'Edit|Write', handler }));
    expect(hookEntryHash({ ...fmt, matcher: null })).not.toBe(hookEntryHash(fmt));
    expect(hookEntryHash({ ...fmt, event: 'PreToolUse' })).not.toBe(hookEntryHash(fmt));
  });
});

describe('buildHookPlan create', () => {
  it('creates the event and group in an absent file', () => {
    const change = plan(null);
    expect(change).toMatchObject({ path, scope: 'project', before: null, beforeHash: null });
    expect(change.items).toEqual([
      {
        ...fmt,
        action: 'create',
        entryHash: hookEntryHash(fmt),
        createdEvent: true,
        createdGroup: true,
      },
    ]);
    expect(JSON.parse(change.after)).toEqual({ hooks: { PostToolUse: [group('Edit|Write', handler)] } });
    expect(writesHookFile(change)).toBe(true);
  });

  it('appends to an existing equal-matcher group without flagging anything as created', () => {
    const user = { type: 'command', command: 'user.sh' };
    const before = doc({ hooks: { PostToolUse: [group('Edit|Write', user)] } });
    const change = plan(before);
    expect(change.beforeHash).toBe(sha256(before));
    expect(change.items[0]).toMatchObject({ action: 'create', createdEvent: false, createdGroup: false });
    expect(JSON.parse(change.after)).toEqual({ hooks: { PostToolUse: [group('Edit|Write', user, handler)] } });
  });

  it('creates only the group when the event exists with another matcher', () => {
    const before = doc({ hooks: { PostToolUse: [group('Bash', { type: 'command', command: 'b.sh' })] } });
    expect(plan(before).items[0]).toMatchObject({ action: 'create', createdEvent: false, createdGroup: true });
  });

  it('plans every hook of the file in order against the running text', () => {
    const lint: HookPlanEntry = {
      name: 'lint',
      event: 'PostToolUse',
      matcher: 'Edit|Write',
      handler: { type: 'command', command: 'lint' },
    };
    const change = plan(null, [fmt, lint]);
    expect(change.items.map((i) => [i.name, i.action, i.createdEvent, i.createdGroup])).toEqual([
      ['fmt', 'create', true, true],
      ['lint', 'create', false, false],
    ]);
    expect(firstGroup(change.after, 'PostToolUse')).toEqual([handler, lint.handler]);
  });
});

describe('buildHookPlan skip', () => {
  it('skips a deep-equal handler and leaves the text untouched', () => {
    const before = doc({
      hooks: { PostToolUse: [group('Edit|Write', { timeout: 30, command: 'pnpm run fmt', type: 'command' })] },
    });
    const change = plan(before);
    expect(change.items[0]).toMatchObject({ name: 'fmt', action: 'skip', reason: 'already installed' });
    expect(change.after).toBe(before);
    expect(writesHookFile(change)).toBe(false);
  });

  it('skips even when shitaku owns an older version of the hook', () => {
    const before = doc({ hooks: { PostToolUse: [group('Edit|Write', handler)] } });
    const change = plan(before, [fmt], { fmt: ownedFmt({ handler: { type: 'command', command: 'old' } }) });
    expect(change.items[0]?.action).toBe('skip');
  });
});

describe('buildHookPlan update', () => {
  const old = { type: 'command', command: 'pnpm run fmt:old' };
  const user = { type: 'command', command: 'user.sh' };

  it('replaces the handler shitaku owns in place and records the replaced one', () => {
    const before = doc({ hooks: { PostToolUse: [group('Edit|Write', user, old)] } });
    const change = plan(before, [fmt], { fmt: ownedFmt({ handler: old, createdEvent: false, createdGroup: false }) });
    expect(change.items[0]).toMatchObject({
      action: 'update',
      reason: 'installed by shitaku',
      previous: old,
      handler,
      createdEvent: false,
      createdGroup: false,
    });
    expect(JSON.parse(change.after)).toEqual({ hooks: { PostToolUse: [group('Edit|Write', user, handler)] } });
  });

  it('carries the created flags of the original install through the update', () => {
    const before = doc({ hooks: { PostToolUse: [group('Edit|Write', old)] } });
    const change = plan(before, [fmt], { fmt: ownedFmt({ handler: old }) });
    expect(change.items[0]).toMatchObject({ action: 'update', createdEvent: true, createdGroup: true });
  });
});

describe('buildHookPlan never conflicts', () => {
  it('creates when the owned handler was edited or removed, leaving the user text alone', () => {
    const edited = { type: 'command', command: 'pnpm run fmt --user-tweak' };
    const before = doc({ hooks: { PostToolUse: [group('Edit|Write', edited)] } });
    const change = plan(before, [fmt], { fmt: ownedFmt({ handler: { type: 'command', command: 'old' } }) });
    expect(change.items[0]).toMatchObject({ action: 'create', createdEvent: false, createdGroup: false });
    expect(firstGroup(change.after, 'PostToolUse')).toEqual([edited, handler]);
  });

  it('creates a different handler on the same event and matcher that shitaku does not own', () => {
    const other = { type: 'command', command: 'someone-else' };
    const before = doc({ hooks: { PostToolUse: [group('Edit|Write', other)] } });
    expect(plan(before).items[0]?.action).toBe('create');
  });

  it('appends instead of moving when the owned hook now targets another event or matcher', () => {
    const old = { type: 'command', command: 'old' };
    const before = doc({ hooks: { PreToolUse: [group('Edit|Write', old)] } });
    const change = plan(before, [fmt], { fmt: ownedFmt({ event: 'PreToolUse', handler: old }) });
    expect(change.items[0]).toMatchObject({ action: 'create', createdEvent: true, createdGroup: true });
    expect(firstGroup(change.after, 'PreToolUse')).toEqual([old]);
  });

  it('only ever plans create, update or skip', () => {
    const before = doc({ hooks: { PostToolUse: [group(null, { type: 'command', command: 'x' })] } });
    const actions = plan(before, [fmt, { ...fmt, name: 'again', matcher: null }]).items.map((i) => i.action);
    expect(actions).toEqual(['create', 'create']);
  });
});

describe('buildHookPlan malformed settings', () => {
  it('throws a ConfigError naming the file and writes nothing', () => {
    expect(() => plan('{ nope')).toThrow(ConfigError);
    expect(() => plan('{ nope')).toThrow(path);
    expect(() => plan(doc({ hooks: { PostToolUse: {} } }))).toThrow(/PostToolUse.*array/);
  });
});
