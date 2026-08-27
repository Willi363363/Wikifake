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
  /**
   * `Set-Cookie` values, which repeat rather than merge.
   *
   * Separate from `headers` because a record cannot hold two of them, and a
   * sign-in that sets a session cookie and a session-data cookie sends two. The
   * one that got merged away is the one the browser never keeps.
   */
  readonly setCookies?: readonly string[];
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
  const headers = new Headers({ 'content-type': 'application/json', ...options.headers });
  for (const cookie of options.setCookies ?? []) headers.append('set-cookie', cookie);

  return new Response(JSON.stringify(schema.parse(value)), {
    status: options.status ?? 200,
    headers,
  });
}
