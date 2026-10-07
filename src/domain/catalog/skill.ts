import { z } from 'zod';
import { readFrontmatter } from '@/domain/catalog/frontmatter.js';

// The custom message names the offending value, which zod's default regex message omits.
export const SkillNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, { error: (iss) => `invalid skill name '${String(iss.input)}'` });

/** One file of a skill. `path` is POSIX and relative to the skill root. */
export interface SkillFile {
  path: string;
  bytes: Uint8Array;
}

export interface SkillItem {
  name: string;
  description: string;
  files: SkillFile[];
}

/** An issue may carry `file`: the path, relative to the skill directory, of the file the problem lives in. */
export type SkillIssue = { issue: string; file?: string };
export type SkillParseResult = { skill: SkillItem } | SkillIssue;

const SKILL_FILE = 'SKILL.md';
const ScalarSchema = z.object({ name: SkillNameSchema, description: z.string().min(1) });

/** Validates a skill directory's files against its frontmatter and directory name. */
export function parseSkill(dirName: string, files: readonly SkillFile[]): SkillParseResult {
  if (!SkillNameSchema.safeParse(dirName).success) return { issue: `invalid skill directory name '${dirName}'` };
  const entry = files.find((f) => f.path === SKILL_FILE);
  if (!entry) return { issue: `missing ${SKILL_FILE}` };
  const front = readFrontmatter(new TextDecoder().decode(entry.bytes), SKILL_FILE);
  if ('issue' in front) return front;
  const parsed = ScalarSchema.safeParse(front.data);
  if (!parsed.success) {
    return { issue: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), file: SKILL_FILE };
  }
  if (parsed.data.name !== dirName) {
    return { issue: `name '${parsed.data.name}' does not match directory '${dirName}'` };
  }
  return { skill: { name: parsed.data.name, description: parsed.data.description, files: [...files] } };
}
