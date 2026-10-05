import { z } from 'zod';

// The custom message names the offending value, which zod's default regex message omits.
export const ScriptNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, { error: (iss) => `invalid script name '${String(iss.input)}'` });

/** One file of a script. `path` is POSIX and relative to the script root. */
export interface ScriptFile {
  path: string;
  bytes: Uint8Array;
}

export interface ScriptItem {
  name: string;
  description: string;
  tools: string[];
  args?: string[];
  output?: string;
  exitCodes?: Record<string, string>;
  files: ScriptFile[];
}

/** An issue may carry `file`: the path, relative to the script directory, of the file the problem lives in. */
export type ScriptIssue = { issue: string; file?: string };
export type ScriptParseResult = { script: ScriptItem } | ScriptIssue;

const SCRIPT_META = 'script.json';
const SCRIPT_ENTRY = 'index.mjs';

export const ScriptMetaSchema = z.object({
  name: ScriptNameSchema,
  description: z.string().min(1),
  tools: z.array(z.string().min(1)).default([]),
  args: z.array(z.string()).optional(),
  output: z.string().optional(),
  exitCodes: z.record(z.string(), z.string()).optional(),
});

/** Validates a script directory's files against its script.json and directory name. */
export function parseScript(dirName: string, files: readonly ScriptFile[]): ScriptParseResult {
  if (!ScriptNameSchema.safeParse(dirName).success) return { issue: `invalid script directory name '${dirName}'` };
  const metaEntry = files.find((f) => f.path === SCRIPT_META);
  if (!metaEntry) return { issue: `missing ${SCRIPT_META}` };
  if (!files.some((f) => f.path === SCRIPT_ENTRY)) return { issue: `missing ${SCRIPT_ENTRY}` };

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(metaEntry.bytes));
  } catch (e) {
    return { issue: e instanceof Error ? e.message : String(e), file: SCRIPT_META };
  }

  const parsed = ScriptMetaSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      issue: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      file: SCRIPT_META,
    };
  }
  if (parsed.data.name !== dirName) {
    return { issue: `name '${parsed.data.name}' does not match directory '${dirName}'` };
  }

  const { name, description, tools, args, output, exitCodes } = parsed.data;
  return {
    script: {
      name,
      description,
      tools,
      ...(args === undefined ? {} : { args }),
      ...(output === undefined ? {} : { output }),
      ...(exitCodes === undefined ? {} : { exitCodes }),
      files: [...files],
    },
  };
}
