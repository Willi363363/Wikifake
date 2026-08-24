// Every response leaves through its contract.
//
// Not decoration: Zod strips what a schema does not declare, so a handler that
// accidentally spreads the solution into a payload loses it here rather than in a
// player's DevTools console. C1.1 is enforced by the encoder, not by the care of
// whoever writes the next handler.
import type { ZodType } from 'zod';

export interface JsonOptions {
  readonly status?: number;
  readonly headers?: Record<string, string>;
}

/**
 * Encodes `value` through `schema` and answers with it.
 *
 * A value the schema refuses throws, which turns a contract break into a 500 in
 * a test rather than a silently malformed payload in production.
 */
export function json<T>(
  schema: ZodType<T>,
  value: T,
  options: JsonOptions = {},
): Response {
  return new Response(JSON.stringify(schema.parse(value)), {
    status: options.status ?? 200,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
}
