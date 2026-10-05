import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  localePrefersUtf8,
  renderBanner,
  shouldShowBanner,
  terminalSupportsColor,
  type BannerDecision,
} from '@/adapters/cli/banner.js';

const WORDMARK = readFileSync(join(import.meta.dirname, '..', '..', 'fixtures', 'banner-wordmark.txt'), 'utf8')
  .replace(/\n$/, '')
  .split('\n');

const SHOW: BannerDecision = {
  tty: true,
  prompts: true,
  json: false,
  version: false,
  noBanner: false,
  env: {},
};

/** Display columns, ignoring ANSI. Code points above Latin-1 count as two (the kanji mark). */
function columns(line: string): number {
  let width = 0;
  for (const char of stripVTControlCharacters(line)) width += (char.codePointAt(0) ?? 0) > 0xff ? 2 : 1;
  return width;
}

describe('shouldShowBanner', () => {
  it('shows the banner for an interactive terminal run', () => {
    expect(shouldShowBanner(SHOW)).toBe(true);
  });

  const withPatch = (patch: Partial<BannerDecision>): BannerDecision => ({
    ...SHOW,
    ...patch,
    env: { ...SHOW.env, ...patch.env },
  });

  it.each([
    ['not a tty', { tty: false }],
    ['CI set', { env: { CI: 'true' } }],
    ['CI=1', { env: { CI: '1' } }],
    ['opt-out 1', { env: { SHITAKU_NO_BANNER: '1' } }],
    ['opt-out true', { env: { SHITAKU_NO_BANNER: 'true' } }],
    ['opt-out yes', { env: { SHITAKU_NO_BANNER: 'yes' } }],
    ['opt-out TRUE', { env: { SHITAKU_NO_BANNER: 'TRUE' } }],
    ['opt-out Yes', { env: { SHITAKU_NO_BANNER: 'Yes' } }],
    ['opt-out padded', { env: { SHITAKU_NO_BANNER: '  yes  ' } }],
    ['--no-banner', { noBanner: true }],
    ['--json', { json: true }],
    ['version', { version: true }],
    ['does not prompt', { prompts: false }],
  ] satisfies [string, Partial<BannerDecision>][])('skips when %s', (_label, patch) => {
    expect(shouldShowBanner(withPatch(patch))).toBe(false);
  });

  it.each([
    ['CI empty', { CI: '' }],
    ['opt-out empty', { SHITAKU_NO_BANNER: '' }],
    ['opt-out 0', { SHITAKU_NO_BANNER: '0' }],
    ['opt-out false', { SHITAKU_NO_BANNER: 'false' }],
    ['opt-out no', { SHITAKU_NO_BANNER: 'no' }],
    ['opt-out other', { SHITAKU_NO_BANNER: 'maybe' }],
  ])('still shows when %s', (_label, env) => {
    expect(shouldShowBanner({ ...SHOW, env })).toBe(true);
  });
});

describe('terminalSupportsColor', () => {
  it.each([
    ['tty', {}, true, true],
    ['not a tty', {}, false, false],
    ['NO_COLOR', { NO_COLOR: '1' }, true, false],
    ['NO_COLOR empty', { NO_COLOR: '' }, true, false],
    ['NODE_DISABLE_COLORS', { NODE_DISABLE_COLORS: '1' }, true, false],
    ['TERM=dumb', { TERM: 'dumb' }, true, false],
    ['FORCE_COLOR=0', { FORCE_COLOR: '0' }, true, false],
    ['FORCE_COLOR=false', { FORCE_COLOR: 'false' }, true, false],
    ['FORCE_COLOR=TRUE is not on', { FORCE_COLOR: 'TRUE' }, true, false],
    ['FORCE_COLOR=1', { FORCE_COLOR: '1' }, false, true],
    ['FORCE_COLOR empty', { FORCE_COLOR: '' }, false, true],
    ['FORCE_COLOR=2', { FORCE_COLOR: '2' }, false, true],
    ['FORCE_COLOR=3', { FORCE_COLOR: '3' }, false, true],
    ['FORCE_COLOR=true', { FORCE_COLOR: 'true' }, false, true],
    ['FORCE_COLOR wins over NO_COLOR', { FORCE_COLOR: '1', NO_COLOR: '1' }, true, true],
    ['FORCE_COLOR wins over dumb', { FORCE_COLOR: '1', TERM: 'dumb' }, true, true],
  ] as const)('%s', (_label, env, tty, expected) => {
    expect(terminalSupportsColor(env, tty)).toBe(expected);
  });
});

describe('localePrefersUtf8', () => {
  it.each([
    ['unset', {}, false],
    ['LANG utf-8', { LANG: 'en_US.UTF-8' }, true],
    ['LANG utf8', { LANG: 'en_US.utf8' }, true],
    ['LANG C', { LANG: 'C' }, false],
    ['LC_ALL beats LANG', { LC_ALL: 'C', LANG: 'en_US.UTF-8' }, false],
    ['LC_CTYPE beats LANG', { LC_CTYPE: 'en_US.UTF-8', LANG: 'C' }, true],
    ['LC_ALL beats LC_CTYPE', { LC_ALL: 'C', LC_CTYPE: 'en_US.UTF-8' }, false],
  ] as const)('%s', (_label, env, expected) => {
    expect(localePrefersUtf8(env)).toBe(expected);
  });
});

describe('renderBanner', () => {
  it('prints the committed shitaku wordmark', () => {
    expect(renderBanner({ color: false, unicode: false })).toEqual(WORDMARK);
  });

  it('adds the version and tagline, and omits them when the version is missing', () => {
    const lines = renderBanner({ version: '0.2.0', color: false, unicode: false });
    expect(lines.at(-1)).toBe('v0.2.0 · Get your agent environment ready');
    expect(lines.at(-2)).toBe('');
    expect(renderBanner({ color: false, unicode: false }).join('\n')).not.toContain('Get your agent environment ready');
  });

  it('colors with ANSI only when asked, and the plain text stays the same', () => {
    const plain = renderBanner({ version: '0.2.0', color: false, unicode: false });
    const colored = renderBanner({ version: '0.2.0', color: true, unicode: false });
    expect(colored.join('\n')).toContain('\u001b[');
    expect(plain.join('\n')).not.toContain('\u001b[');
    expect(colored.map((line) => stripVTControlCharacters(line))).toEqual(plain);
  });

  it('places the kanji mark next to the wordmark only for a UTF-8 locale', () => {
    const marked = renderBanner({ color: false, unicode: true });
    expect(marked.at(-1)).toBe(`${WORDMARK.at(-1)}  支度`);
    expect(marked.slice(0, -1)).toEqual(WORDMARK.slice(0, -1));
    expect(renderBanner({ color: false, unicode: false }).join('\n')).not.toContain('支度');
  });

  it.each([
    ['plain', { color: false, unicode: false }],
    ['version', { version: '0.2.0', color: false, unicode: false }],
    ['color', { version: '0.2.0', color: true, unicode: false }],
    ['kanji', { version: '0.2.0', color: true, unicode: true }],
    ['kanji without version', { color: false, unicode: true }],
  ] as const)('keeps every line within 80 columns (%s)', (_label, input) => {
    const lines = renderBanner(input);
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(lines.length).toBeLessThanOrEqual(8);
    for (const line of lines) expect(columns(line)).toBeLessThanOrEqual(80);
  });
});
