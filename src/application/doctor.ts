import { deriveOwnedItems } from '@/domain/manifest.js';
import { diagnose, type Finding, type ItemObservation } from '@/domain/plan/doctor-plan.js';
import { classifyStatus } from '@/domain/plan/status-plan.js';
import { localBinRelativePaths } from '@/domain/scripts-run.js';
import type { AgentTarget, Scope } from '@/ports/agent-target.js';
import type { CatalogIssue, CatalogSource, LoadedCatalog } from '@/ports/catalog-source.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';
import { desiredFor, observeInstalled } from './installed-state.js';
import { loadManifest } from './journal.js';

export interface DoctorDeps {
  source: CatalogSource;
  fs: FileSystem;
  target: AgentTarget;
  paths: Paths;
  /** Process environment, injected. Only used to check whether required variables are set; values are never reported. */
  env: Record<string, string | undefined>;
  /** Defaults to the host platform; controls which `.bin` shim names are probed. */
  platform?: string;
}

export interface DoctorReport {
  target: AgentTarget['id'];
  catalog: 'available' | 'unavailable';
  issues: CatalogIssue[];
  findings: Finding[];
}

async function readScriptTools(
  fs: FileSystem,
  scriptRoot: string,
  cwd: string,
  platform: string,
): Promise<{ tool: string; localBinPresent: boolean }[]> {
  const text = await fs.readText(`${scriptRoot}/script.json`);
  if (text === null) return [];
  let tools: unknown;
  try {
    tools = (JSON.parse(text) as { tools?: unknown } | null)?.tools;
  } catch {
    return [];
  }
  if (!Array.isArray(tools)) return [];
  const result: { tool: string; localBinPresent: boolean }[] = [];
  for (const tool of tools) {
    if (typeof tool !== 'string' || tool === '') continue;
    let localBinPresent = false;
    for (const rel of localBinRelativePaths(tool, platform)) {
      if (await fs.exists(`${cwd}/${rel}`)) {
        localBinPresent = true;
        break;
      }
    }
    result.push({ tool, localBinPresent });
  }
  return result;
}

/** Checks everything shitaku owns for problems and drift. Problems never depend on the catalog. Never writes. */
export async function getDiagnosis(deps: DoctorDeps, req: { scope?: Scope }): Promise<DoctorReport> {
  const manifest = await loadManifest(deps.fs, deps.paths.homeDir);
  const owned = deriveOwnedItems(manifest);
  const platform = deps.platform ?? 'linux';

  let catalog: LoadedCatalog | null = null;
  try {
    catalog = await deps.source.load();
  } catch {
    // Without the catalog only the informational `out-of-date` finding is lost.
  }

  const observe = observeInstalled(deps);
  const observations: ItemObservation[] = [];
  for (const item of owned) {
    const { config, current, entry } = await observe(item);
    const observation: ItemObservation = {
      item,
      config,
      current,
      ...(entry === undefined ? {} : { entry }),
      state: classifyStatus(item.hash, current, desiredFor(catalog, deps.target, item)),
    };
    if (item.kind === 'script' && config === 'present' && current.kind !== 'absent') {
      observation.scriptTools = await readScriptTools(deps.fs, item.path, deps.paths.cwd, platform);
    }
    observations.push(observation);
  }

  // Every scope is observed so a project entry can be compared with user scope; the filter applies to the findings.
  const { findings } = diagnose({
    observations,
    env: deps.env,
    projectConfigPath: deps.target.configPath('project', deps.paths),
  });

  return {
    target: deps.target.id,
    catalog: catalog === null ? 'unavailable' : 'available',
    issues: catalog?.issues ?? [],
    findings: findings.filter((f) => req.scope === undefined || f.scope === req.scope),
  };
}
