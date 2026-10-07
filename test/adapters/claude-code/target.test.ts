import { describe, expect, it } from 'vitest';
import { claudeCodeTarget as target } from '@/adapters/claude-code/target.js';
import { McpItemSchema } from '@/domain/catalog/schema.js';

const http = McpItemSchema.parse({
  name: 'github',
  description: 'd',
  server: { type: 'http', url: 'https://x.test/mcp', headers: { Authorization: 'Bearer ${GITHUB_TOKEN}' } },
  env: [{ name: 'GITHUB_TOKEN' }],
});
const stdio = McpItemSchema.parse({
  name: 'ctx',
  description: 'd',
  server: { type: 'stdio', command: 'npx', args: ['-y', 'pkg'], env: { K: '${K}' } },
  env: [{ name: 'K' }],
  targets: ['claude-code'],
});

describe('claude-code target', () => {
  const paths = { homeDir: '/h', cwd: '/w' };

  it('writes project scope to ./.mcp.json under mcpServers', () => {
    expect(target.configPath('project', paths)).toBe('/w/.mcp.json');
    expect(target.serversKeyPath('project')).toEqual(['mcpServers']);
  });

  it('writes user scope to ~/.claude.json under mcpServers', () => {
    expect(target.configPath('user', paths)).toBe('/h/.claude.json');
    expect(target.serversKeyPath('user')).toEqual(['mcpServers']);
  });

  it('filters items by targets', () => {
    expect(target.supports(http)).toBe(true);
    expect(target.supports(stdio)).toBe(true);
    expect(target.supports({ ...http, targets: ['cursor'] })).toBe(false);
  });

  it('maps servers to entries, keeping placeholders verbatim', () => {
    expect(target.toEntry(http)).toEqual({
      type: 'http',
      url: 'https://x.test/mcp',
      headers: { Authorization: 'Bearer ${GITHUB_TOKEN}' },
    });
    expect(target.toEntry(stdio)).toEqual({ type: 'stdio', command: 'npx', args: ['-y', 'pkg'], env: { K: '${K}' } });
  });

  it('puts skills under ~/.claude/skills for user scope', () => {
    expect(target.skillsDir('user', paths)).toBe('/h/.claude/skills');
  });

  it('puts skills under ./.claude/skills for project scope', () => {
    expect(target.skillsDir('project', paths)).toBe('/w/.claude/skills');
  });

  it('puts commands under ~/.claude/commands for user scope', () => {
    expect(target.commandsDir('user', paths)).toBe('/h/.claude/commands');
  });

  it('puts commands under ./.claude/commands for project scope', () => {
    expect(target.commandsDir('project', paths)).toBe('/w/.claude/commands');
  });
});
