import { describe, expect, it } from 'vitest';
import { CatalogIndexSchema, McpItemSchema, ProfileSchema } from '@/domain/catalog/schema.js';
import { extractPlaceholders, hasPlaceholder } from '@/domain/placeholders.js';

const github = {
  name: 'github',
  description: 'GitHub MCP',
  server: { type: 'http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer ${GITHUB_TOKEN}' } },
  env: [{ name: 'GITHUB_TOKEN' }],
};

describe('placeholders', () => {
  it('extracts names and defaults', () => {
    expect(extractPlaceholders('a ${A} b ${B:-x}')).toEqual([
      { name: 'A', hasDefault: false },
      { name: 'B', hasDefault: true },
    ]);
  });

  it('detects placeholders', () => {
    expect(hasPlaceholder('${TOKEN}')).toBe(true);
    expect(hasPlaceholder('ghp_abc123')).toBe(false);
  });
});

describe('McpItemSchema', () => {
  it('accepts a valid item and applies defaults', () => {
    const item = McpItemSchema.parse(github);
    expect(item.env[0]).toMatchObject({ name: 'GITHUB_TOKEN', required: true });
  });

  it('accepts a stdio item with templated env', () => {
    const item = McpItemSchema.parse({
      name: 'ctx',
      description: 'd',
      server: { type: 'stdio', command: 'npx', env: { KEY: '${CTX_KEY}' } },
      env: [{ name: 'CTX_KEY', required: false }],
    });
    expect(item.server.type === 'stdio' && item.server.args).toEqual([]);
  });

  it('rejects an item without server', () => {
    const bad = { ...github, server: undefined };
    const res = McpItemSchema.safeParse(bad);
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toContain('server');
  });

  it('rejects a literal secret in headers', () => {
    const res = McpItemSchema.safeParse({
      ...github,
      server: { ...github.server, headers: { Authorization: 'Bearer ghp_literal' } },
    });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toContain('${VAR}');
  });

  it('rejects an undeclared placeholder', () => {
    const res = McpItemSchema.safeParse({ ...github, env: [] });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toContain('GITHUB_TOKEN');
  });

  it('rejects defaults in headers', () => {
    const res = McpItemSchema.safeParse({
      ...github,
      server: { ...github.server, headers: { Authorization: 'Bearer ${GITHUB_TOKEN:-x}' } },
    });
    expect(res.success).toBe(false);
  });
});

describe('ProfileSchema', () => {
  it('defaults skills to an empty list and accepts listed ones', () => {
    expect(ProfileSchema.parse({ name: 'p' }).skills).toEqual([]);
    expect(ProfileSchema.parse({ name: 'p', skills: ['demo'] }).skills).toEqual(['demo']);
  });

  it('defaults scripts to an empty list and accepts listed ones', () => {
    expect(ProfileSchema.parse({ name: 'p' }).scripts).toEqual([]);
    expect(ProfileSchema.parse({ name: 'p', scripts: ['lint'] }).scripts).toEqual(['lint']);
  });
});

describe('CatalogIndexSchema', () => {
  it('parses items.mcps and items.profiles', () => {
    const idx = CatalogIndexSchema.parse({ version: 1, items: { mcps: ['github'] } });
    expect(idx.items.profiles).toEqual([]);
  });

  it('defaults items.skills to an empty list when absent', () => {
    expect(CatalogIndexSchema.parse({ version: 1, items: { mcps: [] } }).items.skills).toEqual([]);
  });

  it('defaults items.scripts to an empty list when absent', () => {
    expect(CatalogIndexSchema.parse({ version: 1, items: { mcps: [] } }).items.scripts).toEqual([]);
  });

  it('parses listed skills', () => {
    const idx = CatalogIndexSchema.parse({ version: 1, items: { mcps: [], skills: ['review-code', 'a1'] } });
    expect(idx.items.skills).toEqual(['review-code', 'a1']);
  });

  it('parses listed scripts', () => {
    const idx = CatalogIndexSchema.parse({ version: 1, items: { mcps: [], scripts: ['lint', 'demo'] } });
    expect(idx.items.scripts).toEqual(['lint', 'demo']);
  });

  it('rejects a skill name that could traverse paths, naming the value', () => {
    const res = CatalogIndexSchema.safeParse({ version: 1, items: { mcps: [], skills: ['../evil'] } });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toContain('skills');
    expect(res.error?.message).toContain('../evil');
    expect(CatalogIndexSchema.safeParse({ version: 1, items: { mcps: [], skills: ['A/b'] } }).success).toBe(false);
  });

  it('rejects a script name that could traverse paths, naming the value', () => {
    const res = CatalogIndexSchema.safeParse({ version: 1, items: { mcps: [], scripts: ['../evil'] } });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toContain('scripts');
    expect(res.error?.message).toContain('../evil');
  });

  it('rejects an unsupported version', () => {
    expect(CatalogIndexSchema.safeParse({ version: 2, items: { mcps: [] } }).success).toBe(false);
  });
});
