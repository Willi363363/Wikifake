// What `POST /api/daily/start` needs — step N.7.
//
// Its own file rather than another function in `game/wiring.ts`, for that
// file's own reason: building any of these validates the environment and opens
// a connection, and the daily round needs no cache — the day's article is stored
// in a row, which is the opposite of what a six-hour Redis cache is for.
import { loadEnv } from '@wikifake/env';

import { handleDailyStart as handle, type DailyStartContext } from './start.js';
import { auth } from '../auth/auth.js';
import { languageModel } from '../game/model.js';
import { db } from '../game/wiring.js';
import { networkTransport, wikiRequest } from '../game/wikipedia.js';

let dependencies: DailyStartContext['daily'] | undefined;

/**
 * The collaborators the day's article needs, built once.
 *
 * Exported since N.4: the cron needs exactly these and no `auth` — a scheduler
 * has no session — so a second builder would be this function with one field
 * dropped.
 */
export function dailyDependencies(): DailyStartContext['daily'] {
  if (dependencies === undefined) {
    const env = loadEnv();
    dependencies = {
      db: db(),
      model: languageModel(env),
      wiki: wikiRequest(env.BETTER_AUTH_URL, env.WIKIPEDIA_API_URL),
      transport: networkTransport,
      // The same draw `startContext` makes: the day's fakes are not in the
      // places the last article's were.
      seed: () => Math.floor(Math.random() * 0xffff_ffff),
    };
  }

  return dependencies;
}

export function dailyStartContext(): DailyStartContext {
  return { auth: auth(), daily: dailyDependencies(), now: () => Date.now() };
}

/** The route's one line, so the route file imports one thing rather than two. */
export function handleDailyStart(request: Request): Promise<Response> {
  return handle(dailyStartContext(), request);
}
