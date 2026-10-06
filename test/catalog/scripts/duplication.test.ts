import { spawn } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO = join(import.meta.dirname, '..', '..', '..');
const CATALOG_SCRIPT = join(REPO, 'catalog', 'scripts', 'duplication');
const FIXTURES = join(REPO, 'test', 'fixtures', 'duplication');

type Clone = {
  firstFile: string;
  firstStart: number;
  firstEnd: number;
  secondFile: string;
  secondStart: number;
  secondEnd: number;
  lines: number;
  tokens: number;
};

type DuplicationReport = {
  schema: string;
  tool: string;
  percentage: number;
  threshold: number;
  clones: Clone[];
};

type RunResult = { code: number | null; stdout: string; stderr: string };

type JscpdReportPayload = {
  statistics: { total: { percentage: number; duplicatedLines?: number; lines?: number } };
  duplicates: Array<{
    lines: number;
    tokens: number;
    firstFile: { name: string; start: number; end: number };
    secondFile: { name: string; start: number; end: number };
  }>;
};

async function runDuplication(
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
  const root = await mkdtemp(join(tmpdir(), 'shitaku-duplication-'));
  await cp(CATALOG_SCRIPT, root, { recursive: true });
  return root;
}

async function copyFixture(name: string): Promise<string> {
  const project = await mkdtemp(join(tmpdir(), `duplication-${name}-`));
  await cp(join(FIXTURES, name), project, { recursive: true });
  return project;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function cleanPayload(): JscpdReportPayload {
  return {
    statistics: { total: { percentage: 0, duplicatedLines: 0, lines: 20 } },
    duplicates: [],
  };
}

function clonePayload(): JscpdReportPayload {
  return {
    statistics: { total: { percentage: 42.5, duplicatedLines: 12, lines: 28 } },
    duplicates: [
      {
        lines: 12,
        tokens: 48,
        firstFile: { name: 'a.js', start: 1, end: 12 },
        secondFile: { name: 'b.js', start: 1, end: 12 },
      },
    ],
  };
}

/** Clones only under paths covered by DEFAULT_IGNORE (node_modules, dist). */
function ignoredOnlyClonePayload(): JscpdReportPayload {
  return {
    statistics: { total: { percentage: 55, duplicatedLines: 24, lines: 44 } },
    duplicates: [
      {
        lines: 12,
        tokens: 48,
        firstFile: { name: 'node_modules/dup/a.js', start: 1, end: 12 },
        secondFile: { name: 'node_modules/dup/b.js', start: 1, end: 12 },
      },
      {
        lines: 12,
        tokens: 48,
        firstFile: { name: 'dist/x.js', start: 1, end: 12 },
        secondFile: { name: 'dist/y.js', start: 1, end: 12 },
      },
    ],
  };
}

/** Mock jscpd in cwd `.bin` that writes jscpd-report.json under --output (v5 shape). */
async function installMockJscpd(
  project: string,
  payload: JscpdReportPayload,
  opts: {
    failParse?: boolean;
    missingReport?: boolean;
    exitCode?: number;
    /** When true, drop clones whose both locations match --ignore globs (simulates jscpd). */
    respectIgnore?: boolean;
  } = {},
) {
  const binDir = join(project, 'node_modules', '.bin');
  await mkdir(binDir, { recursive: true });
  const outPath = join(project, '.mock-jscpd-payload.json');
  await writeFile(outPath, opts.failParse ? '{not-json' : JSON.stringify(payload));
  const argvLog = join(project, '.mock-jscpd-argv.json');
  const shim = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.writeFileSync(path.join(process.cwd(), '.mock-jscpd-argv.json'), JSON.stringify(args));
if (args.includes('--format')) {
  console.error('mock-jscpd: --format unexpected (language flag collision)');
  process.exit(99);
}
if (args.includes('--baseline')) {
  console.error('mock-jscpd: --baseline unexpected');
  process.exit(99);
}
const reportersIdx = args.indexOf('--reporters');
if (reportersIdx === -1 || args[reportersIdx + 1] !== 'json') {
  console.error('mock-jscpd: expected --reporters json');
  process.exit(2);
}
const outputIdx = args.indexOf('--output');
if (outputIdx === -1 || !args[outputIdx + 1]) {
  console.error('mock-jscpd: expected --output <dir>');
  process.exit(2);
}
const outDir = args[outputIdx + 1];
fs.mkdirSync(outDir, { recursive: true });
const reportPath = path.join(outDir, 'jscpd-report.json');
const failParse = ${opts.failParse ? 'true' : 'false'};
const missingReport = ${opts.missingReport ? 'true' : 'false'};
const respectIgnore = ${opts.respectIgnore ? 'true' : 'false'};
const exitCode = ${opts.exitCode ?? 0};
function isIgnored(filePath, patterns) {
  const normalized = filePath.split(path.sep).join('/');
  return patterns.some((pattern) => {
    const core = pattern.replace(/^\\*\\*\\//, '').replace(/\\/\\*\\*$/, '');
    if (!core) return false;
    return (
      normalized === core ||
      normalized.startsWith(core + '/') ||
      normalized.includes('/' + core + '/')
    );
  });
}
if (!missingReport) {
  if (failParse) {
    fs.writeFileSync(reportPath, '{not-json');
  } else {
    let report = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.mock-jscpd-payload.json'), 'utf8'));
    if (respectIgnore) {
      const ignoreIdx = args.indexOf('--ignore');
      const ignoreValue = ignoreIdx === -1 ? '' : (args[ignoreIdx + 1] ?? '');
      const patterns = ignoreValue.split(',').map((p) => p.trim()).filter(Boolean);
      const kept = (report.duplicates || []).filter((dup) => {
        const firstIgnored = isIgnored(dup.firstFile.name, patterns);
        const secondIgnored = isIgnored(dup.secondFile.name, patterns);
        return !(firstIgnored && secondIgnored);
      });
      if (kept.length === 0) {
        report = {
          statistics: { total: { percentage: 0, duplicatedLines: 0, lines: report.statistics?.total?.lines ?? 20 } },
          duplicates: [],
        };
      } else {
        report = { ...report, duplicates: kept };
      }
    }
    fs.writeFileSync(reportPath, JSON.stringify(report));
  }
}
process.exit(exitCode);
`;
  await writeFile(join(binDir, 'jscpd'), shim, { mode: 0o755 });
  return { argvLog };
}

/** Fake `npx` on PATH that writes the same mock report (no network). */
async function installFakeNpx(project: string, payload: JscpdReportPayload): Promise<string> {
  const binDir = await mkdtemp(join(tmpdir(), 'fake-npx-'));
  await writeFile(join(project, '.mock-jscpd-payload.json'), JSON.stringify(payload));
  const npx = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] !== 'jscpd') {
  console.error('fake-npx: expected jscpd');
  process.exit(2);
}
const toolArgs = args.slice(1);
fs.writeFileSync(path.join(process.cwd(), '.mock-jscpd-argv.json'), JSON.stringify(toolArgs));
if (toolArgs.includes('--format')) {
  console.error('fake-npx: --format unexpected');
  process.exit(99);
}
const outputIdx = toolArgs.indexOf('--output');
if (outputIdx === -1 || !toolArgs[outputIdx + 1]) {
  console.error('fake-npx: expected --output');
  process.exit(2);
}
const outDir = toolArgs[outputIdx + 1];
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(path.join(process.cwd(), '.mock-jscpd-payload.json'), path.join(outDir, 'jscpd-report.json'));
process.exit(0);
`;
  await writeFile(join(binDir, 'npx'), npx, { mode: 0o755 });
  return binDir;
}

function parseReport(stdout: string): DuplicationReport {
  return JSON.parse(stdout) as DuplicationReport;
}

function assertEnvelopeShape(report: DuplicationReport) {
  expect(report.schema).toBe('shitaku.catalog.duplication/v1');
  expect(report.tool).toBe('duplication');
  expect(typeof report.percentage).toBe('number');
  expect(typeof report.threshold).toBe('number');
  expect(Array.isArray(report.clones)).toBe(true);
}

describe('catalog duplication script', () => {
  let scriptRoot: string;

  beforeAll(async () => {
    scriptRoot = await copyScriptRoot();
  });

  afterAll(async () => {
    if (scriptRoot) await rm(scriptRoot, { recursive: true, force: true });
  });

  describe('process contract: baseline, format isolation, temp lifecycle', () => {
    it('rejects --baseline with exit 2 and does not mutate project files', async () => {
      const project = await copyFixture('clean');
      try {
        await installMockJscpd(project, cleanPayload());
        const beforePkg = await readFile(join(project, 'package.json'), 'utf8');
        const beforeA = await readFile(join(project, 'unique-a.js'), 'utf8');
        const result = await runDuplication(scriptRoot, ['--baseline'], { cwd: project });
        expect(result.code).toBe(2);
        expect(result.stderr).toMatch(/baseline/i);
        expect(await readFile(join(project, 'package.json'), 'utf8')).toBe(beforePkg);
        expect(await readFile(join(project, 'unique-a.js'), 'utf8')).toBe(beforeA);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('never forwards shitaku --format to jscpd argv for text or json', async () => {
      const project = await copyFixture('clone');
      try {
        const { argvLog } = await installMockJscpd(project, clonePayload());
        for (const format of ['text', 'json'] as const) {
          const result = await runDuplication(scriptRoot, ['--format', format], { cwd: project });
          expect(result.code, result.stderr).not.toBe(99);
          expect(result.code).toBe(1);
          const argv = JSON.parse(await readFile(argvLog, 'utf8')) as string[];
          expect(argv).not.toContain('--format');
        }
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('leaves no cwd report/ directory after a successful fixture run', async () => {
      const project = await copyFixture('clean');
      try {
        await installMockJscpd(project, cleanPayload());
        const result = await runDuplication(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(0);
        expect(await pathExists(join(project, 'report'))).toBe(false);
        const entries = await readdir(project);
        expect(entries).not.toContain('report');
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });
  });

  describe('fatal failures exit 2 without mutating project files', () => {
    it('exits 2 when jscpd report JSON cannot be parsed', async () => {
      const project = await copyFixture('clean');
      try {
        await installMockJscpd(project, cleanPayload(), { failParse: true });
        const before = await readFile(join(project, 'package.json'), 'utf8');
        const result = await runDuplication(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(2);
        expect(await readFile(join(project, 'package.json'), 'utf8')).toBe(before);
        expect(await pathExists(join(project, 'report'))).toBe(false);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('exits 2 when jscpd report file is missing', async () => {
      const project = await copyFixture('clean');
      try {
        await installMockJscpd(project, cleanPayload(), { missingReport: true });
        const before = await readFile(join(project, 'package.json'), 'utf8');
        const result = await runDuplication(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(2);
        expect(await readFile(join(project, 'package.json'), 'utf8')).toBe(before);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('exits 2 when jscpd binary fails without a usable report', async () => {
      const project = await copyFixture('clean');
      try {
        const binDir = join(project, 'node_modules', '.bin');
        await mkdir(binDir, { recursive: true });
        await writeFile(join(binDir, 'jscpd'), '#!/bin/sh\necho "fatal" >&2\nexit 2\n', { mode: 0o755 });
        const before = await readFile(join(project, 'package.json'), 'utf8');
        const result = await runDuplication(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(2);
        expect(await readFile(join(project, 'package.json'), 'utf8')).toBe(before);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });
  });

  describe('threshold exits and envelope', () => {
    it('exits 0 with empty clones when clean percentage is within threshold', async () => {
      const project = await copyFixture('clean');
      try {
        await installMockJscpd(project, cleanPayload());
        const result = await runDuplication(scriptRoot, [], { cwd: project });
        expect(result.stderr, result.stderr).not.toMatch(/not implemented/i);
        expect(result.code).toBe(0);
        const report = parseReport(result.stdout);
        assertEnvelopeShape(report);
        expect(report.percentage).toBe(0);
        expect(report.threshold).toBe(0);
        expect(report.clones).toEqual([]);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('exits 1 with clones when percentage exceeds threshold', async () => {
      const project = await copyFixture('clone');
      try {
        await installMockJscpd(project, clonePayload());
        const result = await runDuplication(scriptRoot, ['--threshold', '0'], { cwd: project });
        expect(result.code).toBe(1);
        const report = parseReport(result.stdout);
        assertEnvelopeShape(report);
        expect(report.percentage).toBe(42.5);
        expect(report.threshold).toBe(0);
        expect(report.clones).toHaveLength(1);
        expect(report.clones[0]).toEqual({
          firstFile: 'a.js',
          firstStart: 1,
          firstEnd: 12,
          secondFile: 'b.js',
          secondStart: 1,
          secondEnd: 12,
          lines: 12,
          tokens: 48,
        });
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('emits JSON envelope by default and supports --format text; rejects bad format', async () => {
      const project = await copyFixture('clone');
      try {
        await installMockJscpd(project, clonePayload());

        const json = await runDuplication(scriptRoot, [], { cwd: project });
        expect(json.code).toBe(1);
        const report = parseReport(json.stdout);
        assertEnvelopeShape(report);
        expect(report.clones[0]?.firstFile).toBe('a.js');
        expect(report.clones[0]?.secondFile).toBe('b.js');
        expect(report.clones[0]?.lines).toBe(12);
        expect(report.clones[0]?.tokens).toBe(48);

        const text = await runDuplication(scriptRoot, ['--format', 'text'], { cwd: project });
        expect(text.code).toBe(1);
        let textIsJson = true;
        try {
          JSON.parse(text.stdout);
        } catch {
          textIsJson = false;
        }
        expect(textIsJson).toBe(false);
        expect(text.stdout).toMatch(/42\.5/);
        expect(text.stdout).toMatch(/a\.js/);
        expect(text.stdout).toMatch(/b\.js/);

        const bad = await runDuplication(scriptRoot, ['--format', 'yaml'], { cwd: project });
        expect(bad.code).toBe(2);
        expect(bad.stderr).toMatch(/unsupported --format/i);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });
  });

  describe('tool resolution and ignore defaults', () => {
    it('uses cwd node_modules/.bin/jscpd when present', async () => {
      const project = await copyFixture('clean');
      try {
        await installMockJscpd(project, cleanPayload());
        const result = await runDuplication(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(0);
        assertEnvelopeShape(parseReport(result.stdout));
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('falls back to npx jscpd when no local bin exists', async () => {
      const project = await copyFixture('clean');
      let fakeBin = '';
      try {
        fakeBin = await installFakeNpx(project, cleanPayload());
        const result = await runDuplication(scriptRoot, [], {
          cwd: project,
          env: { PATH: `${fakeBin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` },
        });
        expect(result.code).toBe(0);
        assertEnvelopeShape(parseReport(result.stdout));
      } finally {
        await rm(project, { recursive: true, force: true });
        if (fakeBin) await rm(fakeBin, { recursive: true, force: true });
      }
    });

    it('passes --gitignore and default ignore patterns to jscpd', async () => {
      const project = await copyFixture('clean');
      try {
        const { argvLog } = await installMockJscpd(project, cleanPayload());
        const result = await runDuplication(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(0);
        const argv = JSON.parse(await readFile(argvLog, 'utf8')) as string[];
        expect(argv).toContain('--gitignore');
        const ignoreIdx = argv.indexOf('--ignore');
        expect(ignoreIdx).toBeGreaterThan(-1);
        const ignoreValue = argv[ignoreIdx + 1] ?? '';
        expect(ignoreValue).toMatch(/node_modules/);
        expect(ignoreValue).toMatch(/dist|build|coverage/);
        expect(ignoreValue).toMatch(/test\/fixtures|fixtures/);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('exits 0 with empty clones when duplicates live only under default ignored paths', async () => {
      const project = await copyFixture('ignored-only');
      try {
        // Payload has real clones under node_modules/ and dist/; mock honors script --ignore.
        await installMockJscpd(project, ignoredOnlyClonePayload(), { respectIgnore: true });
        const result = await runDuplication(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(0);
        const report = parseReport(result.stdout);
        assertEnvelopeShape(report);
        expect(report.percentage).toBe(0);
        expect(report.clones).toEqual([]);
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('still reports clones when duplicates are outside ignored paths', async () => {
      const project = await copyFixture('clone');
      try {
        await installMockJscpd(project, clonePayload(), { respectIgnore: true });
        const result = await runDuplication(scriptRoot, [], { cwd: project });
        expect(result.code).toBe(1);
        const report = parseReport(result.stdout);
        expect(report.clones).toHaveLength(1);
        expect(report.clones[0]?.firstFile).toBe('a.js');
      } finally {
        await rm(project, { recursive: true, force: true });
      }
    });

    it('ships no script-root npm bootstrap in the catalog tree', async () => {
      const files = await readdir(CATALOG_SCRIPT);
      expect(files).toEqual(expect.arrayContaining(['index.mjs', 'script.json']));
      expect(files).not.toContain('package.json');
      expect(files).not.toContain('node_modules');
    });
  });
});
