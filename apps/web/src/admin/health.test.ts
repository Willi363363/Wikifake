// Are both services up, on which commit, and how slow — step I.2.
//
// The database is real, because *the database is answering* is not a claim a
// mock can make. The socket service is a stubbed `fetch`, because the three
// cases that matter — it refuses, it answers rubbish, it never answers at all —
// cannot be produced by a service that is working.
//
// What every case below is really checking is the first rule of this section:
// **a failure is a value, not an exception.** A health page that throws is the
// one screen that goes blank exactly when something is broken.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { readHealth, PROBE_TIMEOUT_MS } from './health.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const REALTIME = 'https://realtime.example.test';

/** A `fetch` answering one body, and counting what it was asked. */
function serving(body: unknown, status = 200) {
  return vi.fn(
    (_input: unknown, _init?: RequestInit) =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      }) as unknown as Promise<Response>,
  );
}

const HEALTHY = {
  status: 'ok',
  version: '1.2.3',
  commit: 'a'.repeat(40),
  commitShort: 'aaaaaaa',
  model: 'a-model',
  llmConfigured: true,
};

describe.skipIf(url === null)('I.2 — the health section', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });

  afterAll(async () => {
    await store.close();
  });

  /** A monotonic clock that advances 5 ms per reading. */
  function ticking(step = 5) {
    let at = 0;
    return () => {
      at += step;
      return at;
    };
  }

  const read = (over: Parameters<typeof readHealth>[0] extends never ? never : object) =>
    readHealth({ db: store.db, realtimeUrl: REALTIME, now: ticking(), ...over });

  it('probes three services, in a fixed order', async () => {
    const view = await read({ fetch: serving(HEALTHY) });

    expect(view.readings.map((reading) => reading.name)).toEqual([
      'web',
      'realtime',
      'database',
    ]);
  });

  it('says the web app is up without asking it over HTTP', async () => {
    // This code *is* the web app: asking itself would measure a round trip and
    // prove nothing that rendering the page has not already proved.
    const call = serving(HEALTHY);

    const view = await read({ fetch: call });

    const web = view.readings.find((reading) => reading.name === 'web');
    expect(web?.up).toBe(true);
    expect(web?.ms).toBe(0);
    // One call, and it went to the socket service.
    expect(call).toHaveBeenCalledTimes(1);
    expect(String(call.mock.calls[0]?.[0])).toContain('realtime.example.test');
  });

  it('reads the socket service through the protocol schema', async () => {
    const view = await read({ fetch: serving(HEALTHY) });

    const realtime = view.readings.find((reading) => reading.name === 'realtime');
    expect(realtime?.up).toBe(true);
    expect(realtime?.detail).toBe('1.2.3');
    expect(realtime?.commit).toBe(HEALTHY.commit);
  });

  it('asks the health path, over http rather than ws', async () => {
    // The socket URL is configured as `wss://…` in a real deployment, and the
    // health path is not a socket.
    const call = serving(HEALTHY);

    await read({ fetch: call, realtimeUrl: 'wss://realtime.example.test' });

    expect(String(call.mock.calls[0]?.[0])).toBe(
      'https://realtime.example.test/api/health',
    );
  });

  it('reports a service that refuses, with how long it took', async () => {
    const view = await read({ fetch: serving({}, 503) });

    const realtime = view.readings.find((reading) => reading.name === 'realtime');
    expect(realtime?.up).toBe(false);
    expect(realtime?.detail).toContain('503');
    // How long it took to fail is the difference between refused and timed out.
    expect(realtime?.ms).toBeGreaterThan(0);
  });

  it('reports a service answering something it cannot read', async () => {
    // Not a page rendering `undefined`. `deploy-check.yml` made the same
    // decision about this contract: a service answering another shape is down.
    const view = await read({ fetch: serving({ status: 'ok' }) });

    const realtime = view.readings.find((reading) => reading.name === 'realtime');
    expect(realtime?.up).toBe(false);
    expect(realtime?.detail).toContain('cannot read');
  });

  it('reports a service that throws, rather than throwing', async () => {
    const view = await read({
      fetch: vi.fn(() => Promise.reject(new Error('getaddrinfo ENOTFOUND'))),
    });

    expect(view.readings.find((reading) => reading.name === 'realtime')?.detail).toBe(
      'getaddrinfo ENOTFOUND',
    );
    // And the rest of the page is still there, which is the whole rule.
    expect(view.readings.find((reading) => reading.name === 'database')?.up).toBe(true);
  });

  it('says so when no socket service is configured', async () => {
    const call = serving(HEALTHY);

    const view = await read({ fetch: call, realtimeUrl: undefined });

    expect(view.readings.find((reading) => reading.name === 'realtime')?.up).toBe(false);
    // Nothing was asked: an unconfigured URL is not a network problem.
    expect(call).not.toHaveBeenCalled();
  });

  it('gives every probe a deadline', async () => {
    // A service that has stopped answering does not refuse — it hangs, and a
    // page without a timeout inherits the hang.
    //
    // **The signal is captured and asserted out here**, which a mutation
    // taught: the first version asserted it *inside* the `fetch` stub, and
    // `probe` catches everything a probe throws — so removing the timeout made
    // the assertion fail into a reading and the test still passed. An assertion
    // inside a callback the code under test wraps in `try` is an assertion that
    // cannot fail.
    const call = serving(HEALTHY);

    await read({ fetch: call });

    const init = call.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(false);
    expect(PROBE_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });

  it('finds the database answering', async () => {
    const view = await read({ fetch: serving(HEALTHY) });

    const database = view.readings.find((reading) => reading.name === 'database');
    expect(database?.up).toBe(true);
    expect(database?.detail).toBe('answering');
  });

  it('reports a database that is not there, rather than throwing', async () => {
    const broken = {
      execute: () => Promise.reject(new Error('connection refused')),
    } as unknown as TestDatabase['db'];

    const view = await readHealth({
      db: broken,
      realtimeUrl: REALTIME,
      now: ticking(),
      fetch: serving(HEALTHY),
    });

    const database = view.readings.find((reading) => reading.name === 'database');
    expect(database?.up).toBe(false);
    expect(database?.detail).toBe('connection refused');
  });
});

