// Reading an account.
//
// Exported rather than left to the caller, because phase 2's exit gate says no
// free-form SQL outside this package: `apps/web` gets the ORM nowhere, so every
// read it needs has a name here.
import { eq } from 'drizzle-orm';

import type { Database } from '../client.js';
import { user } from '../schema/auth.js';

type Db = Database['db'];

/** One account, or nothing. Includes whether it is still a guest identity. */
export function selectUserById(db: Db, userId: string) {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      /** 4.3 — true while they are playing as a guest, gone once they sign up. */
      isAnonymous: user.isAnonymous,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId));
}
