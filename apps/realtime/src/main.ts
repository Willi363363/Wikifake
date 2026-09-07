// The entry point: the environment becomes the service's collaborators.
//
// Everything that decides anything is a parameter of `createService`, so this
// file is the only one that knows a database and a set of origins exist. It is
// also the only one that reads `process.env`, and it does it through `loadEnv`,
// which refuses a missing variable by name at startup rather than three layers
// later.
//
// This import comes first and has to: it fills `process.env` from the
// workspace's `.env.local` or `.env`, and every import below it — `logger.js`
// reads `LOG_LEVEL` while it is being evaluated — would otherwise read an empty
// environment. A deployment sets its variables itself and the files are absent,
// so this is a no-op there.
import '@wikifake/env/load';

import { initSentry } from './sentry.js';
import { logger } from './logger.js';
import { createArticleCache } from '@wikifake/article';
import { connectFromEnv, deleteRoom, selectRoom } from '@wikifake/db';
import { ROOM_IDLE_LIMIT_SECONDS } from '@wikifake/domain';
import { loadEnv } from '@wikifake/env';

import { createRedisBus } from './bus.js';
import { createRoundSource } from './generation.js';
import { languageModel } from './model.js';
import { networkTransport, wikiRequest } from './wikipedia.js';
import { createOriginPolicy, parseOrigins } from './origins.js';
import { lazyRedis } from './redis.js';
import { createRoomStore } from './rooms/store.js';
import { createTokenStore } from './rooms/tokens.js';
import { createQueueScheduler } from './timers/queue.js';
import { readTicket } from '@wikifake/tickets';

import { writeResults } from './results.js';
import { createService } from './server.js';

const PORT = 8080;

initSentry();
const env = loadEnv();
const { db } = connectFromEnv();

const service = createService({
  // The app is the only legitimate origin, so a deployment that has not
  // configured a list accepts its own app rather than everything.
  origins: createOriginPolicy(
    env.REALTIME_ALLOWED_ORIGINS === undefined
      ? [env.BETTER_AUTH_URL]
      : parseOrigins(env.REALTIME_ALLOWED_ORIGINS),
  ),
  roomExists: async (roomCode) => (await selectRoom(db, roomCode)).length > 0,
  // C1.8, D4 — and the row goes when the room does. Without this the code stays
  // taken for ever and a stranger can open a socket on a room nobody is in.
  closeRoom: async (roomCode) => {
    await deleteRoom(db, roomCode);
  },
  // Step E.3b.1 — the round, written down. Failures are logged and swallowed:
  // the round is over for the players either way and the debrief is already on
  // its way over the channel, so an exception thrown back into the settle loop
  // would take a room down over a row.
  // Step E.3b.2 — who a socket belongs to. The web application signs; this
  // checks, with the secret both halves already load. A deployment where the
  // two disagree attributes nothing and plays on, which is the state before
  // this step rather than a broken one.
  accountFor: ({ roomCode, playerName, ticket }) =>
    ticket === ''
      ? null
      : (readTicket(env.BETTER_AUTH_SECRET, ticket, { roomCode, playerName }, Date.now())
          ?.userId ?? null),
  recordResults: async (effect) => {
    try {
      await writeResults({ db, now: () => new Date() }, effect);
    } catch (cause) {
      logger.error({ err: cause, gameId: effect.gameId }, 'round not recorded');
    }
  },
  // Postgres says whether a room was ever opened; Redis holds what is happening
  // in it. The two answer different questions and neither is the other's cache.
  rooms: createRoomStore({ redis: lazyRedis(env.REDIS_URL) }),
  // Every effect crosses this, even for a player connected to this very process:
  // one delivery path rather than two that have to agree.
  bus: createRedisBus(env.REDIS_URL),
  // D4 — a round nobody ends, ends anyway. Delayed jobs rather than timeouts:
  // a timeout dies with its process, and a redeployment would forget every
  // round in flight.
  scheduler: (onAlarm) => createQueueScheduler({ url: env.REDIS_URL, onAlarm }),
  // D5 — a dropped player keeps their seat, and only they can take it back.
  // D3 — what answers `generate_article`, and therefore the only thing that can
  // start a multiplayer round. The chain is `@wikifake/article`'s, the same one
  // the solo route uses.
  articles: createRoundSource({
    db,
    cache: createArticleCache({ redis: lazyRedis(env.REDIS_URL), now: () => Date.now() }),
    model: languageModel(env),
    wiki: wikiRequest(env.BETTER_AUTH_URL, env.WIKIPEDIA_API_URL),
    transport: networkTransport,
    // The draw the current `random.sample` makes: the same article played twice
    // does not hide its fakes in the same places.
    seed: () => Math.floor(Math.random() * 0xffff_ffff),
  }),
  tokens: createTokenStore({
    redis: lazyRedis(env.REDIS_URL),
    namespace: 'wikifake:room',
    idleSeconds: ROOM_IDLE_LIMIT_SECONDS,
  }),
  // Spread rather than assigned: `exactOptionalPropertyTypes` refuses an
  // explicit `undefined` where the option is optional, and the absence is what
  // means "use the domain's number".
  ...(env.REALTIME_GRACE_SECONDS === undefined
    ? {}
    : { graceSeconds: env.REALTIME_GRACE_SECONDS }),
});

const port = Number(process.env['PORT'] ?? PORT);
const bound = await service.listen(port);
logger.info({ port: bound }, 'realtime service listening');
