import { describe, expect, it } from 'vitest';
import { claudeCodeTarget as target } from '@/adapters/claude-code/target.js';
import { McpItemSchema } from '@/domain/catalog/schema.js';
import { ConfigError } from '@/domain/json-merge.js';
import { buildPlan } from '@/domain/plan/change-plan.js';
import { parseDoc } from '@test/helpers/parse-doc.js';

const github = McpItemSchema.parse({
  name: 'github',
  description: 'd',
  server: { type: 'http', url: 'https://x.test/mcp', headers: { Authorization: 'Bearer ${GITHUB_TOKEN}' } },
  env: [{ name: 'GITHUB_TOKEN' }],
});
const paths = { homeDir: '/h', cwd: '/w' };
const plan = (existing: string | null, env: Record<string, string | undefined> = {}, force = false) =>
  buildPlan({ items: [github], target, scope: 'project', paths, existing, env, force });

describe('buildPlan', () => {
  it('plans no hook files for an MCP-only request', () => {
    expect(plan(null).hooks).toEqual([]);
  });

  it('creates the entry when the file is missing', () => {
    const { files } = plan(null);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: '/w/.mcp.json', scope: 'project', beforeHash: null, before: null });
    expect(files[0]?.items[0]).toMatchObject({ name: 'github', action: 'create' });
    expect(parseDoc(files[0]?.after ?? '').mcpServers.github?.headers?.Authorization).toBe('Bearer ${GITHUB_TOKEN}');
  });

  it('skips an identical entry regardless of key order and leaves the file untouched', () => {
    const entry = target.toEntry(github);
    const reordered = { headers: entry['headers'], url: entry['url'], type: entry['type'] };
    const before = JSON.stringify({ mcpServers: { github: reordered } });
    const file = plan(before).files[0];
    expect(file?.items[0]?.action).toBe('skip');
    expect(file?.after).toBe(before);
  });

  it('flags a same-name entry with other content as a conflict and does not change it', () => {
    const before = JSON.stringify({ mcpServers: { github: { type: 'stdio', command: 'x' } } });
    const file = plan(before).files[0];
    expect(file?.items[0]).toMatchObject({ action: 'conflict' });
    expect(file?.after).toBe(before);
  });

  it('replaces a differing entry only with force', () => {
    const before = JSON.stringify({ mcpServers: { github: { type: 'stdio', command: 'x' } } });
    const file = plan(before, {}, true).files[0];
    expect(file?.items[0]).toMatchObject({ action: 'update' });
    expect(parseDoc(file?.after ?? '').mcpServers.github?.type).toBe('http');
  });

  it('reports env var status without exposing values', () => {
    expect(plan(null).requiredEnv).toEqual([{ name: 'GITHUB_TOKEN', set: false }]);
    const set = plan(null, { GITHUB_TOKEN: 'abc123' });
    expect(set.requiredEnv).toEqual([{ name: 'GITHUB_TOKEN', set: true }]);
    expect(JSON.stringify(set)).not.toContain('abc123');
  });

  it('marks items the target does not support as skipped', () => {
    const other = { ...github, targets: ['cursor'] };
    const { files } = buildPlan({ items: [other], target, scope: 'project', paths, existing: null, env: {} });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matchers are typed any
    expect(files[0]?.items[0]).toMatchObject({ action: 'skip', reason: expect.stringContaining('claude-code') });
  });

  it('aborts on a corrupt config', () => {
    expect(() => plan('{ nope')).toThrow(ConfigError);
  });

  it('includes an empty scripts list alongside skills', () => {
    expect(plan(null).scripts).toEqual([]);
    expect(plan(null).skills).toEqual([]);
  });
});
