// The pipeline against a real database, with the model and Wikipedia mocked.
//
// `article.test.ts` proves the socket side: a topic becomes a round. This proves
// the half that has no socket — the row. A multiplayer round that writes no
// `game` is not merely missing from the history: C4.6 counts its model calls in
// the numerator of `perGeneratedGame` and its round nowhere in the denominator,
// so every multiplayer generation would quietly inflate the cost per game.
//
// Everything is read back through named queries. Phase 2's exit gate: no ORM
// outside `@wikifake/db`, and an application that reaches for one is an
// application that has started deciding how the data is stored.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { falsifier, refuser, wikipedia, PAGE, SEARCH } from '@wikifake/article/testing';
import {
  openScratchDatabase,
  scratchDatabaseUrlOrNull,
  type TestDatabase,
} from '@wikifake/db/testing';
import {
  insertRoom,
  selectCostOfGame,
  selectFailuresByKind,
  selectGameCounts,
  selectGamesInRoom,
  selectParticipantsInProgress,
} from '@wikifake/db';
import type { LanguageModel } from 'ai';

import { createRoundSource } from './generation.js';

const url = scratchDatabaseUrlOrNull('realtime');

const ROOM = 'A1B2C3';
const WIKI = { language: 'fr', userAgent: 'WikiFake-test/0 (test)' };

const PLAYERS = [
  { name: 'ada', colour: '#e63946' },
  { name: 'bob', colour: '#f4a261' },
];

describe.skipIf(url === null)('5.8 — the round a topic produces', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await openScratchDatabase('realtime');
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.truncate();
    // `game.room_code` references `room`, so the room exists before a round is
    // played in it — as it does in production, where the row is what
    // `POST /api/multiplayer/create` wrote and what the socket checked before
    // letting anybody in.
    await insertRoom(database.db, { code: ROOM, timeLimit: 120 });
  });

  const ask = (model: LanguageModel) =>
    createRoundSource({
      db: database.db,
      // No cache: this is about what a generation writes, and a hit writes the
      // same row for less.
      cache: null,
      model,
      wiki: WIKI,
      transport: wikipedia([SEARCH, PAGE]),
      seed: () => 1,
    }).open({ roomCode: ROOM, topic: 'Chat', timeLimit: 120, players: PLAYERS });

  it('answers with a round and writes it down', async () => {
    const outcome = await ask(falsifier());

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.article.topic).toBe('Chat');
    expect(outcome.solution.length).toBeGreaterThan(0);
    // C1.1 — the count the players are told is the one the solution has, and
    // `createGame` derives it rather than accepting it.
    const rounds = await selectGamesInRoom(database.db, ROOM);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({
      mode: 'multiplayer',
      topic: 'Chat',
      timeLimit: 120,
      totalFakes: outcome.solution.length,
      fromCache: false,
    });

    const players = await selectParticipantsInProgress(database.db, rounds[0]?.id ?? '');
    expect(
      players.map((player) => ({ name: player.guestName, colour: player.colour })),
    ).toEqual([
      { name: 'ada', colour: '#e63946' },
      { name: 'bob', colour: '#f4a261' },
    ]);
  });

  // C4.6 — the reason the row matters. The calls belong to the game they
  // produced, so "what did this round cost" is a query rather than a
  // reconciliation, and the cost per generated game counts this round in both
  // its numerator and its denominator.
  it('attaches what the round cost to the round', async () => {
    await ask(falsifier());

    const [round] = await selectGamesInRoom(database.db, ROOM);
    const [cost] = await selectCostOfGame(database.db, round?.id ?? '');
    const [counts] = await selectGameCounts(database.db);

    expect(cost?.calls).toBeGreaterThan(0);
    expect(cost?.inputTokens).toBeGreaterThan(0);
    expect(counts).toEqual({ generated: 1, fromCache: 0 });
  });

  // C4.5 — a failed generation is billed and recorded, and becomes no game.
  // Dropping the record is what makes the cost of failure invisible today.
  it('records a failure that produced nothing, and no game', async () => {
    const outcome = await ask(refuser());

    expect(outcome.ok).toBe(false);
    expect(await selectGamesInRoom(database.db, ROOM)).toHaveLength(0);

    const failures = await selectFailuresByKind(database.db);
    expect(failures.reduce((total, row) => total + row.failures, 0)).toBeGreaterThan(0);

    const [counts] = await selectGameCounts(database.db);
    expect(counts).toEqual({ generated: 0, fromCache: 0 });
  });
});
