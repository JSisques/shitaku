import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO = join(import.meta.dirname, '..', '..', '..');
const CATALOG_SCRIPT = join(REPO, 'catalog', 'scripts', 'complexity');
const FIXTURES = join(REPO, 'test', 'fixtures', 'complexity');
const UNDER = join(FIXTURES, 'under');
const OVER = join(FIXTURES, 'over');
const GITIGNORE_TARGET = join(FIXTURES, 'gitignore-target');

type RunResult = { code: number | null; stdout: string; stderr: string };
type ComplexityReport = {
  schema: string;
  tool: string;
  functions: { file: string; name: string; line: number; cyclomatic: number; cognitive: number }[];
};

async function runComplexity(
  scriptRoot: string,
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv } = { cwd: REPO },
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(scriptRoot, 'index.mjs'), ...args], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function copyScriptRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'shitaku-complexity-'));
  await cp(CATALOG_SCRIPT, root, {
    recursive: true,
    filter: (src) =>
      !src.includes(`${join('complexity', 'node_modules')}`) &&
      !src.endsWith(`${join('', 'node_modules')}`) &&
      !/[/\\]node_modules[/\\]?$/.test(src),
  });
  await rm(join(root, 'node_modules'), { recursive: true, force: true });
  return root;
}

function parseReport(stdout: string): ComplexityReport {
  return JSON.parse(stdout) as ComplexityReport;
}

