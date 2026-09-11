// What the account routes need, built once and lazily.
//
// Lazily for the reason `auth()` is: building it validates the whole
// environment and opens a connection, so at module load, importing either route
// would depend on a reachable database.
import { auth } from '../auth/auth.js';
import { db } from '../game/wiring.js';
import { deletedPlayerName, type AccountDataContext } from './data.js';
import type { CosmeticsContext } from './cosmetics.js';
import type { RegionContext } from './region.js';

export function accountDataContext(): AccountDataContext {
  return { auth: auth(), db: db(), placeholder: deletedPlayerName };
}

/** G.1 — recording a region needs who is asking and one column to write. */
export function regionContext(): RegionContext {
  return { auth: auth(), db: db() };
}

/**
 * H.6 — wearing a cosmetic needs who is asking, the ledger and one column.
 *
 * The same two things as the region: the catalogue and the wearing rules are
 * `@wikifake/domain`'s and are imported directly, because a rule is not a
 * dependency to inject — there is one catalogue and a test would want the real
 * one.
 */
export function cosmeticsContext(): CosmeticsContext {
  return { auth: auth(), db: db() };
}
