import { dirname } from 'node:path';
import { hashEntry, sha256 } from '@/domain/hash.js';
import type { McpItem } from '@/domain/catalog/schema.js';
import type { Install, Manifest } from '@/domain/manifest.js';
import {
  deriveCommandOwnership,
  deriveOwnership,
  deriveScriptOwnership,
  deriveSkillOwnership,
} from '@/domain/manifest.js';
import {
  buildFlatFilePlan,
  writesFlatFile,
  type FlatFileChange,
  type FlatFilePlanEntry,
} from '@/domain/plan/flat-file-plan.js';
import { buildScriptPlan, writesScript, type ScriptChange, type ScriptPlanEntry } from '@/domain/plan/script-plan.js';
import { buildSkillPlan, writesSkill, type SkillChange, type SkillPlanEntry } from '@/domain/plan/skill-plan.js';
import { buildPlan, replanFile, writesFile } from '@/domain/plan/change-plan.js';
import type { ChangePlan, FileChange } from '@/domain/plan/change-plan.js';
import type { AgentTarget, Scope } from '@/ports/agent-target.js';
import type { CatalogSource } from '@/ports/catalog-source.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import {
  backupPath,
  newInstallId,
  restoreBytes,
  restoreText,
  rollback,
  StaleFileError,
} from './install-transaction.js';
import { appendInstall, loadManifest, scriptsDir, stateDir } from './journal.js';
import { readPresent } from './skill-tree.js';

export interface InitDeps {
  source: CatalogSource;
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
  /** Process environment, injected. Only used to report whether required variables are set. */
  env: Record<string, string | undefined>;
  /** Clock for install ids and timestamps; defaults to the system clock. */
  now?: () => Date;
}

export interface InitRequest {
  mcps: string[];
  /** Skill names to install; defaults to none. */
  skills?: string[];
  /** Script names to install; defaults to none. */
  scripts?: string[];
  /** Command names to install; defaults to none. */
  commands?: string[];
  scope: Scope;
  force?: boolean;
  dryRun?: boolean;
}

export class UnknownMcpError extends Error {}
export class UnknownSkillError extends Error {}
export class UnknownScriptError extends Error {}
export class UnknownCommandError extends Error {}
export { StaleFileError };
/** A resolved env value would be written to disk. */
export class LeakError extends Error {}

export { scriptsDir } from './journal.js';

export async function planInit(deps: InitDeps, req: InitRequest): Promise<ChangePlan> {
  const catalog = await deps.source.load();
  const unknown = req.mcps.filter((name) => !catalog.mcps.some((m) => m.name === name));
  if (unknown.length > 0) throw new UnknownMcpError(`unknown MCP: ${unknown.join(', ')}`);
  const skillNames = [...new Set(req.skills ?? [])];
  const unknownSkills = skillNames.filter((name) => !catalog.skills.some((sk) => sk.name === name));
  if (unknownSkills.length > 0) throw new UnknownSkillError(`unknown skill: ${unknownSkills.join(', ')}`);
  const scriptNames = [...new Set(req.scripts ?? [])];
  const unknownScripts = scriptNames.filter((name) => !catalog.scripts.some((sc) => sc.name === name));
  if (unknownScripts.length > 0) throw new UnknownScriptError(`unknown script: ${unknownScripts.join(', ')}`);
  const commandNames = [...new Set(req.commands ?? [])];
  const unknownCommands = commandNames.filter((name) => !catalog.commands.some((c) => c.name === name));
  if (unknownCommands.length > 0) throw new UnknownCommandError(`unknown command: ${unknownCommands.join(', ')}`);

  const manifest = await loadManifest(deps.fs, deps.paths.homeDir);
  const mcpPlan = await planMcps(deps, req, catalog.mcps, manifest);
  const skillsDir = deps.target.skillsDir(req.scope, deps.paths);
  const skillEntries: SkillPlanEntry[] = [];
  for (const name of skillNames) {
    const root = `${skillsDir}/${name}`;
    skillEntries.push({
      skill: catalog.skills.find((sk) => sk.name === name)!,
      root,
      scope: req.scope,
      present: await readPresent(deps.fs, root),
    });
  }
  const scriptRootBase = scriptsDir(req.scope, deps.paths);
  const scriptEntries: ScriptPlanEntry[] = [];
  for (const name of scriptNames) {
    const root = `${scriptRootBase}/${name}`;
    scriptEntries.push({
      script: catalog.scripts.find((sc) => sc.name === name)!,
      root,
      scope: req.scope,
      present: await readPresent(deps.fs, root),
    });
  }
  const commandsRoot = deps.target.commandsDir(req.scope, deps.paths);
  const commandEntries: FlatFilePlanEntry[] = [];
  for (const name of commandNames) {
    const path = `${commandsRoot}/${name}.md`;
    commandEntries.push({
      name,
      path,
      scope: req.scope,
      bytes: catalog.commands.find((c) => c.name === name)!.bytes,
      present: await deps.fs.readBytes(path),
    });
  }
  return {
    ...mcpPlan,
    skills: buildSkillPlan({ skills: skillEntries, owned: deriveSkillOwnership(manifest), force: req.force }),
    scripts: buildScriptPlan({
      scripts: scriptEntries,
      owned: deriveScriptOwnership(manifest),
      force: req.force,
    }),
    commands: buildFlatFilePlan({
      entries: commandEntries,
      owned: deriveCommandOwnership(manifest),
      noun: 'command',
      force: req.force,
    }),
  };
}

