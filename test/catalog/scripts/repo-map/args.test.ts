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
  it('defaults to both formats, the .shitaku out dir, depth 4 and no ignores', () => {
    expect(mod.parseArgs([])).toEqual({ format: 'both', out: '.shitaku', maxDepth: 4, ignore: [] });
  });

  it('reads --out and --format json', () => {
    expect(mod.parseArgs(['--out', 'maps', '--format', 'json'])).toEqual({
      format: 'json',
      out: 'maps',
      maxDepth: 4,
      ignore: [],
    });
  });

  it.each(['json', 'markdown', 'both'] as const)('accepts --format %s', (format) => {
    expect(mod.parseArgs(['--format', format]).format).toBe(format);
  });

  it('reads --max-depth as a positive integer', () => {
    expect(mod.parseArgs(['--max-depth', '2']).maxDepth).toBe(2);
    expect(mod.parseArgs(['--max-depth', '12']).maxDepth).toBe(12);
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
    [['--max-depth'], 'repo-map: --max-depth requires a value'],
    [['--bogus'], 'repo-map: unsupported option --bogus'],
    [['positional'], 'repo-map: unexpected argument positional'],
    [['--format', 'xml'], 'repo-map: unsupported --format xml'],
    [['--max-depth', '0'], 'repo-map: --max-depth must be a positive integer, got 0'],
    [['--max-depth', 'abc'], 'repo-map: --max-depth must be a positive integer, got abc'],
    [['--max-depth', '-1'], 'repo-map: --max-depth must be a positive integer, got -1'],
    [['--max-depth', '1.5'], 'repo-map: --max-depth must be a positive integer, got 1.5'],
    [['--max-depth', '1e2'], 'repo-map: --max-depth must be a positive integer, got 1e2'],
  ])('rejects %j with exit code 2', (argv, message) => {
    expect(usageError(argv)).toEqual({ message, exitCode: 2 });
  });
});
