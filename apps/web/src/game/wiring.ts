// The collaborators a route needs, built once and lazily.
//
// Lazily for the reason `auth()` is: building this validates the whole
// environment and opens a database connection, so at module load, importing any
// route under `app/api/game/` — including one that needs neither — would depend
// on a reachable database.
import { connectFromEnv } from '@wikifake/db';
import { loadEnv } from '@wikifake/env';

import { articleCache } from './cache.js';
import { auth } from '../auth/auth.js';
import { languageModel } from './model.js';
import { networkTransport, wikiRequest } from './wikipedia.js';
import type { RoundDependencies } from './round.js';
import type { SessionContext } from './session.js';
import type { StartContext } from './start.js';
import type { SubmitContext } from './submit.js';

let connection: ReturnType<typeof connectFromEnv> | undefined;
let generation: RoundDependencies | undefined;

function db(): SessionContext['db'] {
  connection ??= connectFromEnv();
  return connection.db;
}

/** What a round in progress needs: who is asking, and where the rows are. */
export function sessionContext(): SessionContext {
  return { auth: auth(), db: db() };
}

/** What grading a round needs on top of that: the clock, as a parameter. */
export function submitContext(): SubmitContext {
  return { ...sessionContext(), now: () => new Date() };
}

/** What starting a round needs on top of that: a cache, a model, Wikipedia. */
export function startContext(): StartContext {
  if (generation === undefined) {
    const env = loadEnv();
    generation = {
      db: db(),
      cache: articleCache(env),
      model: languageModel(env),
      wiki: wikiRequest(env.BETTER_AUTH_URL),
      transport: networkTransport,
      // The draw the current `random.sample` makes: the same article played twice
      // does not hide its fakes in the same places.
      seed: () => Math.floor(Math.random() * 0xffff_ffff),
    };
  }
  return { auth: auth(), round: generation };
}