async function planMcps(
  deps: InitDeps,
  req: InitRequest,
  catalogMcps: McpItem[],
  manifest: Manifest,
): Promise<ChangePlan> {
  if (req.mcps.length === 0)
    return { files: [], requiredEnv: [], declaredEnv: [], skills: [], scripts: [], commands: [] };
  const items = req.mcps.map((name) => catalogMcps.find((m) => m.name === name)!);
  const path = deps.target.configPath(req.scope, deps.paths);
  const existing = await deps.fs.readText(path);
  return buildPlan({
    items,
    target: deps.target,
    scope: req.scope,
    paths: deps.paths,
    existing,
    env: deps.env,
    force: req.force,
    owned: deriveOwnership(manifest)[path] ?? {},
  });
}

const actions = (file: FileChange): string => file.items.map((i) => `${i.name}:${i.action}`).join(',');

/** Re-reads each file; re-plans once if it changed, aborting when the actions differ. */
async function refresh(
  deps: InitDeps,
  file: FileChange,
  owned: Record<string, string>,
  force: boolean,
): Promise<FileChange> {
  const fresh = await deps.fs.readText(file.path);
  if ((fresh === null ? null : sha256(fresh)) === file.beforeHash) return file;
  const replanned = replanFile(file, fresh, deps.target.serversKeyPath(file.scope), owned, force);
  if (actions(replanned) !== actions(file)) throw new StaleFileError(`${file.path} changed since planning, re-run`);
  return replanned;
}

function assertNoLeak(plan: ChangePlan, files: FileChange[], env: InitDeps['env']): void {
  for (const name of plan.declaredEnv) {
    const value = env[name];
    if (value && files.some((f) => f.after.includes(value)))
      throw new LeakError(`the value of ${name} would be written to disk; aborting`);
  }
}

/** Re-reads each writable skill directory; re-plans once if it changed, aborting when the action differs. */
async function refreshSkill(
  deps: InitDeps,
  change: SkillChange,
  owned: Record<string, string>,
  force: boolean,
): Promise<SkillChange> {
  const fresh = await readPresent(deps.fs, change.root);
  const [replanned] = buildSkillPlan({
    skills: [
      {
        skill: { name: change.name, description: '', files: change.files },
        root: change.root,
        scope: change.scope,
        present: fresh,
      },
    ],
    owned,
    force,
  });
  if (replanned!.action !== change.action) throw new StaleFileError(`${change.root} changed since planning, re-run`);
  return replanned!;
}

