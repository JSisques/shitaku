import type { Dirent } from 'node:fs';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import { readFileNoFollow, readTree } from '@/adapters/fs/walk.js';
import { resolveProfile } from '@/domain/catalog/profile.js';
import { CatalogIndexSchema, McpItemSchema, ProfileSchema } from '@/domain/catalog/schema.js';
import type { McpItem, Profile } from '@/domain/catalog/schema.js';
import { parseCommand, type CommandItem } from '@/domain/catalog/command.js';
import { HookItemSchema, type HookItem } from '@/domain/catalog/hook.js';
import { parseSkill, type SkillItem } from '@/domain/catalog/skill.js';
import { parseScript, type ScriptItem } from '@/domain/catalog/script.js';
import type { CatalogIssue, CatalogSource, LoadedCatalog, SourceRef } from '@/ports/catalog-source.js';

/** Reads a catalog folder. The bundled catalog is just a folder resolved by the composition root. */
export class FolderCatalogSource implements CatalogSource {
  constructor(
    private readonly location: string,
    private readonly kind: SourceRef['kind'],
  ) {}

  ref(): SourceRef {
    return { kind: this.kind, location: this.location };
  }

  async load(): Promise<LoadedCatalog> {
    const issues: CatalogIssue[] = [];
    const index = await this.readIndex();

    const readEntries = async <T extends { name: string }>(
      dir: string,
      names: string[],
      schema: ZodType<T>,
    ): Promise<T[]> => {
      const found: T[] = [];
      for (const name of names) {
        const file = `${dir}/${name}.json`;
        try {
          const parsed = schema.safeParse(JSON.parse(await readFile(join(this.location, file), 'utf8')));
          if (!parsed.success) {
            const reason = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
            issues.push({ file, reason });
          } else if (parsed.data.name !== name) {
            issues.push({ file, reason: `name '${parsed.data.name}' does not match file name '${name}'` });
          } else {
            found.push(parsed.data);
          }
        } catch (e) {
          issues.push({ file, reason: e instanceof Error ? e.message : String(e) });
        }
      }
      return found;
    };

    const mcps: McpItem[] = await readEntries('mcps', index.items.mcps, McpItemSchema);
    const candidates: Profile[] = await readEntries('profiles', index.items.profiles, ProfileSchema);
    const skills = await this.loadSkills(index.items.skills, issues);
    const scripts = await this.loadScripts(index.items.scripts, issues);
    const commands = await this.loadCommands(index.items.commands, issues);
    const hooks = await this.loadHooks(index.items.hooks, issues);
    const mcpNames = mcps.map((m) => m.name);
    const skillNames = skills.map((sk) => sk.name);
    const scriptNames = scripts.map((sc) => sc.name);
    const commandNames = commands.map((c) => c.name);
    const hookNames = hooks.map((h) => h.name);
    const profiles = candidates.filter((p) => {
      try {
        resolveProfile(p.name, candidates, mcpNames, skillNames, scriptNames, commandNames, hookNames);
        return true;
      } catch (e) {
        issues.push({ file: `profiles/${p.name}.json`, reason: e instanceof Error ? e.message : String(e) });
        return false;
      }
    });

    return { mcps, skills, scripts, commands, hooks, profiles, issues };
  }

