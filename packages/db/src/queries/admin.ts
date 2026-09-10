// Whether this account may read the panel — step I.1.
//
// One function, and it is a read. Track I is read-only, so there is nothing here
// that grants or revokes: `schema/admin.ts` carries the statement a person runs.
import { eq } from 'drizzle-orm';

import type { Database } from '../client.js';
import { admin } from '../schema/admin.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/**
 * Whether this account is an admin.
 *
 * A lookup on the primary key, which is the cheapest read there is — and it
 * happens on every admin page load, because the answer is never cached. A stale
 * *yes* in a cookie is a way in that outlives the row being deleted, and what
 * caching would save is one index hit.
 *
 * `false` for an account that does not exist, rather than an error: the caller
 * is a route deciding whether to answer 404, and *there is nobody here* and
 * *this is not an admin* deserve the same answer.
 */
export async function isAdmin(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: admin.userId })
    .from(admin)
    .where(eq(admin.userId, userId))
    .limit(1);

  return rows.length > 0;
}