/** Re-reads each writable script directory; re-plans once if it changed, aborting when the action differs. */
async function refreshScript(
  deps: InitDeps,
  change: ScriptChange,
  owned: Record<string, string>,
  force: boolean,
): Promise<ScriptChange> {
  const fresh = await readPresent(deps.fs, change.root);
  const [replanned] = buildScriptPlan({
    scripts: [
      {
        script: { name: change.name, description: '', tools: [], files: change.files },
        root: change.root,
        scope: change.scope,
        present: fresh,
      },
    ],
    owned,
    force,
  });
  if (replanned!.action !== change.action) throw new StaleFileError(`${change.root} changed since planning, re-run`);
  return replanned!;
}

/** Re-reads each writable command file; re-plans once if it changed, aborting when the action differs. */
async function refreshFlatFile(
  deps: InitDeps,
  change: FlatFileChange,
  owned: Record<string, string>,
  force: boolean,
): Promise<FlatFileChange> {
  const { name, path, scope, bytes } = change;
  const present = await deps.fs.readBytes(path);
  const [replanned] = buildFlatFilePlan({
    entries: [{ name, path, scope, bytes, present }],
    owned,
    noun: 'command',
    force,
  });
  if (replanned!.action !== change.action) throw new StaleFileError(`${path} changed since planning, re-run`);
  return replanned!;
}

type TreeChange = SkillChange | ScriptChange;
type TreeKind = 'skill' | 'script';

/** One file write or removal of a skill, script or command, with the bytes needed to record and undo it. */
interface ByteStep {
  path: string;
  scope: Scope;
  /** The manifest item this file belongs to; for a command `root` is the file itself. */
  item: {
    kind: TreeKind | 'command';
    name: string;
    action: 'create' | 'update';
    entryHash: string;
    root: string;
  };
  /** Bytes the apply writes; null when the file is deleted. */
  after: Uint8Array | null;
  before: Uint8Array | null;
}

const SKILL_ENTRY = 'SKILL.md';
const SCRIPT_ENTRY = 'index.mjs';

/** Per tree: writes first, deletions next, entry file last so a half-written item never loads. */
function treeSteps(change: TreeChange, kind: TreeKind): ByteStep[] {
  const entry = kind === 'skill' ? SKILL_ENTRY : SCRIPT_ENTRY;
  const before = new Map(change.present.map((f) => [f.path, f.bytes]));
  const step = (path: string, after: Uint8Array | null): ByteStep => ({
    path: `${change.root}/${path}`,
    scope: change.scope,
    item: {
      kind,
      name: change.name,
      action: change.action as 'create' | 'update',
      entryHash: change.desiredHash,
      root: change.root,
    },
    after,
    before: before.get(path) ?? null,
  });
  const writes = change.files.filter((f) => f.path !== entry).map((f) => step(f.path, f.bytes));
  const removals = change.removed.map((p) => step(p, null));
  const entryWrites = change.files.filter((f) => f.path === entry).map((f) => step(f.path, f.bytes));
  return [...writes, ...removals, ...entryWrites];
}

/** A command is one file, so its step is both the whole item and its own root. */
const commandStep = (change: FlatFileChange): ByteStep => ({
  path: change.path,
  scope: change.scope,
  item: {
    kind: 'command',
    name: change.name,
    action: change.action as 'create' | 'update',
    entryHash: change.desiredHash,
    root: change.path,
  },
  after: change.bytes,
  before: change.present,
});

/** Directories that do not exist yet and that writing these paths will create, parents first. */
async function missingDirs(fs: FileSystem, paths: string[]): Promise<string[]> {
  const found = new Set<string>();
  for (const path of paths) {
    const chain: string[] = [];
    for (let dir = dirname(path); !found.has(dir) && !(await fs.exists(dir)); dir = dirname(dir)) chain.push(dir);
    for (const dir of chain.reverse()) found.add(dir);
  }
  return [...found];
}

