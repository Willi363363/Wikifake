// Rounds, and where they are lost — step I.5, against a real Postgres.
//
// One decision carries most of these cases: **the abandon rate counts only
// rounds that have ended.** A seat in a round still running has not abandoned
// anything, and including it would make the figure climb every time somebody
// presses play and fall again when they submit — a number that moves for
// reasons nobody can act on.
import { game, participant, user } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readGames, MODES } from './games.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();

describe.skipIf(url === null)('I.5 — rounds and the abandon rate', () => {
  let store: TestDatabase;
  let seats = 0;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });

  beforeEach(async () => {
    await store.truncate();
    seats = 0;
  });

  afterAll(async () => {
    await store.close();
  });

  /** A round, with one seat per entry in `submitted`. */
  async function round(
    mode: 'solo' | 'multiplayer',
    over: { ended?: boolean; submitted?: readonly boolean[] } = {},
  ): Promise<void> {
    const [row] = await store.db
      .insert(game)
      .values({
        mode,
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un', 'deux'],
        totalFakes: 1,
        timeLimit: 300,
        endedAt: (over.ended ?? true) ? new Date() : null,
      })
      .returning({ id: game.id });
    const gameId = (row as { id: string }).id;

    for (const submitted of over.submitted ?? [true]) {
      seats += 1;
      const id = `p${String(seats)}`;
      await store.db
        .insert(user)
        .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
      // `participant_score_with_submission`: a submission without a score is a
      // debrief with a hole in it, and the schema refuses one. The fixture
      // obeys the constraint rather than working around it.
      await store.db.insert(participant).values({
        gameId,
        userId: id,
        colour: '#1f574d',
        submittedAt: submitted ? new Date() : null,
        score: submitted ? 300 : null,
      });
    }
  }

  const read = () => readGames({ db: store.db });

  it('answers nothing rather than zero when no round has ended', async () => {
    const view = await read();

    expect(view.total.abandonRate).toBeNull();
    expect(view.total.rounds).toBe(0);
  });

  it('gives a mode with no rounds a row of its own', async () => {
    // An absent row and a zero say different things to somebody reading a
    // dashboard: the first looks like a bug in the panel.
    await round('solo');

    const view = await read();

    expect(view.rows.map((row) => row.mode)).toEqual([...MODES]);
    expect(view.rows.find((row) => row.mode === 'multiplayer')?.rounds).toBe(0);
  });

  it('counts a seat that never submitted as abandoned', async () => {
    await round('solo', { submitted: [true] });
    await round('solo', { submitted: [false] });

    const solo = (await read()).rows.find((row) => row.mode === 'solo');

    expect(solo?.seats).toBe(2);
    expect(solo?.submitted).toBe(1);
    expect(solo?.abandoned).toBe(1);
    expect(solo?.abandonRate).toBe(0.5);
  });

  it('leaves a round still running out of the rate entirely', async () => {
    // The decision. Without it, pressing play would raise the abandon rate.
    await round('solo', { ended: true, submitted: [true] });
    await round('solo', { ended: false, submitted: [false] });

    const solo = (await read()).rows.find((row) => row.mode === 'solo');

    expect(solo?.rounds).toBe(2);
    expect(solo?.open).toBe(1);
    // One seat counted, and it submitted.
    expect(solo?.seats).toBe(1);
    expect(solo?.abandonRate).toBe(0);
  });

  it('counts a room seat by seat, not room by room', async () => {
    // How many people left, not how many rooms had somebody leave.
    await round('multiplayer', { submitted: [true, true, false, false, false] });

    const room = (await read()).rows.find((row) => row.mode === 'multiplayer');

    expect(room?.rounds).toBe(1);
    expect(room?.seats).toBe(5);
    expect(room?.abandoned).toBe(3);
    expect(room?.abandonRate).toBe(0.6);
  });

  it('keeps the two modes apart, because they abandon differently', async () => {
    await round('solo', { submitted: [false, false] });
    await round('multiplayer', { submitted: [true, true] });

    const view = await read();

    expect(view.rows.find((row) => row.mode === 'solo')?.abandonRate).toBe(1);
    expect(view.rows.find((row) => row.mode === 'multiplayer')?.abandonRate).toBe(0);
  });

  it('totals the rows rather than asking a third question', async () => {
    // A third query with its own `where` clause is a third chance to disagree
    // with the two above it. Summing the rows cannot.
    await round('solo', { submitted: [true, false] });
    await round('multiplayer', { submitted: [true, false, false] });

    const view = await read();
    const sum = (pick: (row: (typeof view.rows)[number]) => number) =>
      view.rows.reduce((at, row) => at + pick(row), 0);

    expect(view.total.rounds).toBe(sum((row) => row.rounds));
    expect(view.total.seats).toBe(sum((row) => row.seats));
    expect(view.total.abandoned).toBe(sum((row) => row.abandoned));
    expect(view.total.abandonRate).toBe(3 / 5);
  });

  it('never reports more submitted than seats', async () => {
    // The property that makes the rate a rate. A join that multiplied rows —
    // the classic way to get this wrong — would break it.
    await round('multiplayer', { submitted: [true, true, false] });
    await round('solo', { submitted: [true] });

    for (const row of [...(await read()).rows, (await read()).total]) {
      expect(row.submitted).toBeLessThanOrEqual(row.seats);
      expect(row.abandoned).toBeGreaterThanOrEqual(0);
    }
  });

  it('counts a round with nobody in it, and no seats from it', async () => {
    // A generated round that everybody left before joining is still a round.
    await round('solo', { submitted: [] });

    const solo = (await read()).rows.find((row) => row.mode === 'solo');
    expect(solo?.rounds).toBe(1);
    expect(solo?.seats).toBe(0);
    expect(solo?.abandonRate).toBeNull();
  });
});