describe.skipIf(url === null)('I.2 — whether the two agree on the commit', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });

  afterAll(async () => {
    await store.close();
  });

  const withCommit = (commit: string, over: object = {}) =>
    readHealth({
      db: store.db,
      realtimeUrl: REALTIME,
      now: () => 0,
      fetch: serving({ ...HEALTHY, commit }),
      ...over,
    });

  it('is null when this deployment has no commit of its own', async () => {
    // Locally there is no platform to provide one, and *unknown* is not the same
    // news as *disagreeing* — a page showing the same thing for both would be
    // the page that hid a half-finished deploy.
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');

    expect((await withCommit('b'.repeat(40))).sameCommit).toBeNull();

    vi.unstubAllEnvs();
  });

  it('is null when the socket service is down', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40));

    const view = await readHealth({
      db: store.db,
      realtimeUrl: REALTIME,
      now: () => 0,
      fetch: serving({}, 500),
    });
    expect(view.sameCommit).toBeNull();

    vi.unstubAllEnvs();
  });

  it('is true when both say the same commit', async () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40));

    expect((await withCommit('a'.repeat(40))).sameCommit).toBe(true);

    vi.unstubAllEnvs();
  });

  it('is false when they disagree, which is the figure worth having', async () => {
    // `deploy-check.yml` asserts this once per push. Here it answers the
    // question that outlives the push: the web app deploys in seconds and the
    // socket service does not.
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'a'.repeat(40));

    expect((await withCommit('b'.repeat(40))).sameCommit).toBe(false);

    vi.unstubAllEnvs();
  });
});
