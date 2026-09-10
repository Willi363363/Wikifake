// What the account routes need, built once and lazily.
//
// Lazily for the reason `auth()` is: building it validates the whole
// environment and opens a connection, so at module load, importing either route
// would depend on a reachable database.
import { auth } from '../auth/auth.js';
import { db } from '../game/wiring.js';
import { deletedPlayerName, type AccountDataContext } from './data.js';
import type { RegionContext } from './region.js';

export function accountDataContext(): AccountDataContext {
  return { auth: auth(), db: db(), placeholder: deletedPlayerName };
}

/** G.1 — recording a region needs who is asking and one column to write. */
export function regionContext(): RegionContext {
  return { auth: auth(), db: db() };
}