/** Re-reads, scans for leaked values, backs up, writes atomically and journals every changed file, skill, script and command. */
export async function applyPlan(deps: InitDeps, plan: ChangePlan, opts: { force?: boolean } = {}): Promise<boolean> {
  const { homeDir } = deps.paths;
  const force = opts.force ?? false;
  const manifest = await loadManifest(deps.fs, homeDir);
  const ownership = deriveOwnership(manifest);
  const files: FileChange[] = [];
  for (const file of plan.files.filter(writesFile))
    files.push(await refresh(deps, file, ownership[file.path] ?? {}, force));
  const skillOwners = deriveSkillOwnership(manifest);
  const skills: SkillChange[] = [];
  for (const change of plan.skills.filter(writesSkill))
    skills.push(await refreshSkill(deps, change, skillOwners, force));
  const scriptOwners = deriveScriptOwnership(manifest);
  const scripts: ScriptChange[] = [];
  for (const change of plan.scripts.filter(writesScript))
    scripts.push(await refreshScript(deps, change, scriptOwners, force));
  const commandOwners = deriveCommandOwnership(manifest);
  const commands: FlatFileChange[] = [];
  for (const change of plan.commands.filter(writesFlatFile))
    commands.push(await refreshFlatFile(deps, change, commandOwners, force));
  if (files.length === 0 && skills.length === 0 && scripts.length === 0 && commands.length === 0) return false;
  assertNoLeak(plan, files, deps.env);

  const now = (deps.now ?? (() => new Date()))();
  const id = newInstallId(now);
  const steps = [
    ...skills.flatMap((c) => treeSteps(c, 'skill')),
    ...scripts.flatMap((c) => treeSteps(c, 'script')),
    ...commands.map(commandStep),
  ];
  const createdDirs = await missingDirs(
    deps.fs,
    steps.filter((s) => s.after !== null).map((s) => s.path),
  );

  let n = 0;
  const installed: Install['files'] = [];
  const state = stateDir(homeDir);
  const mcpBackups = new Map<FileChange, string | null>();
  for (const file of files) {
    const backup = file.before === null ? null : backupPath(id, n++, file.path);
    if (backup !== null) await deps.fs.writeAtomic(`${state}/${backup}`, file.before!);
    mcpBackups.set(file, backup);
  }
  const byteBackups = new Map<ByteStep, string | null>();
  for (const step of steps) {
    const backup = step.before === null ? null : backupPath(id, n++, step.path);
    if (backup !== null) await deps.fs.writeBytes(`${state}/${backup}`, step.before!);
    byteBackups.set(step, backup);
  }

  const undo: (() => Promise<void>)[] = [];
  try {
    for (const file of files) {
      await deps.fs.writeAtomic(file.path, file.after);
      undo.push(() => restoreText(deps.fs, file.path, file.before));
      const written = file.items.filter((i) => i.action === 'create' || i.action === 'update');
      installed.push({
        path: file.path,
        scope: file.scope,
        backup: mcpBackups.get(file)!,
        beforeHash: file.beforeHash,
        afterHash: sha256(file.after),
        items: written.map((i) => ({
          kind: 'mcp',
          name: i.name,
          action: i.action as 'create' | 'update',
          entryHash: hashEntry(i.entry),
        })),
      });
    }
    for (const step of steps) {
      if (step.after === null) await deps.fs.remove(step.path);
      else await deps.fs.writeBytes(step.path, step.after);
      undo.push(() => restoreBytes(deps.fs, step.path, step.before));
      installed.push({
        path: step.path,
        scope: step.scope,
        backup: byteBackups.get(step)!,
        beforeHash: step.before === null ? null : sha256(step.before),
        afterHash: step.after === null ? null : sha256(step.after),
        items: [step.item],
      });
    }
    const source = deps.source.ref();
    await appendInstall(deps.fs, homeDir, {
      id,
      createdAt: now.toISOString(),
      undoneAt: null,
      source: { ...source, catalogVersion: 1 },
      files: installed,
      createdDirs,
    });
  } catch (error) {
    throw await rollback(deps.fs, undo, [...createdDirs].reverse(), error);
  }
  return true;
}

export async function initMcps(deps: InitDeps, req: InitRequest): Promise<{ plan: ChangePlan; applied: boolean }> {
  const plan = await planInit(deps, req);
  if (req.dryRun) return { plan, applied: false };
  return { plan, applied: await applyPlan(deps, plan, { force: req.force }) };
}
