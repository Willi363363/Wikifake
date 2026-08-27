// A real Redis for a test, and nothing left behind.
//
// The scripts are the point of the step, and a script tested against a fake is a
// fake tested against a fake: `HSET`, `PEXPIRE` and a compare-and-set only mean
// anything against the server that implements them.
import { createClient } from 'redis';

/**
 * Where the test Redis is, or why there is none.
 *
 * Absent locally is a skip; absent in CI is a failure — the same contract as
 * `@wikifake/article` and `@wikifake/db`, for the same reason: a suite that
 * quietly skips on the machine deciding whether to merge reports green for work
 * it never did.
 */
export function testRedisUrl(): string | null {
  const url = process.env['REDIS_URL'];
  if (url !== undefined && url !== '') return url;
  if (process.env['CI'] === 'true') {
    throw new Error(
      'REDIS_URL is required in CI: the integration tests must actually run',
    );
  }
  return null;
}

/**
 * @param namespace keys to own and to clean up. Each test file passes its own,
 * so two files running in parallel cannot flush each other's rooms — the race
 * that made one of the article cache's tests fail about one run in three.
 */
export async function openTestRedis(url: string, namespace: string) {
  const client = createClient({ url });
  await client.connect();

  const flush = async (): Promise<void> => {
    const keys = await client.keys(`${namespace}:*`);
    if (keys.length > 0) await client.del(keys);
  };

  await flush();
  return {
    client,
    redis: client,
    flush,
    close: async () => void (await client.quit()),
  };
}

/**
 * Inferred rather than declared.
 *
 * `RedisClientType` is generic over five parameters whose defaults differ
 * between `createClient` and the client it hands back, so writing the type out
 * turns a driver upgrade into an unreadable variance error about `RespVersions`.
 */
export type TestRedis = Awaited<ReturnType<typeof openTestRedis>>;
