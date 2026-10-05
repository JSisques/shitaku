import { z } from 'zod';
import { ScriptNameSchema, type ScriptItem } from '@/domain/catalog/script.js';
import { SkillNameSchema, type SkillItem } from '@/domain/catalog/skill.js';
import { extractPlaceholders, hasPlaceholder } from '@/domain/placeholders.js';

const VarName = /^[A-Z_][A-Z0-9_]*$/;

const EnvRef = z.object({
  name: z.string().regex(VarName),
  required: z.boolean().default(true),
  description: z.string().optional(),
});

// Header and env values must reference ${VAR}: a literal there is treated as a secret.
const Templated = z.string().refine(hasPlaceholder, 'must reference ${VAR}, literal values are not allowed');

const Server = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stdio'),
    command: z.string(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), Templated).optional(),
  }),
  z.object({
    type: z.enum(['http', 'sse']),
    url: z.url(),
    headers: z.record(z.string(), Templated).optional(),
  }),
]);

type ServerValue = z.infer<typeof Server>;

function templatedValues(server: ServerValue): { values: string[]; headers: string[] } {
  if (server.type === 'stdio') return { values: [...server.args, ...Object.values(server.env ?? {})], headers: [] };
  const headers = Object.values(server.headers ?? {});
  return { values: [server.url, ...headers], headers };
}

export const McpItemSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    description: z.string(),
    server: Server,
    env: z.array(EnvRef).default([]),
    targets: z.array(z.string()).optional(),
  })
  .superRefine((item, ctx) => {
    const declared = new Set(item.env.map((e) => e.name));
    const { values, headers } = templatedValues(item.server);
    for (const p of values.flatMap(extractPlaceholders)) {
      if (!declared.has(p.name)) {
        ctx.addIssue({ code: 'custom', path: ['env'], message: `placeholder \${${p.name}} is not declared in env` });
      }
    }
    if (headers.flatMap(extractPlaceholders).some((p) => p.hasDefault)) {
      ctx.addIssue({ code: 'custom', path: ['server', 'headers'], message: 'defaults are not allowed in headers' });
    }
  });

export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  extends: z.array(z.string()).default([]),
  mcps: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  scripts: z.array(z.string()).default([]),
});

export const CatalogIndexSchema = z.object({
  version: z.literal(1),
  items: z.looseObject({
    mcps: z.array(z.string()),
    profiles: z.array(z.string()).default([]),
    skills: z.array(SkillNameSchema).default([]),
    scripts: z.array(ScriptNameSchema).default([]),
  }),
});

export type McpItem = z.infer<typeof McpItemSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type CatalogIndex = z.infer<typeof CatalogIndexSchema>;

export interface Catalog {
  mcps: McpItem[];
  skills: SkillItem[];
  scripts: ScriptItem[];
  profiles: Profile[];
}
