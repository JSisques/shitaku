import { emptyManifest, parseManifest, type Install, type Manifest } from '@/domain/manifest.js';
import { projectScriptsRoot, userScriptsRoot } from '@/domain/scripts-paths.js';
import type { Scope } from '@/ports/agent-target.js';
import type { FileSystem } from '@/ports/file-system.js';
import type { Paths } from '@/ports/paths.js';

/** Where shitaku keeps its manifest and backups; one location for both scopes. */
export const stateDir = (homeDir: string): string => `${homeDir}/.claude/.shitaku`;
export const manifestPath = (homeDir: string): string => `${stateDir(homeDir)}/manifest.json`;

/** Shitaku-owned scripts root for the requested scope — never AgentTarget.skillsDir. */
export function scriptsDir(scope: Scope, paths: Paths): string {
  return scope === 'project' ? projectScriptsRoot(paths.cwd) : userScriptsRoot(stateDir(paths.homeDir));
}

/** An absent manifest means nothing was installed yet; a corrupt one throws and is never replaced. */
export async function loadManifest(fs: FileSystem, homeDir: string): Promise<Manifest> {
  const text = await fs.readText(manifestPath(homeDir));
  return text === null ? emptyManifest() : parseManifest(text);
}

export async function saveManifest(fs: FileSystem, homeDir: string, manifest: Manifest): Promise<void> {
  await fs.writeAtomic(manifestPath(homeDir), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function appendInstall(fs: FileSystem, homeDir: string, install: Install): Promise<void> {
  const manifest = await loadManifest(fs, homeDir);
  await saveManifest(fs, homeDir, { ...manifest, installs: [...manifest.installs, install] });
}
