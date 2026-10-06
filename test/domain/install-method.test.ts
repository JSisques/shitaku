import { describe, expect, it } from 'vitest';
import {
  detectInstallMethod,
  isRunnableUpgrade,
  upgradeArgv,
  upgradeCommand,
  type InstallMethod,
  type InstallMethodSignals,
} from '@/domain/install-method.js';

describe('upgradeCommand', () => {
  it.each([
    ['npx', 'npx @jsisques/shitaku@latest'],
    ['npm-global', 'npm install -g @jsisques/shitaku'],
    ['pnpm-global', 'pnpm add -g @jsisques/shitaku'],
    ['unknown', 'npm install -g @jsisques/shitaku'],
  ] as const)('%s -> %s', (method, command) => {
    expect(upgradeCommand(method)).toBe(command);
  });
});

describe('isRunnableUpgrade', () => {
  it.each([
    ['npm-global', true],
    ['pnpm-global', true],
    ['npx', false],
    ['unknown', false],
  ] as const)('%s -> %s', (method, runnable) => {
    expect(isRunnableUpgrade(method)).toBe(runnable);
  });
});

describe('upgradeArgv', () => {
  it('returns npm global install tokens for npm-global', () => {
    expect(upgradeArgv('npm-global')).toEqual({
      command: 'npm',
      args: ['install', '-g', '@jsisques/shitaku'],
    });
  });

  it('returns pnpm global add tokens for pnpm-global', () => {
    expect(upgradeArgv('pnpm-global')).toEqual({
      command: 'pnpm',
      args: ['add', '-g', '@jsisques/shitaku'],
    });
  });
});

describe('detectInstallMethod', () => {
  const detect = (over: Partial<InstallMethodSignals> = {}): InstallMethod =>
    detectInstallMethod({ binPath: '', ...over });

  it('detects npx from npm_command=exec and npx-cli.js', () => {
    expect(
      detect({
        npmCommand: 'exec',
        npmExecPath: '/usr/lib/node_modules/npm/bin/npx-cli.js',
        npmConfigUserAgent: 'npm/9.2.0 node/v22.13.0 darwin x64',
      }),
    ).toBe('npx');
  });

  it('detects npx from a bin under the _npx cache', () => {
    expect(detect({ binPath: '/Users/me/.npm/_npx/abc123/node_modules/.bin/shitaku' })).toBe('npx');
  });

  it('detects npx from Windows-style _npx paths', () => {
    expect(
      detect({ binPath: 'C:\\Users\\me\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\.bin\\shitaku' }),
    ).toBe('npx');
  });

  it('detects pnpm-global from a pnpm global bin path', () => {
    expect(detect({ binPath: '/Users/me/Library/pnpm/shitaku' })).toBe('pnpm-global');
    expect(detect({ binPath: '/home/me/.local/share/pnpm/global/5/node_modules/.bin/shitaku' })).toBe('pnpm-global');
  });

  it('detects pnpm-global from a pnpm dlx cache path', () => {
    expect(detect({ binPath: '/Users/me/Library/pnpm/dlx/abc123/node_modules/.bin/shitaku' })).toBe('pnpm-global');
  });

  it('detects pnpm-global from the user agent when path signals are absent', () => {
    expect(detect({ npmConfigUserAgent: 'pnpm/9.15.0 npm/? node/v22.13.0 darwin arm64' })).toBe('pnpm-global');
  });

  it('detects npx from npm user agent plus npm_command=exec when npx-cli is absent', () => {
    expect(detect({ npmCommand: 'exec', npmConfigUserAgent: 'npm/10.0.0 node/v22.13.0 linux x64' })).toBe('npx');
  });

  it('defaults to npm-global when no signals match (typical global npm bin)', () => {
    expect(detect({ binPath: '/usr/local/bin/shitaku' })).toBe('npm-global');
    expect(detect()).toBe('npm-global');
  });
});
