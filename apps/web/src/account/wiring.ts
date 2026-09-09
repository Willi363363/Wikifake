// What the two account-data routes need, built once and lazily.
//
// Lazily for the reason `auth()` is: building it validates the whole
// environment and opens a connection, so at module load, importing either route
// would depend on a reachable database.
import { auth } from '../auth/auth.js';
import { db } from '../game/wiring.js';
import { deletedPlayerName, type AccountDataContext } from './data.js';

export function accountDataContext(): AccountDataContext {
  return { auth: auth(), db: db(), placeholder: deletedPlayerName };
}
