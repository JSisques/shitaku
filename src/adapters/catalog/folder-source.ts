import { readdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import type { ZodType } from 'zod';
import { readTree } from '@/adapters/fs/walk.js';
import { resolveProfile } from '@/domain/catalog/profile.js';
import { CatalogIndexSchema, McpItemSchema, ProfileSchema } from '@/domain/catalog/schema.js';
import type { McpItem, Profile } from '@/domain/catalog/schema.js';
import { parseSkill, type SkillItem } from '@/domain/catalog/skill.js';
import type { ScriptItem } from '@/domain/catalog/script.js';
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
    const scripts: ScriptItem[] = [];
    const mcpNames = mcps.map((m) => m.name);
    const skillNames = skills.map((sk) => sk.name);
    const scriptNames = scripts.map((sc) => sc.name);
    const profiles = candidates.filter((p) => {
      try {
        resolveProfile(p.name, candidates, mcpNames, skillNames, scriptNames);
        return true;
      } catch (e) {
        issues.push({ file: `profiles/${p.name}.json`, reason: e instanceof Error ? e.message : String(e) });
        return false;
      }
    });

    return { mcps, skills, scripts, profiles, issues };
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
    const present = await readdir(join(this.location, 'skills'), { withFileTypes: true }).catch(() => []);
    for (const name of present
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()) {
      if (!listed.includes(name)) issues.push({ file: `skills/${name}`, reason: 'not listed in catalog.json' });
    }
    return skills;
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
