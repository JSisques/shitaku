import { z } from 'zod';
import { readFrontmatter } from '@/domain/catalog/frontmatter.js';

// The custom message names the offending value, which zod's default regex message omits.
export const CommandNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, { error: (iss) => `invalid command name '${String(iss.input)}'` });

/** A slash command: one markdown file. `bytes` are the exact file bytes, so every frontmatter key reaches the target. */
export interface CommandItem {
  name: string;
  description: string;
  bytes: Uint8Array;
}

export type CommandIssue = { issue: string };
export type CommandParseResult = { command: CommandItem } | CommandIssue;

const DescriptionSchema = z.object({ description: z.string().trim().min(1) });

/** Validates a command file against its name (the file stem). Other frontmatter keys pass through untouched. */
export function parseCommand(name: string, bytes: Uint8Array): CommandParseResult {
  if (!CommandNameSchema.safeParse(name).success) return { issue: `invalid command name '${name}'` };
  const front = readFrontmatter(new TextDecoder().decode(bytes), `${name}.md`);
  if ('issue' in front) return { issue: front.issue };
  const parsed = DescriptionSchema.safeParse(front.data);
  if (!parsed.success) {
    return { issue: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  if (front.body.trim() === '') return { issue: 'command body is empty' };
  return { command: { name, description: parsed.data.description, bytes } };
}