  /** Loads each listed skill as bytes. A bad skill is skipped with an issue; an unlisted directory is an issue too. */
  private async loadSkills(listed: readonly string[], issues: CatalogIssue[]): Promise<SkillItem[]> {
    const skills: SkillItem[] = [];
    const skillsRoot = join(await realpath(this.location), 'skills');
    for (const name of listed) {
      const file = `skills/${name}`;
      try {
        const files = await readTree(join(this.location, file), join(skillsRoot, name));
        const parsed =
          files === null ? { issue: 'listed in catalog.json but the directory is missing' } : parseSkill(name, files);
        if ('issue' in parsed)
          issues.push({ file: parsed.file ? `${file}/${parsed.file}` : file, reason: parsed.issue });
        else skills.push(parsed.skill);
      } catch (e) {
        issues.push({ file, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    await this.flagUnlisted('skills', listed, issues, (d) => (d.isDirectory() ? d.name : null));
    return skills;
  }

  /** Loads each listed script as bytes. A bad script is skipped with an issue; an unlisted directory is an issue too. */
  private async loadScripts(listed: readonly string[], issues: CatalogIssue[]): Promise<ScriptItem[]> {
    const scripts: ScriptItem[] = [];
    const scriptsRoot = join(await realpath(this.location), 'scripts');
    for (const name of listed) {
      const file = `scripts/${name}`;
      try {
        const files = await readTree(join(this.location, file), join(scriptsRoot, name));
        const parsed =
          files === null ? { issue: 'listed in catalog.json but the directory is missing' } : parseScript(name, files);
        if ('issue' in parsed)
          issues.push({ file: parsed.file ? `${file}/${parsed.file}` : file, reason: parsed.issue });
        else scripts.push(parsed.script);
      } catch (e) {
        issues.push({ file, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    await this.flagUnlisted('scripts', listed, issues, (d) => (d.isDirectory() ? d.name : null));
    return scripts;
  }

  /** Loads each listed command as one file. A bad command is skipped with an issue; an unlisted `*.md` is an issue too. */
  private loadCommands(listed: readonly string[], issues: CatalogIssue[]): Promise<CommandItem[]> {
    return this.loadFileItems<CommandItem>('commands', '.md', listed, issues, (name, bytes) => {
      const parsed = parseCommand(name, bytes);
      return 'issue' in parsed ? parsed : { item: parsed.command };
    });
  }

  /** Loads each listed hook as one JSON file. A bad hook is skipped with an issue; an unlisted `*.json` is an issue too. */
  private loadHooks(listed: readonly string[], issues: CatalogIssue[]): Promise<HookItem[]> {
    return this.loadFileItems<HookItem>('hooks', '.json', listed, issues, (name, bytes) => {
      const parsed = HookItemSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
      if (!parsed.success) {
        return { issue: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ') };
      }
      if (parsed.data.name !== name) {
        return { issue: `name '${parsed.data.name}' does not match file name '${name}'` };
      }
      return { item: parsed.data };
    });
  }

  /**
   * Loads items stored as one `<dir>/<name><suffix>` file each. A bad item is skipped with an issue, and so is an
   * unlisted file. Reads refuse symlinks, and a symlinked `dir` would redirect every read outside the catalog.
   */
  private async loadFileItems<T>(
    dir: string,
    suffix: string,
    listed: readonly string[],
    issues: CatalogIssue[],
    parse: (name: string, bytes: Uint8Array) => { item: T } | { issue: string },
  ): Promise<T[]> {
    const items: T[] = [];
    const expectedDir = join(await realpath(this.location), dir);
    const realDir = await realpath(join(this.location, dir)).catch(() => expectedDir);
    for (const name of listed) {
      const file = `${dir}/${name}${suffix}`;
      try {
        if (realDir !== expectedDir) throw new Error(`${dir} directory resolves outside ${expectedDir}`);
        const bytes = await readFileNoFollow(join(this.location, file), file);
        const parsed =
          bytes === null ? { issue: 'listed in catalog.json but the file is missing' } : parse(name, bytes);
        if ('item' in parsed) items.push(parsed.item);
        else issues.push({ file, reason: parsed.issue });
      } catch (e) {
        issues.push({ file, reason: e instanceof Error ? e.message : String(e) });
      }
    }
    await this.flagUnlisted(
      dir,
      listed,
      issues,
      (d) => (d.isFile() && d.name.endsWith(suffix) ? d.name.slice(0, -suffix.length) : null),
      suffix,
    );
    return items;
  }

  /** Reports every entry of `dir` that `itemName` recognizes as an item but `catalog.json` does not list. `suffix` is the item's file extension, if any. */
  private async flagUnlisted(
    dir: string,
    listed: readonly string[],
    issues: CatalogIssue[],
    itemName: (entry: Dirent) => string | null,
    suffix = '',
  ): Promise<void> {
    const present = await readdir(join(this.location, dir), { withFileTypes: true }).catch(() => []);
    const names = present
      .flatMap((d) => {
        const name = itemName(d);
        return name === null ? [] : [{ name, file: `${dir}/${name}${suffix}` }];
      })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const { name, file } of names) {
      if (!listed.includes(name)) issues.push({ file, reason: 'not listed in catalog.json' });
    }
  }

  private async readIndex(): Promise<ReturnType<typeof CatalogIndexSchema.parse>> {
    const file = join(this.location, 'catalog.json');
    let raw: string;
    try {
      raw = await readFile(file, 'utf8');
    } catch {
      throw new Error(`catalog source not found: cannot read ${file}`);
    }
    const parsed = CatalogIndexSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error(`invalid catalog.json in ${this.location}: ${parsed.error.message}`);
    return parsed.data;
  }
}
