import { describe, expect, it } from 'vitest';
import { ScriptMetaSchema, parseScript, type ScriptFile, type ScriptParseResult } from '@/domain/catalog/script.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const meta = (body: object): ScriptFile => ({ path: 'script.json', bytes: enc(JSON.stringify(body)) });
const entry = (path = 'index.mjs', source = 'export default {};\n'): ScriptFile => ({
  path,
  bytes: enc(source),
});
const issueOf = (r: ScriptParseResult): string => ('issue' in r ? r.issue : '');

const validMeta = {
  name: 'demo',
  description: 'Runs a demo',
  tools: ['eslint'],
};

describe('ScriptMetaSchema', () => {
  it('accepts a valid script.json and defaults tools to empty', () => {
    expect(ScriptMetaSchema.parse({ name: 'demo', description: 'Runs a demo' })).toEqual({
      name: 'demo',
      description: 'Runs a demo',
      tools: [],
    });
  });

  it('accepts optional args, output and exitCodes', () => {
    const parsed = ScriptMetaSchema.parse({
      ...validMeta,
      args: ['--fix'],
      output: 'text',
      exitCodes: { '0': 'ok', '1': 'fail' },
    });
    expect(parsed.args).toEqual(['--fix']);
    expect(parsed.output).toBe('text');
    expect(parsed.exitCodes).toEqual({ '0': 'ok', '1': 'fail' });
  });

  it('rejects a missing description', () => {
    const res = ScriptMetaSchema.safeParse({ name: 'demo' });
    expect(res.success).toBe(false);
    expect(JSON.stringify(res.error?.issues)).toContain('description');
  });

  it('rejects an invalid name', () => {
    const res = ScriptMetaSchema.safeParse({ name: '../evil', description: 'x' });
    expect(res.success).toBe(false);
    expect(res.error?.message).toContain('../evil');
  });
});

describe('parseScript', () => {
  it('parses a valid script and keeps every file', () => {
    const extra: ScriptFile = { path: 'lib/helper.mjs', bytes: enc('export const x = 1;\n') };
    const result = parseScript('demo', [meta(validMeta), entry(), extra]);
    expect(result).toEqual({
      script: {
        name: 'demo',
        description: 'Runs a demo',
        tools: ['eslint'],
        files: [meta(validMeta), entry(), extra],
      },
    });
  });

  it('reports a missing script.json', () => {
    expect(issueOf(parseScript('demo', [entry()]))).toContain('script.json');
  });

  it('reports a missing index.mjs', () => {
    expect(issueOf(parseScript('demo', [meta(validMeta)]))).toContain('index.mjs');
  });

  it('reports invalid JSON in script.json', () => {
    const bad: ScriptFile = { path: 'script.json', bytes: enc('{ nope') };
    expect(issueOf(parseScript('demo', [bad, entry()]))).toMatch(/JSON|Unexpected|parse/i);
  });

  it('reports a name that does not match the directory', () => {
    const result = parseScript('other', [meta(validMeta), entry()]);
    expect(issueOf(result)).toContain("'demo'");
    expect(issueOf(result)).toContain("'other'");
  });

  it('rejects an invalid directory name', () => {
    expect(issueOf(parseScript('../evil', [meta({ ...validMeta, name: '../evil' }), entry()]))).toContain('../evil');
  });

  it('reports schema issues from script.json with the file path', () => {
    const result = parseScript('demo', [meta({ name: 'demo' }), entry()]);
    expect(issueOf(result)).toContain('description');
    expect('file' in result && result.file).toBe('script.json');
  });
});
