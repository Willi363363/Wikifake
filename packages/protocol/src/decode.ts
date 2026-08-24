// Every message and every payload enters through here.
//
// Callers get a result, not an exception: an invalid WebSocket frame is an
// ordinary event — a client one version behind, a hand-crafted frame — and it
// must produce an error code, never a stack trace. Zod's own error shape stays
// inside this file, so a Zod upgrade cannot ripple through the codebase.
import type { ZodType } from 'zod';

export type Decoded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates an unknown input against a schema.
 *
 * Issues name the offending path and the reason, never the value: a payload
 * can carry a session token, and this text ends up in logs.
 */
export function decode<T>(schema: ZodType<T>, input: unknown): Decoded<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    ),
  };
}
