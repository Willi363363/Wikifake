// The route behind the beacon — step J.4.
//
// The counting itself is `packages/db`'s, and its own suite proves the increment
// survives two arrivals at once. What is decided here is what the route accepts,
// and every case below is a way a public endpoint with no authentication goes
// wrong: a page nobody declared, a body that is not one, a caller that is not a
// page we served, and a refusal loud enough to fill a console.
import { describe, expect, it } from 'vitest';

import { selectPageViews } from '@wikifake/db';
import type { TestDatabase } from '@wikifake/db/testing';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { handleRecordView, sameOrigin } from './record.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const AT = new Date('2026-09-11T12:00:00.000Z');

/** A beacon, as the browser sends one: same origin, a JSON body, one field. */
function beacon(body: unknown, origin: string | null = BASE): Request {
  return new Request(`${BASE}/api/view`, {
    method: 'POST',
    headers: origin === null ? {} : { origin },
    body: JSON.stringify(body),
  });
}

describe.skipIf(url === null)('J.4 — the arrival route', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  const context = () => ({ db: store.db, now: () => AT });

  /** The one UTC day `AT` falls in, as the half-open window the read takes. */
  const counts = () => {
    const midnight = Date.parse(`${AT.toISOString().slice(0, 10)}T00:00:00.000Z`);
    return selectPageViews(store.db, { fromMs: midnight, toMs: midnight + 86_400_000 });
  };

  it('counts a page it was told about', async () => {
    const answer = await handleRecordView(context(), beacon({ page: 'landing' }));

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ counted: true });
    expect(await counts()).toEqual([{ day: '2026-09-11', page: 'landing', views: 1 }]);
  });

  /*
   * A page nobody declared is refused, and this is the assertion that keeps the
   * column bounded.
   *
   * The field the route deliberately does not take is a *path*: `/room/ABCD`
   * and `/solo?topic=…` carry a room code and a subject somebody typed. A
   * counter keyed by free text stores whatever a caller sends it, for ever.
   */
  it('writes nothing for a page it does not know', async () => {
    const answer = await handleRecordView(context(), beacon({ page: '/room/ABCD' }));

    expect(await answer.json()).toEqual({ counted: false });
    expect(await counts()).toEqual([]);
  });

  it('writes nothing for a body that is not one', async () => {
    const request = new Request(`${BASE}/api/view`, {
      method: 'POST',
      headers: { origin: BASE },
      body: 'landing',
    });

    expect(await (await handleRecordView(context(), request)).json()).toEqual({
      counted: false,
    });
    expect(await counts()).toEqual([]);
  });

  it('writes nothing for a caller that is not a page we served', async () => {
    const answer = await handleRecordView(
      context(),
      beacon({ page: 'landing' }, 'https://somebody-elses.example'),
    );

    expect(await answer.json()).toEqual({ counted: false });
    expect(await counts()).toEqual([]);
  });

  it('writes nothing for a request with no origin at all', async () => {
    // A bare `curl` and most crawlers. Not a defence — a forged header passes —
    // but it keeps accidents out of a number somebody will read as traffic.
    const answer = await handleRecordView(context(), beacon({ page: 'landing' }, null));

    expect(await answer.json()).toEqual({ counted: false });
    expect(await counts()).toEqual([]);
  });

  /*
   * Declining still answers 200, and that is deliberate.
   *
   * A beacon is fired by a page that may already be unloading: there is nobody
   * to read a 403, and an error status would print in the console of a page
   * where nothing is wrong. `counted` is how a test tells the two apart, which
   * is why it exists at all.
   */
  it('declines without raising its voice', async () => {
    const refused = await handleRecordView(
      context(),
      beacon({ page: 'landing' }, 'https://somebody-elses.example'),
    );

    expect(refused.status).toBe(200);
  });

  it('adds the second load of the day to the first', async () => {
    await handleRecordView(context(), beacon({ page: 'landing' }));
    await handleRecordView(context(), beacon({ page: 'landing' }));
    await handleRecordView(context(), beacon({ page: 'entry' }));

    expect(await counts()).toEqual([
      { day: '2026-09-11', page: 'entry', views: 1 },
      { day: '2026-09-11', page: 'landing', views: 2 },
    ]);
  });
});

describe('J.4 — same origin, without a database', () => {
  it('compares the header to the host the request arrived at', () => {
    // Not to a configured URL: that is one more thing to get wrong per
    // environment, and it would refuse every preview deployment.
    expect(sameOrigin(beacon({ page: 'landing' }, 'https://preview.example'))).toBe(
      false,
    );
    expect(
      sameOrigin(
        new Request('https://preview.example/api/view', {
          method: 'POST',
          headers: { origin: 'https://preview.example' },
          body: '{}',
        }),
      ),
    ).toBe(true);
  });
});
