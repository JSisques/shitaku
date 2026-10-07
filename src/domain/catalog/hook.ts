import { z } from 'zod';

// The custom message names the offending value, which zod's default regex message omits.
export const HookNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, { error: (iss) => `invalid hook name '${String(iss.input)}'` });

// Well-known credential shapes; a match anywhere in the text is a literal secret.
const TOKEN_SHAPES: readonly RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bglpat-[A-Za-z0-9_-]{16,}/,
  /\bnpm_[A-Za-z0-9]{30,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
];
// `KEY=value` where the name looks like a credential and the value is not a variable reference.
const SECRET_ASSIGNMENT = /\b[A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY)[A-Za-z0-9_]*=["']?([^\s"']+)/i;
const BEARER = /\bBearer\s+["']?([^\s"']+)/i;

const isReference = (value: string): boolean => value.startsWith('$');

/** True when the text carries a credential-shaped literal. `${VAR}` and `$VAR` references are never secrets. */
export function hasLiteralSecret(text: string): boolean {
  if (TOKEN_SHAPES.some((shape) => shape.test(text))) return true;
  return [SECRET_ASSIGNMENT, BEARER].some((pattern) => {
    const value = pattern.exec(text)?.[1];
    return value !== undefined && !isReference(value);
  });
}

const noSecret = (field: string) => ({ error: `${field} contains a literal secret` });

/** A Claude Code `command` hook: one handler, written under `hooks.<event>` of a settings file. */
export const HookItemSchema = z.strictObject({
  name: HookNameSchema,
  description: z.string().trim().min(1),
  event: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/, { error: 'event must be a hook event name' }),
  matcher: z
    .string()
    .refine((v) => !hasLiteralSecret(v), noSecret('matcher'))
    .optional(),
  type: z.literal('command').optional(),
  command: z
    .string()
    .refine((v) => v.trim() !== '', { error: 'command must not be empty' })
    .refine((v) => !hasLiteralSecret(v), noSecret('command')),
  timeout: z.number().positive().optional(),
});

export type HookItem = z.infer<typeof HookItemSchema>;
