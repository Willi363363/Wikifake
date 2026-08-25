// C1.1 — `POST /api/game/start`: the article, and how many paragraphs were
// falsified. Never which ones.
//
// This file is wiring and nothing else. What the route *does* lives in
// `src/game/start.ts`, which takes its collaborators as arguments so the leak
// assertion can drive the real handler with a frozen page and a mocked model.
import { connectFromEnv } from '@wikifake/db';
import { loadEnv } from '@wikifake/env';

import { auth } from '../../../../src/auth/auth.js';
import { articleCache } from '../../../../src/game/cache.js';
import { languageModel } from '../../../../src/game/model.js';
import { handleStart } from '../../../../src/game/start.js';
import { networkTransport, wikiRequest } from '../../../../src/game/wikipedia.js';
import type { RoundDependencies } from '../../../../src/game/round.js';

/** Reads cookies, writes rows, calls a model. Nothing here is prerenderable. */
export const dynamic = 'force-dynamic';

/**
 * Built once, on first request.
 *
 * Lazily, like `auth()` and for the same reason: at module load this would open a
 * database connection and validate the whole environment, so importing anything
 * under `app/api/game/` — from a route that needs none of it — would depend on a
 * reachable database.
 */
let wiring: RoundDependencies | undefined;

function dependencies(): RoundDependencies {
  if (wiring === undefined) {
    const env = loadEnv();
    wiring = {
      db: connectFromEnv().db,
      cache: articleCache(env),
      model: languageModel(env),
      wiki: wikiRequest(env.BETTER_AUTH_URL),
      transport: networkTransport,
      // The draw the current `random.sample` makes: the same article played twice
      // does not hide its fakes in the same places.
      seed: () => Math.floor(Math.random() * 0xffff_ffff),
    };
  }
  return wiring;
}

export function POST(request: Request): Promise<Response> {
  return handleStart({ auth: auth(), round: dependencies() }, request);
}
