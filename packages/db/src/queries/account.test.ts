// Taking an account's data out, and taking the account away — step E.7, against
// a real Postgres.
//
// **The abort is the reason this suite exists.** Every reference to `user` is
// declared `cascade` or `set null`, so `delete from "user"` reads like the whole
// job — and it is not: a solo round played by a signed-in player has a `userId`
// and no `guestName`, `set null` leaves a row that is neither, and
// `participant_account_or_guest` fires and takes the delete with it. The first
// case below is that failure, written against the raw statement so that the
// guarantee is the schema's rather than the query's care.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { deleteAccount, exportAccount, selectParticipantsOf } from './account.js';
import { claimPseudonym } from './profile.js';
import { insertFlagReport } from './flags.js';
import { recordSubmission } from './session.js';
import { createGame } from './start.js';
import { user } from '../schema/auth.js';
import { playerStats } from '../schema/stats.js';
import { profile } from '../schema/profile.js';
import { openTestDatabase, rejectionCode, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

/** The name a deleted account's rounds are attributed to. The caller's, injected. */
const GONE = 'deleted-1a2b3c4d';

describe.skipIf(url === null)('E.7 — export and delete', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  const addUser = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
  };

  /**
   * A round, played by whoever is given.
   *
   * `guestName` is passed through rather than defaulted, because the two shapes
   * are exactly what this step turns on: solo gives an account and no name —
   * `identify` sets none — and a room gives both.
   */
  async function playRound(
    players: readonly { userId?: string; guestName?: string }[],
    topic = 'Chat',
  ): Promise<{ gameId: string; participantIds: string[] }> {
    const started = await createGame(store.db, {
      mode: players.length > 1 ? 'multiplayer' : 'solo',
      topic,
      sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
      paragraphs: ['un', 'deux', 'trois', 'quatre'],
      timeLimit: 300,
      fromCache: false,
      solution: [1, 2, 3].map((n) => ({
        paragraphIndex: n,
        falseInfoNumber: n,
        falseStatement: `faux ${String(n)}`,
        originalText: `vrai ${String(n)}`,
        explanation: 'because',
        hint: 'a hint',
      })),
      players: players.map((player) => ({ ...player, colour: '#000000' })),
    });
    return { gameId: started.gameId, participantIds: [...started.participantIds] };
  }

  /**
   * Finishes a round, so there is a score for the delete to leave behind.
   *
   * The figures are a caller's — the rules live in `@wikifake/domain`, which
   * this package may not import — so they are named here rather than computed.
   * What matters to this suite is only that a score exists and survives.
   */
  async function submit(gameId: string, participantId: string): Promise<void> {
    await recordSubmission(store.db, {
      gameId,
      participantId,
      marked: [1, 2, 3],
      score: 420,
      truePositives: 3,
      falsePositives: 0,
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: 0,
      timeBonus: 20,
      at: new Date(),
      perfect: true,
    });
  }

  describe('the delete the schema would not allow', () => {
    it('aborts on a raw delete, for an account that has played solo', async () => {
      await addUser('ada');
      // The solo shape: an account, and no guest name.
      await playRound([{ userId: 'ada' }]);

      const code = await rejectionCode(store.db.delete(user).where(eq(user.id, 'ada')));

      // `participant_account_or_guest`. `set null` on `user_id` leaves a row
      // that names neither an account nor a guest, and the check takes the
      // whole statement with it. This is what `deleteAccount` exists for.
      expect(code).toBe('23514');
    });

    it('succeeds through `deleteAccount`', async () => {
      await addUser('ada');
      await playRound([{ userId: 'ada' }]);

      await deleteAccount(store.db, 'ada', GONE);

      expect(await store.db.select().from(user)).toEqual([]);
    });
  });

  describe('what a delete leaves behind', () => {
    it('keeps a finished round, attributed to a deleted player', async () => {
      await addUser('ada');
      const round = await playRound([{ userId: 'ada' }]);
      await submit(round.gameId, round.participantIds[0] as string);

      await deleteAccount(store.db, 'ada', GONE);

      const [row] = await selectParticipantsOf(store.db, round.gameId);
      // The score survives — the plan's own words: a finished room keeps its
      // scores. What is gone is the link back to a person.
      expect(row?.score).toBeGreaterThan(0);
      expect(row?.userId).toBeNull();
      expect(row?.guestName).toBe(GONE);
    });

    it('renames a room round too, so the pseudonym does not survive it', async () => {
      await addUser('ada');
      await claimPseudonym(store.db, 'ada', 'AdaLovelace');
      // Since E.3.3 a signed-in player's room round carries their pseudonym
      // here. Renaming only the nameless rows would delete an account and leave
      // its public name in every room it ever played.
      const round = await playRound([
        { userId: 'ada', guestName: 'AdaLovelace' },
        { guestName: 'bob' },
      ]);

      await deleteAccount(store.db, 'ada', GONE);

      const rows = await selectParticipantsOf(store.db, round.gameId);
      expect(rows.map((row) => row.guestName).sort()).toEqual(['bob', GONE].sort());
    });

    it('leaves the other players in the room untouched', async () => {
      await addUser('ada');
      await addUser('bob');
      const round = await playRound([
        { userId: 'ada', guestName: 'ada' },
        { userId: 'bob', guestName: 'bob' },
      ]);

      await deleteAccount(store.db, 'ada', GONE);

      const rows = await selectParticipantsOf(store.db, round.gameId);
      expect(rows.find((row) => row.guestName === 'bob')?.userId).toBe('bob');
    });

    it('takes the profile and the aggregate with it', async () => {
      await addUser('ada');
      await claimPseudonym(store.db, 'ada', 'AdaLovelace');
      const round = await playRound([{ userId: 'ada' }]);
      await submit(round.gameId, round.participantIds[0] as string);

      await deleteAccount(store.db, 'ada', GONE);

      // `cascade`, which is the schema saying these have no meaning without the
      // row above them. Asserted rather than trusted: a pseudonym that outlived
      // its account would be a name nobody could ever claim again.
      expect(await store.db.select().from(profile)).toEqual([]);
      expect(await store.db.select().from(playerStats)).toEqual([]);
    });

    it('releases the pseudonym for somebody else to take', async () => {
      await addUser('ada');
      await addUser('bob');
      await claimPseudonym(store.db, 'ada', 'AdaLovelace');

      await deleteAccount(store.db, 'ada', GONE);

      expect((await claimPseudonym(store.db, 'bob', 'AdaLovelace')).ok).toBe(true);
    });

    it('keeps a report and loses its author', async () => {
      await addUser('ada');
      await insertFlagReport(store.db, {
        reporterId: 'ada',
        articleTitle: 'Chat',
        articleUrl: 'https://fr.wikipedia.org/wiki/Chat',
        flaggedClaim: 'a claim',
        proposedCorrection: 'a correction',
        quickNote: '',
        explanation: '',
        sources: [],
        status: 'ai_reviewed',
        verdict: 'uncertain',
        confidence: 50,
        reasoning: 'because',
        sourcesFound: [],
        recommendation: 'approve_for_review',
      });

      const deletion = await deleteAccount(store.db, 'ada', GONE);

      // `set null`, which is the schema saying the opposite of `cascade`: a
      // report is about an article and outlives the reader who filed it.
      expect(deletion.reports).toBe(1);
    });

    it('says what it did', async () => {
      await addUser('ada');
      await playRound([{ userId: 'ada' }]);
      await playRound([{ userId: 'ada' }], 'Chien');

      expect(await deleteAccount(store.db, 'ada', GONE)).toEqual({
        participants: 2,
        reports: 0,
      });
    });

    it('does the anonymisation and the delete together or not at all', async () => {
      await addUser('ada');
      const round = await playRound([{ userId: 'ada' }]);

      await store.db
        .transaction(async (tx) => {
          await deleteAccount(tx, 'ada', GONE);
          throw new Error('something after it failed');
        })
        .catch(() => undefined);

      // An anonymisation that committed without its delete would be an account
      // whose rounds had been stripped of their name and which still existed.
      const [row] = await selectParticipantsOf(store.db, round.gameId);
      expect(row?.userId).toBe('ada');
      expect(row?.guestName).toBeNull();
    });
  });

  describe('what an export contains', () => {
    it('answers null for an account that is not there', async () => {
      // Not an empty export: `{}` would read as an account holding nothing.
      expect(await exportAccount(store.db, 'nobody')).toBeNull();
    });

    it('carries the address, the pseudonym and the rounds', async () => {
      await addUser('ada');
      await claimPseudonym(store.db, 'ada', 'AdaLovelace');
      const round = await playRound([{ userId: 'ada' }]);
      await submit(round.gameId, round.participantIds[0] as string);

      const taken = await exportAccount(store.db, 'ada');

      expect(taken?.account.email).toBe('ada@example.test');
      expect(taken?.profile?.pseudonym).toBe('AdaLovelace');
      expect(taken?.games).toHaveLength(1);
      expect(taken?.games[0]?.topic).toBe('Chat');
      // The same numbers the profile screen shows, because it is the same query.
      expect(taken?.stats?.gamesFinished).toBe(1);
    });

    it('carries nothing that could be used to sign in', async () => {
      await addUser('ada');

      const taken = await exportAccount(store.db, 'ada');

      // A hashed password and an OAuth refresh token are data *about* this
      // account, and handing them to whoever holds the browser is a credential
      // leak wearing the word "export".
      const flat = JSON.stringify(taken);
      expect(flat).not.toContain('password');
      expect(flat).not.toContain('token');
      expect(flat).not.toContain('session');
    });

    it('carries the reports they filed', async () => {
      await addUser('ada');
      await insertFlagReport(store.db, {
        reporterId: 'ada',
        articleTitle: 'Chat',
        articleUrl: 'https://fr.wikipedia.org/wiki/Chat',
        flaggedClaim: 'a claim',
        proposedCorrection: 'a correction',
        quickNote: 'what they typed',
        explanation: '',
        sources: [],
        status: 'ai_reviewed',
        verdict: 'uncertain',
        confidence: 50,
        reasoning: 'because',
        sourcesFound: [],
        recommendation: 'approve_for_review',
      });

      const taken = await exportAccount(store.db, 'ada');

      // Free text a player wrote is theirs, and the most likely place in this
      // schema for something personal to have been typed by hand.
      expect(taken?.reports[0]?.quickNote).toBe('what they typed');
    });

    it('is empty in every part for an account that has done nothing', async () => {
      await addUser('ada');

      const taken = await exportAccount(store.db, 'ada');

      // The shape does not change with the contents: a client reading an export
      // should not have to handle a missing key and an empty list.
      expect(taken?.profile).toBeNull();
      expect(taken?.stats).toBeNull();
      expect(taken?.games).toEqual([]);
      expect(taken?.reports).toEqual([]);
    });

    it('holds a round the player left unfinished', async () => {
      await addUser('ada');
      await playRound([{ userId: 'ada' }]);

      const taken = await exportAccount(store.db, 'ada');

      // Abandoned rounds are data about them too, and the profile counts them.
      expect(taken?.games).toHaveLength(1);
      expect(taken?.games[0]?.submittedAt).toBeNull();
    });
  });
});
