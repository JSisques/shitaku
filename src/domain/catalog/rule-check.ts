import { z } from 'zod';
import { parseGlob } from '@/domain/checks/glob.js';
import { validatePattern } from '@/domain/checks/safe-regex.js';

export const MAX_GLOBS = 32;
export const MAX_SECTIONS = 32;
export const MAX_SECTION_LENGTH = 120;
export const MAX_ARGS = 32;

export const SeveritySchema = z.enum(['error', 'warn']);
export type Severity = z.infer<typeof SeveritySchema>;

/** The mapping reader yields a scalar or a list; both become a list so errors point at `files.0`, not a union. */
const toList = (value: unknown): unknown => (typeof value === 'string' ? [value] : value);

const Glob = z.string().superRefine((source, ctx) => {
  const parsed = parseGlob(source);
  if ('issue' in parsed) ctx.addIssue({ code: 'custom', message: parsed.issue });
});
const Globs = z.preprocess(toList, z.array(Glob).min(1).max(MAX_GLOBS));
const Section = z.string().trim().min(1).max(MAX_SECTION_LENGTH);
const Sections = z.preprocess(toList, z.array(Section).min(1).max(MAX_SECTIONS));
const Args = z.preprocess(toList, z.array(z.string()).max(MAX_ARGS));
const PositiveInt = z
  .string()
  .regex(/^[1-9][0-9]{0,6}$/, { error: 'max must be a positive integer of 1 to 7 digits' })
  .transform(Number);
const Bool = z.enum(['true', 'false']).transform((value) => value === 'true');
const Pattern = z.string().superRefine((source, ctx) => {
  const issue = validatePattern(source);
  if (issue !== undefined) ctx.addIssue({ code: 'custom', message: issue });
});

export const RuleCheckSchema = z.discriminatedUnion(
  'type',
  [
    z.strictObject({ type: z.literal('file-exists'), path: Glob, each: Glob.optional() }),
    z.strictObject({
      type: z.literal('contains-sections'),
      files: Globs,
      exclude: Globs.optional(),
      sections: Sections,
    }),
    z.strictObject({
      type: z.literal('pattern-absent'),
      files: Globs,
      exclude: Globs.optional(),
      pattern: Pattern,
      'ignore-case': Bool.optional(),
      message: z.string().trim().min(1).max(200).optional(),
    }),
    z.strictObject({ type: z.literal('max-lines'), files: Globs, exclude: Globs.optional(), max: PositiveInt }),
    z.strictObject({
      type: z.literal('tool'),
      tool: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, { error: 'tool must be a bare executable name' }),
      args: Args.optional(),
    }),
  ],
  { error: 'type must be one of file-exists, contains-sections, pattern-absent, max-lines, tool' },
);
export type RuleCheck = z.output<typeof RuleCheckSchema>;

/** First zod issue as `invalid check: <dotted.path>: <message>`; an unknown key is named in the path. */
export function formatCheckIssue(error: z.ZodError): string {
  const first = error.issues[0];
  if (first === undefined) return 'invalid check: invalid input';
  const path = first.code === 'unrecognized_keys' ? [...first.path, ...first.keys.slice(0, 1)] : first.path;
  return `invalid check: ${path.map(String).join('.')}: ${first.message}`;
}
