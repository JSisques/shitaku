import { describe, expect, it } from 'vitest';
import { projectScriptsRoot, userScriptsRoot } from '@/domain/scripts-paths.js';

describe('projectScriptsRoot', () => {
  it('returns <cwd>/.shitaku/scripts', () => {
    expect(projectScriptsRoot('/repo')).toBe('/repo/.shitaku/scripts');
    expect(projectScriptsRoot('/tmp/work')).toBe('/tmp/work/.shitaku/scripts');
  });

  it('does not use agent skill directories', () => {
    const root = projectScriptsRoot('/repo');
    expect(root).not.toContain('.claude/skills');
    expect(root).toContain('.shitaku/scripts');
  });
});

describe('userScriptsRoot', () => {
  it('returns <stateDir>/scripts', () => {
    expect(userScriptsRoot('/home/u/.claude/.shitaku')).toBe('/home/u/.claude/.shitaku/scripts');
    expect(userScriptsRoot('C:/Users/a/.claude/.shitaku')).toBe('C:/Users/a/.claude/.shitaku/scripts');
  });

  it('does not use agent skill directories', () => {
    const root = userScriptsRoot('/home/u/.claude/.shitaku');
    expect(root).not.toContain('.claude/skills');
    expect(root.endsWith('/.shitaku/scripts') || root.endsWith('.shitaku/scripts')).toBe(true);
  });
});
