// What Postgres said went wrong, read off an error that has been wrapped.
//
// Here rather than beside either caller, because there were about to be three
// copies: `testing/database.ts` walks this chain to assert a class, and
// `queries/profile.ts` walks it to turn one class into a refusal. A helper
// duplicated per caller is a helper that stops agreeing with itself the day
// Drizzle adds a wrapper.

/**
 * The error classes this package names, by SQLSTATE.
 *
 * Asserted on rather than the message: `postgres.js` reports "Failed query: …"
 * and keeps the class in a property, so matching the text would pass for any
 * failure at all — including a typo in the query.
 */
export const SQLSTATE = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  notNullViolation: '23502',
  checkViolation: '23514',
} as const;

/**
 * The SQLSTATE a failure carries, or undefined when it carries none.
 *
 * Drizzle wraps the driver's error in its own, so the class sits one or more
 * `cause` links down. Walking the chain rather than reading the top error is
 * what makes this survive a Drizzle upgrade that adds another wrapper.
 */
export function sqlstate(error: unknown): string | undefined {
  let current: unknown = error;
  while (typeof current === 'object' && current !== null) {
    if ('code' in current && typeof (current as { code: unknown }).code === 'string') {
      return (current as { code: string }).code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** The SQLSTATE a query failed with, or null if it succeeded. */
export async function rejectionCode(work: Promise<unknown>): Promise<string | null> {
  try {
    await work;
    return null;
  } catch (error) {
    return sqlstate(error) ?? `no SQLSTATE in: ${String(error)}`;
  }
}
