import { describe, expect, it } from 'vitest';
import { isNewer, isStale, isTruthyFlag, parseUpdateCache, updateNotice, UPDATE_TTL_MS } from '@/domain/update.js';
import type { InstallMethod } from '@/domain/install-method.js';

describe('isNewer', () => {
  it.each([
    ['0.2.0', '0.3.0', true],
    ['0.9.0', '0.10.0', true],
    ['1.0.0-rc.1', '1.0.0', true],
    ['1.0.0', '1.0.1', true],
    ['0.2.0', '0.3.0+build.5', true],
    ['0.2.0', '0.2.0', false],
    ['0.3.0', '0.2.0', false],
    ['1.0.0', '1.0.0-rc.1', false],
    ['1.0.0-rc.1', '1.0.0-rc.2', false],
    ['0.2.0', 'banana', false],
    ['0.2.0', '1.0', false],
    ['0.2.0', '1.0.0\u001b[31m', false],
    ['0.2.0', null, false],
    ['nope', '1.0.0', false],
  ])('current %s vs candidate %s -> %s', (current, candidate, expected) => {
    expect(isNewer(current, candidate)).toBe(expected);
  });
});

describe('isStale', () => {
  const now = new Date('2026-01-10T12:00:00.000Z');
  const at = (ageMs: number): { checkedAt: string; latest: string | null } => ({
    checkedAt: new Date(now.getTime() - ageMs).toISOString(),
    latest: null,
  });

  it.each([
    ['null cache', null, true],
    ['1 hour old', at(3_600_000), false],
    ['just under the TTL', at(UPDATE_TTL_MS - 1), false],
    ['exactly the TTL', at(UPDATE_TTL_MS), true],
    ['25 hours old', at(25 * 3_600_000), true],
    ['in the future', at(-1000), true],
    ['unparsable date', { checkedAt: 'yesterday', latest: null }, true],
  ])('%s -> %s', (_name, cache, expected) => {
    expect(isStale(cache, now)).toBe(expected);
  });
});

describe('isTruthyFlag', () => {
  it.each([
    ['1', true],
    ['true', true],
    ['TRUE', true],
    [' Yes ', true],
    ['on', false],
    ['', false],
    ['0', false],
    ['false', false],
    ['No', false],
    ['maybe', false],
    [undefined, false],
  ])('%j -> %s', (value, expected) => {
    expect(isTruthyFlag(value)).toBe(expected);
  });
});

describe('parseUpdateCache', () => {
  const stamp = '2026-01-01T00:00:00.000Z';

  it.each([
    ['valid', JSON.stringify({ checkedAt: stamp, latest: '1.2.3' }), { checkedAt: stamp, latest: '1.2.3' }],
    ['null latest', JSON.stringify({ checkedAt: stamp, latest: null }), { checkedAt: stamp, latest: null }],
    ['invalid JSON', '{nope', null],
    ['wrong shape', '{"checkedAt":1}', null],
    ['missing latest', JSON.stringify({ checkedAt: stamp }), null],
    ['empty', '', null],
  ])('%s', (_name, text, expected) => {
    expect(parseUpdateCache(text)).toEqual(expected);
  });
});

describe('updateNotice', () => {
  it.each([
    ['npx', 'npx @jsisques/shitaku@latest'],
    ['npm-global', 'npm install -g @jsisques/shitaku'],
    ['pnpm-global', 'pnpm add -g @jsisques/shitaku'],
    ['unknown', 'npm install -g @jsisques/shitaku'],
  ] as const satisfies ReadonlyArray<readonly [InstallMethod, string]>)(
    'names both versions and the %s upgrade command on one line',
    (method, command) => {
      const notice = updateNotice('0.2.0', '0.3.0', method);
      expect(notice).toBe(`Update available: shitaku 0.2.0 -> 0.3.0. Run: ${command}`);
      expect(notice).not.toContain('\n');
    },
  );

  it('falls back to the npm-global command when the method is omitted', () => {
    expect(updateNotice('0.2.0', '0.3.0')).toBe(
      'Update available: shitaku 0.2.0 -> 0.3.0. Run: npm install -g @jsisques/shitaku',
    );
  });
});
