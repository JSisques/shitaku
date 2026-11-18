import { beforeAll, describe, expect, it } from 'vitest';
import { loadRepoMapModule, type ArgsModule } from '@test/helpers/repo-map.js';

let mod: ArgsModule;

beforeAll(async () => {
  mod = await loadRepoMapModule<ArgsModule>('args.mjs');
});

function usageError(argv: string[]): { message: string; exitCode: unknown } {
  try {
    mod.parseArgs(argv);
  } catch (err) {
    const error = err as Error & { exitCode?: unknown };
    return { message: error.message, exitCode: error.exitCode };
  }
  throw new Error(`parseArgs(${JSON.stringify(argv)}) did not throw`);
}

describe('repo-map args', () => {
  it('defaults to json format, the .shitaku out dir and no ignores', () => {
    expect(mod.parseArgs([])).toEqual({ format: 'json', out: '.shitaku', ignore: [] });
  });

  it('reads --out and --format json', () => {
    expect(mod.parseArgs(['--out', 'maps', '--format', 'json'])).toEqual({
      format: 'json',
      out: 'maps',
      ignore: [],
    });
  });

  it('collects repeated --ignore values in order', () => {
    expect(mod.parseArgs(['--ignore', '**/generated/**', '--ignore', '*.snap']).ignore).toEqual([
      '**/generated/**',
      '*.snap',
    ]);
  });

  it.each([
    [['--out'], 'repo-map: --out requires a value'],
    [['--ignore'], 'repo-map: --ignore requires a value'],
    [['--format'], 'repo-map: --format requires a value'],
    [['--bogus'], 'repo-map: unsupported option --bogus'],
    [['positional'], 'repo-map: unexpected argument positional'],
    [['--format', 'xml'], 'repo-map: unsupported --format xml'],
    [['--format', 'markdown'], 'repo-map: unsupported --format markdown'],
    [['--format', 'both'], 'repo-map: unsupported --format both'],
  ])('rejects %j with exit code 2', (argv, message) => {
    expect(usageError(argv)).toEqual({ message, exitCode: 2 });
  });
});
