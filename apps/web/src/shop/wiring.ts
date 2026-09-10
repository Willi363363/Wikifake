// What the shop routes need, built once and lazily.
//
// Lazily for the reason `auth()` is: building it validates the whole environment
// and opens a connection, so at module load, importing the route would depend on
// a reachable database.
import { auth } from '../auth/auth.js';
import { db } from '../game/wiring.js';
import type { ShopContext } from './buy.js';

export function shopContext(): ShopContext {
  return { auth: auth(), db: db() };
}