describe('catalog complexity script', () => {
  let scriptRoot: string;

  beforeAll(async () => {
    scriptRoot = await copyScriptRoot();
  }, 180_000);

  afterAll(async () => {
    if (scriptRoot) await rm(scriptRoot, { recursive: true, force: true });
  });

  describe('thresholds (exit 0/1)', () => {
    it('exits 0 for JS/TS fixtures under default thresholds', async () => {
      const result = await runComplexity(scriptRoot, [UNDER], { cwd: UNDER });
      expect(result.stderr, result.stderr).not.toMatch(/not implemented/i);
      expect(result.code).toBe(0);
      const report = parseReport(result.stdout);
      const files = report.functions.map((f) => f.file.replace(/\\/g, '/'));
      expect(files.some((f) => f.endsWith('simple.js'))).toBe(true);
      expect(files.some((f) => f.endsWith('simple.ts'))).toBe(true);
    }, 180_000);

    it('exits 1 when a function exceeds default thresholds', async () => {
      const result = await runComplexity(scriptRoot, [OVER], { cwd: OVER });
      expect(result.code).toBe(1);
      const report = parseReport(result.stdout);
      expect(report.functions.length).toBeGreaterThan(0);
      const exceeded = report.functions.some((f) => f.cyclomatic > 10 || f.cognitive > 15);
      expect(exceeded).toBe(true);
    }, 180_000);
  });

  describe('JSON envelope and formats (D4A)', () => {
    it('emits schema/tool/functions sorted worst-first with cognitive zero-fill', async () => {
      const result = await runComplexity(scriptRoot, [OVER], { cwd: OVER });
      expect(result.code).toBe(1);
      const report = parseReport(result.stdout);
      expect(report.schema).toBe('shitaku.catalog.complexity/v1');
      expect(report.tool).toBe('complexity');
      expect(report.functions.length).toBeGreaterThanOrEqual(2);
      for (const row of report.functions) {
        expect(typeof row.file).toBe('string');
        expect(typeof row.name).toBe('string');
        expect(typeof row.line).toBe('number');
        expect(typeof row.cyclomatic).toBe('number');
        expect(typeof row.cognitive).toBe('number');
        expect(row.name.length).toBeGreaterThan(0);
      }
      const scores = report.functions.map((f) => Math.max(f.cyclomatic, f.cognitive));
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]!).toBeLessThanOrEqual(scores[i - 1]!);
      }

      const under = await runComplexity(scriptRoot, [join(UNDER, 'simple.js')], { cwd: UNDER });
      const underReport = parseReport(under.stdout);
      expect(underReport.functions).toHaveLength(1);
      expect(underReport.functions[0]?.name).toBe('underJs');
      expect(underReport.functions[0]?.cyclomatic).toBe(1);
      expect(underReport.functions[0]?.cognitive).toBe(0);
    }, 180_000);

    it('prints a text table with --format text and rejects unsupported formats', async () => {
      const text = await runComplexity(scriptRoot, [UNDER, '--format', 'text'], { cwd: UNDER });
      expect(text.code).toBe(0);
      let textIsJson = true;
      try {
        JSON.parse(text.stdout);
      } catch {
        textIsJson = false;
      }
      expect(textIsJson).toBe(false);
      expect(text.stdout).toMatch(/file\tname\tline\tcyclomatic\tcognitive/);
      expect(text.stdout).toMatch(/underJs/);

      const bad = await runComplexity(scriptRoot, [UNDER, '--format', 'yaml'], { cwd: UNDER });
      expect(bad.code).toBe(2);
      expect(bad.stderr).toMatch(/unsupported --format/i);
    }, 180_000);
  });

  describe('ignore policy (D3A) and shipped config', () => {
    it('respects consumer .gitignore and fixed node_modules/.git ignores', async () => {
      const project = await mkdtemp(join(tmpdir(), 'complexity-ignore-'));
      try {
        await writeFile(join(project, '.gitignore'), 'ignored-by-git.js\n');
        await cp(join(GITIGNORE_TARGET, 'tracked.js'), join(project, 'tracked.js'));
        await cp(join(GITIGNORE_TARGET, 'ignored-by-git.js'), join(project, 'ignored-by-git.js'));

        await mkdir(join(project, 'node_modules', 'pkg'), { recursive: true });
        await writeFile(
          join(project, 'node_modules', 'pkg', 'hot.js'),
          `export function nmHot(x) {\n${'  if (x === 0) return 0;\n'.repeat(12)}  return -1;\n}\n`,
        );
        await mkdir(join(project, '.git'), { recursive: true });
        await writeFile(
          join(project, '.git', 'hot.js'),
          `export function gitHot(x) {\n${'  if (x === 0) return 0;\n'.repeat(12)}  return -1;\n}\n`,
        );

        const result = await runComplexity(scriptRoot, [project], { cwd: project });
        expect(result.code).toBe(0);
        const report = parseReport(result.stdout);
        const files = report.functions.map((f) => f.file.replace(/\\/g, '/'));
        expect(files.some((f) => f.endsWith('tracked.js'))).toBe(true);
        expect(files.some((f) => f.includes('ignored-by-git'))).toBe(false);
        expect(files.some((f) => f.includes('node_modules'))).toBe(false);
        expect(files.some((f) => f.includes('.git/'))).toBe(false);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    }, 180_000);

    it('uses shipped -c config when consumer ESLint config conflicts', async () => {
      const project = await mkdtemp(join(tmpdir(), 'complexity-config-'));
      try {
        await writeFile(
          join(project, 'eslint.config.mjs'),
          'export default [{ rules: { complexity: "off", "sonarjs/cognitive-complexity": "off" } }];\n',
        );
        await cp(join(UNDER, 'simple.js'), join(project, 'simple.js'));
        const result = await runComplexity(scriptRoot, [join(project, 'simple.js')], { cwd: project });
        expect(result.code).toBe(0);
        const report = parseReport(result.stdout);
        expect(report.functions.some((f) => f.name === 'underJs' && f.cyclomatic === 1)).toBe(true);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    }, 180_000);
  });

  describe('tool failure threat boundary', () => {
    it('exits 2 on eslint failure without writing consumer package.json', async () => {
      const project = await mkdtemp(join(tmpdir(), 'complexity-threat-'));
      const brokenRoot = await copyScriptRoot();
      try {
        await writeFile(join(project, 'package.json'), JSON.stringify({ name: 'consumer', private: true }, null, 2));
        await cp(join(UNDER, 'simple.js'), join(project, 'simple.js'));
        const before = await readFile(join(project, 'package.json'), 'utf8');

        // Bootstrap once, then break the local eslint binary so the next run fails closed.
        const bootstrap = await runComplexity(brokenRoot, [join(project, 'simple.js')], { cwd: project });
        expect(bootstrap.code).toBe(0);
        await rm(join(brokenRoot, 'node_modules', '.bin', 'eslint'), { force: true });
        await writeFile(join(brokenRoot, 'node_modules', '.bin', 'eslint'), '#!/bin/sh\nexit 2\n', { mode: 0o755 });

        const failed = await runComplexity(brokenRoot, [join(project, 'simple.js')], { cwd: project });
        expect(failed.code).toBe(2);
        const after = await readFile(join(project, 'package.json'), 'utf8');
        expect(after).toBe(before);
      } finally {
        await rm(project, { recursive: true, force: true });
        await rm(brokenRoot, { recursive: true, force: true });
      }
    }, 180_000);
  });
});
