import { Argument, Command, CommanderError, Option } from 'commander';
import { renderBanner, shouldShowBanner } from '@/adapters/cli/banner.js';
import type { TerminalSettings } from '@/adapters/cli/banner.js';
import {
  planInit,
  applyPlan,
  LeakError,
  StaleFileError,
  UnknownMcpError,
  UnknownScriptError,
  UnknownSkillError,
} from '@/application/init-mcps.js';
import type { InitDeps } from '@/application/init-mcps.js';
import { checkForUpdate } from '@/application/check-update.js';
import { getDiagnosis } from '@/application/doctor.js';
import { CatalogLoadError, listCatalog } from '@/application/list-catalog.js';
import { getStatus, type StatusReport } from '@/application/status.js';
import { undoInstall, UndoSelectionError, UndoVerifyError } from '@/application/undo-install.js';
import { uninstallItem, UninstallSelectionError } from '@/application/uninstall-item.js';
import { collapseWhitespace, LIST_KINDS, type CatalogEntry, type ListKind } from '@/domain/catalog/listing.js';
import type { InstallMethod } from '@/domain/install-method.js';
import { ConfigError } from '@/domain/json-merge.js';
import { ManifestError } from '@/domain/manifest.js';
import type { ChangePlan } from '@/domain/plan/change-plan.js';
import type { Finding } from '@/domain/plan/doctor-plan.js';
import type { AgentTarget, Scope } from '@/ports/agent-target.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
import { UnsafeTreeError, type FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import { PromptCancelled } from '@/ports/prompter.js';
import type { Prompter } from '@/ports/prompter.js';
import type { LatestVersionSource } from '@/ports/version-source.js';

/** Everything the CLI touches, injected by the composition root (or by tests). */
export interface CliDeps {
  /** Builds the catalog source: the bundled catalog by default, or the folder given by `--source`. */
  makeSource(folder?: string): CatalogSource;
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
  env: Record<string, string | undefined>;
  prompter: Prompter;
  out(line: string): void;
  err(line: string): void;
  now?: () => Date;
  /** Installed package semver; omit/undefined when unreadable. */
  cliVersion?: string;
  /** Enables the update notice; when absent, no check runs. */
  updates?: UpdateSettings;
  /** Terminal facts for the startup banner. When absent, the banner is not shown. */
  terminal?: TerminalSettings;
}

/** What the update check needs beyond the shared deps: where to ask, who we are, and whether to bother. */
export interface UpdateSettings {
  source: LatestVersionSource;
  currentVersion: string;
  /** True when stdout and stderr are both terminals. */
  interactive: boolean;
  /** Detected in the composition root; omitted means the npm-global fallback hint. */
  installMethod?: InstallMethod;
  timeoutMs?: number;
}

interface InitOptions {
  mcps?: string[];
  skills?: string[];
  scripts?: string[];
  scope?: Scope;
  source?: string;
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
}

interface ListOptions {
  search?: string;
  source?: string;
  json?: boolean;
}

/**
 * Exit codes: 0 ok, 1 error, 2 unresolved conflicts, 3 undo or uninstall refused (item changed since install),
 * 4 doctor found problems.
 */
const EXIT_CONFLICT = 2;
const EXIT_PROBLEMS = 4;

/** Version of the `status --json` document; later changes to its shape must be additive. */
const STATUS_JSON_VERSION = 1;

/** Version of the `list --json` document; later changes to its shape must be additive. */
const LIST_JSON_VERSION = 1;

function printList(deps: CliDeps, items: CatalogEntry[]): void {
  if (items.length === 0) {
    deps.out('no matching items');
    return;
  }
  const width = Math.max(...items.map((i) => i.name.length));
  let kind: string | undefined;
  for (const item of items) {
    if (item.kind !== kind) deps.out(`${(kind = item.kind)}s:`);
    const description = item.description === null ? '' : collapseWhitespace(item.description);
    deps.out(description === '' ? `  ${item.name}` : `  ${item.name.padEnd(width)}  ${description}`);
  }
}

async function runList(deps: CliDeps, kind: ListKind | undefined, opts: ListOptions): Promise<number> {
  let report;
  try {
    report = await listCatalog({ source: deps.makeSource(opts.source) }, { kind, search: opts.search });
  } catch (e) {
    if (!(e instanceof CatalogLoadError)) throw e;
    deps.err(`error: cannot load catalog from ${opts.source ?? 'the bundled catalog'}: ${e.message}`);
    return 1;
  }
  // Catalog problems go to stderr in both modes so `--json` keeps stdout parseable.
  for (const issue of report.issues) deps.err(`warning: skipped ${issue.file}: ${issue.reason}`);
  if (opts.json) deps.out(JSON.stringify({ version: LIST_JSON_VERSION, items: report.items }, null, 2));
  else printList(deps, report.items);
  return 0;
}

/** Version of the `doctor --json` document; later changes to its shape must be additive. */
const DOCTOR_JSON_VERSION = 1;

function printPlan(deps: CliDeps, plan: ChangePlan): void {
  const row = (name: string, action: string, reason?: string): string =>
    `  ${name}: ${action}${reason ? ` (${reason})` : ''}`;
  for (const file of plan.files.filter((f) => f.items.length > 0)) {
    deps.out(`${file.scope} scope: ${file.path}`);
    for (const item of file.items) deps.out(row(item.name, item.action, item.reason));
  }
  for (const skill of plan.skills) {
    deps.out(`${skill.scope} scope: ${skill.root}`);
    deps.out(row(skill.name, skill.action, skill.reason));
  }
  for (const script of plan.scripts) {
    deps.out(`${script.scope} scope: ${script.root}`);
    deps.out(row(script.name, script.action, script.reason));
  }
  for (const v of plan.requiredEnv)
    deps.out(v.set ? `env ${v.name}: set` : `warning: ${v.name} is not set; set it before using the server`);
}

/** `--yes`, or a kind flag together with `--scope`, means `init` will not prompt. */
function initIsNonInteractive(opts: InitOptions): boolean {
  const kindFlag = opts.mcps !== undefined || opts.skills !== undefined || opts.scripts !== undefined;
  return opts.yes === true || (kindFlag && opts.scope !== undefined);
}

async function runInit(deps: CliDeps, opts: InitOptions): Promise<number> {
  const kindFlag = opts.mcps !== undefined || opts.skills !== undefined || opts.scripts !== undefined;
  const nonInteractive = initIsNonInteractive(opts);
  if (nonInteractive && !kindFlag) {
    deps.err('error: select at least one kind: pass --mcps, --skills and/or --scripts');
    return 1;
  }
  if (nonInteractive && opts.scope === undefined) {
    deps.err('error: --yes requires --scope');
    return 1;
  }
  const source = deps.makeSource(opts.source);
  const initDeps: InitDeps = {
    source,
    fs: deps.fs,
    target: deps.target,
    paths: deps.paths,
    env: deps.env,
    now: deps.now,
  };
  const where = opts.source ?? 'the bundled catalog';
  let catalog;
  try {
    catalog = await source.load();
  } catch (e) {
    deps.err(`error: cannot load catalog from ${where}: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  for (const issue of catalog.issues) deps.err(`warning: skipped ${issue.file}: ${issue.reason}`);

  // A flag for one kind means the other kinds are not wanted; with no flag every kind is asked.
  const mcps = opts.mcps ?? (kindFlag ? [] : await deps.prompter.selectMcps(catalog.mcps));
  const skills =
    opts.skills ?? (kindFlag || catalog.skills.length === 0 ? [] : await deps.prompter.selectSkills(catalog.skills));
  const scripts =
    opts.scripts ??
    (kindFlag || catalog.scripts.length === 0 ? [] : await deps.prompter.selectScripts(catalog.scripts));
  if (mcps.length === 0 && skills.length === 0 && scripts.length === 0) {
    deps.err('error: select at least one MCP, skill or script');
    return 1;
  }
  const scope = opts.scope ?? (await deps.prompter.selectScope());
  let force = opts.force === true;
  let plan = await planInit(initDeps, { mcps, skills, scripts, scope, force });

  const conflicts = [
    ...plan.files
      .flatMap((f) => f.items.filter((i) => i.action === 'conflict'))
      .map((i) => ({ ...i, kind: 'mcp' as const })),
    ...plan.skills.filter((sk) => sk.action === 'conflict').map((sk) => ({ ...sk, kind: 'skill' as const })),
    ...plan.scripts.filter((sc) => sc.action === 'conflict').map((sc) => ({ ...sc, kind: 'script' as const })),
  ];
  if (conflicts.length > 0) {
    if (nonInteractive) {
      for (const c of conflicts) deps.err(`conflict: ${c.kind} '${c.name}' already exists with different content`);
      deps.err('error: unresolved conflicts; re-run with --force to overwrite them');
      return EXIT_CONFLICT;
    }
    const keep = { mcp: new Set(mcps), skill: new Set(skills), script: new Set(scripts) };
    for (const c of conflicts) {
      const choice = await deps.prompter.resolveConflict({
        kind: c.kind,
        name: c.name,
        reason: c.reason ?? 'conflict',
      });
      if (choice === 'skip') keep[c.kind].delete(c.name);
      else force = true;
    }
    plan = await planInit(initDeps, {
      mcps: mcps.filter((m) => keep.mcp.has(m)),
      skills: skills.filter((sk) => keep.skill.has(sk)),
      scripts: scripts.filter((sc) => keep.script.has(sc)),
      scope,
      force,
    });
  }

  printPlan(deps, plan);
  if (scope === 'user' && plan.files.length > 0)
    deps.out('note: close Claude Code before applying, it may rewrite ~/.claude.json while running');
  if (opts.dryRun) {
    deps.out('dry run: nothing was written');
    return 0;
  }
  if (!nonInteractive && !(await deps.prompter.confirm(plan))) {
    deps.out('aborted: nothing was written');
    return 0;
  }
  deps.out((await applyPlan(initDeps, plan, { force })) ? 'done' : 'nothing to change');
  return 0;
}

async function runUndo(deps: CliDeps, opts: { id?: string; force?: boolean; dryRun?: boolean }): Promise<number> {
  const result = await undoInstall({ fs: deps.fs, paths: deps.paths, now: deps.now }, opts);
  switch (result.status) {
    case 'nothing':
      deps.out('nothing to undo');
      break;
    case 'already-undone':
      deps.out(`install ${result.installId} was already undone`);
      break;
    case 'refused':
      for (const f of result.changed) deps.err(`changed since install: ${f}`);
      deps.err('error: refusing to undo; re-run with --force to restore anyway');
      break;
    case 'dry-run':
      deps.out(`dry run: would restore ${result.files.join(', ')}`);
      break;
    case 'undone':
      deps.out(`undone install ${result.installId}: restored ${result.files.join(', ')}`);
      break;
  }
  return result.exitCode;
}

interface UninstallOptions {
  scope?: Scope;
  kind?: 'mcp' | 'skill' | 'script';
  dryRun?: boolean;
  force?: boolean;
}

async function runUninstall(deps: CliDeps, name: string, opts: UninstallOptions): Promise<number> {
  const result = await uninstallItem(
    { fs: deps.fs, target: deps.target, paths: deps.paths, now: deps.now },
    { name, ...opts },
  );
  const { item } = result;
  const label = `${item.kind} '${item.name}' (${item.scope} scope)`;
  if ((result.status === 'removed' || result.status === 'dry-run') && item.kind === 'mcp' && item.scope === 'user')
    deps.out('note: close Claude Code before applying, it may rewrite ~/.claude.json while running');
  switch (result.status) {
    case 'already-absent':
      deps.out(`${label} is already absent; nothing to remove`);
      break;
    case 'refused':
      deps.err(`changed since install: ${item.path}`);
      deps.err('error: refusing to uninstall; re-run with --force to remove anyway');
      break;
    case 'dry-run':
      deps.out(`dry run: would remove ${result.files.join(', ')}`);
      break;
    case 'removed':
      deps.out(
        `uninstalled ${label}: removed ${result.files.join(', ')} (install ${result.installId}; undo reverts it)`,
      );
      break;
  }
  return result.exitCode;
}

function printStatus(deps: CliDeps, report: StatusReport): void {
  deps.out(`target: ${report.target}`);
  if (report.catalog === 'unavailable') deps.out('catalog unavailable');
  if (report.items.length === 0) deps.out('no managed items');
  let scope: string | undefined;
  let kind: string | undefined;
  for (const item of report.items) {
    if (item.scope !== scope) {
      deps.out(`${(scope = item.scope)} scope:`);
      kind = undefined;
    }
    if (item.kind !== kind) deps.out(`  ${(kind = item.kind)}s:`);
    deps.out(`    ${item.name}: ${item.state}  ${item.path}`);
  }
}

async function runStatus(deps: CliDeps, opts: { scope?: Scope; source?: string; json?: boolean }): Promise<number> {
  const report = await getStatus(
    { source: deps.makeSource(opts.source), fs: deps.fs, target: deps.target, paths: deps.paths },
    { scope: opts.scope },
  );
  // Catalog problems go to stderr in both modes so `--json` keeps stdout parseable.
  for (const issue of report.issues) deps.err(`warning: skipped ${issue.file}: ${issue.reason}`);
  if (opts.json) {
    const { target, catalog, items } = report;
    deps.out(JSON.stringify({ version: STATUS_JSON_VERSION, target, catalog, items }, null, 2));
  } else printStatus(deps, report);
  return 0;
}

function printDiagnosis(deps: CliDeps, target: string, findings: Finding[]): void {
  const problems = findings.filter((f) => f.severity === 'problem');
  const info = findings.filter((f) => f.severity === 'info');
  deps.out(`target: ${target}`);
  if (problems.length === 0) deps.out('no problems found');
  else {
    deps.out('problems:');
    for (const f of problems) {
      deps.out(`  ${f.message}`);
      deps.out(`    fix: ${f.fix}`);
    }
  }
  if (info.length > 0) {
    deps.out('info:');
    for (const f of info) deps.out(`  ${f.message}  ${f.path}`);
  }
  if (findings.length > 0) deps.out(`${problems.length} problems, ${info.length} info`);
}

async function runDoctor(deps: CliDeps, opts: { scope?: Scope; source?: string; json?: boolean }): Promise<number> {
  const report = await getDiagnosis(
    { source: deps.makeSource(opts.source), fs: deps.fs, target: deps.target, paths: deps.paths, env: deps.env },
    { scope: opts.scope },
  );
  // Warnings go to stderr in both modes so `--json` keeps stdout parseable.
  if (report.catalog === 'unavailable') deps.err('warning: catalog unavailable; out-of-date checks were skipped');
  for (const issue of report.issues) deps.err(`warning: skipped ${issue.file}: ${issue.reason}`);
  const problems = report.findings.filter((f) => f.severity === 'problem').length;
  if (opts.json) {
    deps.out(
      JSON.stringify(
        {
          version: DOCTOR_JSON_VERSION,
          target: report.target,
          healthy: problems === 0,
          summary: { problems, info: report.findings.length - problems },
          findings: report.findings,
        },
        null,
        2,
      ),
    );
  } else printDiagnosis(deps, report.target, report.findings);
  return problems === 0 ? 0 : EXIT_PROBLEMS;
}

const csv = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const UNREADABLE_VERSION = 'Unable to determine shitaku version.';

/** True when argv (after node/script) asks for a top-level version report. */
function isVersionInvocation(argv: string[]): boolean {
  return argv.slice(2).some((token) => token === 'version' || token === '-v' || token === '--version');
}

function printBannerIfNeeded(deps: CliDeps, action: Command, argv: string[]): void {
  const opts = action.optsWithGlobals<InitOptions & { json?: boolean; banner?: boolean }>();
  const prompts = action.name() === 'init' && !initIsNonInteractive(opts);
  if (
    !shouldShowBanner({
      tty: deps.terminal?.tty === true,
      prompts,
      json: opts.json === true,
      version: isVersionInvocation(argv),
      noBanner: opts.banner === false,
      env: deps.env,
    })
  )
    return;
  for (const line of renderBanner({
    version: deps.cliVersion,
    color: deps.terminal?.color === true,
    unicode: deps.terminal?.unicode === true,
  }))
    deps.err(line);
}

export async function runCli(argv: string[], deps: CliDeps): Promise<number> {
  if (isVersionInvocation(argv) && deps.cliVersion === undefined) {
    deps.err(UNREADABLE_VERSION);
    return 1;
  }

  let exitCode = 0;
  const strip = (s: string): string => s.replace(/\n$/, '');
  const program = new Command()
    .name('shitaku')
    .description('Install curated AI agent configuration from a catalog.')
    .exitOverride()
    .configureOutput({ writeOut: (s) => deps.out(strip(s)), writeErr: (s) => deps.err(strip(s)) })
    .configureHelp({ showGlobalOptions: true })
    .option('--no-banner', 'do not print the startup banner');

  const version = deps.cliVersion;
  if (version !== undefined) {
    program.version(version, '-v, --version');
    program
      .command('version')
      .description('Print the installed shitaku version')
      .action(() => {
        deps.out(version);
      });
  }

  program
    .command('init')
    .description('Install MCP servers, skills and scripts for Claude Code')
    .option('--mcps <names>', 'comma-separated MCP names', csv)
    .option('--skills <names>', 'comma-separated skill names', csv)
    .option('--scripts <names>', 'comma-separated script names', csv)
    .addOption(new Option('--scope <scope>', 'where to install').choices(['project', 'user']))
    .option('--source <folder>', 'use a catalog folder instead of the bundled one (trusted: its commands run later)')
    .option('--dry-run', 'print the plan without writing anything')
    .option('--yes', 'skip confirmation (requires --scope and --mcps, --skills and/or --scripts)')
    .option(
      '--force',
      'overwrite existing entries and skill/script directories that differ (trees are backed up first)',
    )
    .action(async (opts: InitOptions) => void (exitCode = await guarded(deps, () => runInit(deps, opts))));

  program
    .command('undo')
    .description('Restore the files changed by the last install')
    .option('--id <id>', 'install id to undo (must be the newest for its files)')
    .option('--force', 'restore even if files changed since the install')
    .option('--dry-run', 'show what would be restored')
    .action(
      async (opts: { id?: string; force?: boolean; dryRun?: boolean }) =>
        void (exitCode = await guarded(deps, () => runUndo(deps, opts))),
    );

  program
    .command('uninstall <name>')
    .description('Remove one MCP server, skill or script that shitaku installed (undo reverts it)')
    .addOption(new Option('--scope <scope>', 'scope to remove from (default: inferred)').choices(['project', 'user']))
    .addOption(
      new Option('--kind <kind>', 'resolve a name that is an MCP, skill and/or script').choices([
        'mcp',
        'skill',
        'script',
      ]),
    )
    .option('--dry-run', 'show what would be removed')
    .option('--force', 'remove even if the item changed since the install')
    .action(
      async (name: string, opts: UninstallOptions) =>
        void (exitCode = await guarded(deps, () => runUninstall(deps, name, opts))),
    );

  program
    .command('status')
    .description('List the items shitaku installed and whether they changed')
    .addOption(new Option('--scope <scope>', 'only report this scope (default: both)').choices(['project', 'user']))
    .option('--source <folder>', 'compare against a catalog folder instead of the bundled one')
    .option('--json', 'print one versioned JSON document')
    .action(
      async (opts: { scope?: Scope; source?: string; json?: boolean }) =>
        void (exitCode = await guarded(deps, () => runStatus(deps, opts))),
    );

  program
    .command('list')
    .description('List the MCPs, skills, profiles and scripts a catalog offers')
    .addArgument(new Argument('[kind]', 'only list this kind').choices(LIST_KINDS))
    .option('--search <text>', 'only items whose name or description contains this text (case-insensitive)')
    .option('--source <folder>', 'list a catalog folder instead of the bundled one')
    .option('--json', 'print one versioned JSON document')
    .action(
      async (kind: ListKind | undefined, opts: ListOptions) =>
        void (exitCode = await guarded(deps, () => runList(deps, kind, opts))),
    );

  program
    .command('doctor')
    .description('Diagnose the installed items and suggest fixes (exit 4 when problems exist)')
    .addOption(new Option('--scope <scope>', 'only diagnose this scope (default: both)').choices(['project', 'user']))
    .option('--source <folder>', 'compare against a catalog folder instead of the bundled one')
    .option('--json', 'print one versioned JSON document')
    .action(
      async (opts: { scope?: Scope; source?: string; json?: boolean }) =>
        void (exitCode = await guarded(deps, () => runDoctor(deps, opts))),
    );

  program.hook('preAction', (_thisCommand, actionCommand) => {
    printBannerIfNeeded(deps, actionCommand, argv);
  });

  // Started before dispatch so the lookup overlaps the command; checkForUpdate never rejects.
  // Version entry points skip the check entirely (no cache/network side effects).
  const pending =
    deps.updates && !isVersionInvocation(argv)
      ? checkForUpdate(
          { fs: deps.fs, paths: deps.paths, env: deps.env, source: deps.updates.source, now: deps.now },
          {
            currentVersion: deps.updates.currentVersion,
            interactive: deps.updates.interactive,
            installMethod: deps.updates.installMethod,
            timeoutMs: deps.updates.timeoutMs,
          },
        )
      : undefined;

  try {
    await program.parseAsync(argv);
  } catch (e) {
    if (!(e instanceof CommanderError)) throw e;
    exitCode = e.exitCode;
  }
  const notice = await pending;
  if (notice) deps.err(notice);
  return exitCode;
}

/** Turns expected failures into a message and exit code 1; unknown errors still propagate. */
async function guarded(deps: CliDeps, run: () => Promise<number>): Promise<number> {
  try {
    return await run();
  } catch (e) {
    const known = [
      UnknownMcpError,
      UnknownSkillError,
      UnknownScriptError,
      UnsafeTreeError,
      StaleFileError,
      LeakError,
      ConfigError,
      ManifestError,
      UndoSelectionError,
      UndoVerifyError,
      UninstallSelectionError,
      PromptCancelled,
    ];
    if (e instanceof Error && known.some((k) => e instanceof k)) {
      deps.err(`error: ${e.message}`);
      return 1;
    }
    throw e;
  }
}
