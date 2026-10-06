#!/usr/bin/env node
// Composition root: the only module that touches os.homedir, process and the package location.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FolderCatalogSource } from './adapters/catalog/folder-source.js';
import { localePrefersUtf8, terminalSupportsColor } from './adapters/cli/banner.js';
import { ClackPrompter } from './adapters/cli/clack-prompter.js';
import { runCli } from './adapters/cli/program.js';
import { claudeCodeTarget } from './adapters/claude-code/target.js';
import { NodeFileSystem } from './adapters/fs/node-fs.js';
import { NpmRegistryVersionSource } from './adapters/npm/registry-version-source.js';
import { NodeProcessRunner } from './adapters/process/node-process-runner.js';
import { detectInstallMethod } from './domain/install-method.js';

const cwd = process.cwd();
const bundled = fileURLToPath(new URL('../catalog/', import.meta.url));

const PACKAGE_NAME = '@jsisques/shitaku';

/** The installed version, or undefined when package.json is unreadable (then the update check is skipped). */
function readVersion(): string | undefined {
  try {
    const pkg: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const version = (pkg as { version?: unknown } | null)?.version;
    return typeof version === 'string' ? version : undefined;
  } catch {
    return undefined;
  }
}

const version = readVersion();
const installMethod = detectInstallMethod({
  npmCommand: process.env['npm_command'],
  npmExecPath: process.env['npm_execpath'],
  npmConfigUserAgent: process.env['npm_config_user_agent'],
  binPath: process.argv[1] ?? '',
});

process.exitCode = await runCli(process.argv, {
  makeSource: (folder) =>
    folder ? new FolderCatalogSource(resolve(cwd, folder), 'folder') : new FolderCatalogSource(bundled, 'bundled'),
  fs: new NodeFileSystem(),
  target: claudeCodeTarget,
  paths: { homeDir: homedir(), cwd },
  env: process.env,
  prompter: new ClackPrompter(),
  out: (line) => console.log(line),
  err: (line) => console.error(line),
  cliVersion: version,
  installMethod,
  processRunner: new NodeProcessRunner(),
  execPath: process.execPath,
  platform: process.platform,
  terminal: {
    tty: Boolean(process.stdout.isTTY && process.stderr.isTTY),
    color: terminalSupportsColor(process.env, Boolean(process.stderr.isTTY)),
    unicode: localePrefersUtf8(process.env),
  },
  updates:
    version === undefined
      ? undefined
      : {
          source: new NpmRegistryVersionSource(PACKAGE_NAME),
          currentVersion: version,
          interactive: process.stdout.isTTY && process.stderr.isTTY,
          installMethod,
        },
});
