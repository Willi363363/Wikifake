// The entry point: the environment becomes the service's collaborators.
//
// Everything that decides anything is a parameter of `createService`, so this
// file is the only one that knows a database and a set of origins exist. It is
// also the only one that reads `process.env`, and it does it through `loadEnv`,
// which refuses a missing variable by name at startup rather than three layers
// later.
import { connectFromEnv, selectRoom } from '@wikifake/db';
import { loadEnv } from '@wikifake/env';

import { createOriginPolicy, parseOrigins } from './origins.js';
import { lazyRedis } from './redis.js';
import { createRoomStore } from './rooms/store.js';
import { createService } from './server.js';

const PORT = 8080;

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
  // Postgres says whether a room was ever opened; Redis holds what is happening
  // in it. The two answer different questions and neither is the other's cache.
  rooms: createRoomStore({ redis: lazyRedis(env.REDIS_URL) }),
});

const port = Number(process.env['PORT'] ?? PORT);
await service.listen(port);
