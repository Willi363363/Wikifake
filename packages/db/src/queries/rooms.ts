// C5.6 — rooms: a unique code, and a cap on how many are open.
//
// The rooms are rows now, not entries in a dictionary that vanishes with the
// last player. That changes what "open" means, and the cap with it: counting
// every room ever created would turn a memory guard into a permanent one — the
// two-hundredth room ever opened would be the last.
//
// So the count is bounded by activity, and the bound comes from the caller.
// Deciding *when* a room stops being open is phase 5's — it reaps the idle ones
// (D4) — and this query only has to be able to ask.
import { count, eq, gt } from 'drizzle-orm';

import type { Database } from '../client.js';
import { room } from '../schema/game.js';

type Db = Database['db'];

/** How many rooms have been touched since `since`. */
export function selectOpenRoomCount(db: Db, since: Date) {
  return db.select({ open: count() }).from(room).where(gt(room.updatedAt, since));
}

/**
 * Opens a room. Returns false when the code is already taken.
 *
 * `onConflictDoNothing` rather than a lookup then an insert: two requests
 * drawing the same code a microsecond apart would both find it free. The primary
 * key is what makes the code unique, and this reports the collision so the
 * caller can draw again — a collision silently overwriting a room in play is
 * what the current `_new_code` loop exists to prevent, and it prevents it with a
 * check that a second process defeats.
 */
export async function insertRoom(
  db: Db,
  newRoom: { readonly code: string; readonly timeLimit: number },
): Promise<boolean> {
  const written = await db
    .insert(room)
    .values(newRoom)
    .onConflictDoNothing()
    .returning({ code: room.code });
  return written.length > 0;
}

/** A room as it stands. What phase 5 hands to whoever joins it. */
export function selectRoom(db: Db, code: string) {
  return db
    .select({
      code: room.code,
      hostName: room.hostName,
      phase: room.phase,
      withItems: room.withItems,
      timeLimit: room.timeLimit,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    })
    .from(room)
    .where(eq(room.code, code));
}
