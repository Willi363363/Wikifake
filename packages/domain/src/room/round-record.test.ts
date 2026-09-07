// Step E.3b.1 — what a round says about where it is written down.
//
// Its own file because `round.test.ts` reached the 500-line source cap, and
// because this is a different question: that one is about the rules of a round,
// this one is about the row it leaves behind.
//
// What is asserted here is the *effect* — that `endRound` names the right rows,
// the right players and the right marks. Whether being handed one writes
// anything is `apps/realtime/src/results.test.ts`, against a real Postgres.
import type { ArticleView, FalsifiedPosition } from '@wikifake/protocol';
import { describe, expect, it } from 'vitest';

import type { RoomEffect, RoomEvent } from './events.js';
import { joined, run, says } from './scenario.js';
import type { RoomState } from './state.js';

const ARTICLE: ArticleView = {
  topic: 'Paris',
  paragraphs: ['Paris est en France.', 'La ville compte deux arrondissements.'],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Paris',
};

/** One falsification, in paragraph 2, so "marked exactly it" is a perfect round. */
const SOLUTION: FalsifiedPosition[] = [
  {
    paragraphIndex: 2,
    falseInfoNumber: 1,
    falseStatement: 'La ville compte deux arrondissements.',
    explanation: 'Paris compte vingt arrondissements.',
    hint: 'Vérifiez le nombre.',
  },
];

const READY: RoomEvent = {
  kind: 'article_ready',
  article: ARTICLE,
  solution: SOLUTION,
  startedAt: 0,
  record: null,
};

describe('E.3b.1 — the round is written down', () => {
  /** The rows `createGame` opened, as `article_ready` carries them. */
  const RECORDED: RoomEvent = {
    ...READY,
    record: {
      gameId: 'game-1',
      participants: { ada: 'participant-ada', bob: 'participant-bob' },
    },
  } as RoomEvent;

  /** A room in a round that knows where it is being written. */
  function recordedRound(...names: readonly string[]): RoomState {
    return run([
      ...joined(...names),
      says(names[0]!, { type: 'force_start' }),
      ...names.map((name) => says(name, { type: 'submit_theme', topic: 'Paris' })),
      RECORDED,
    ]).state;
  }

  function resultsIn(effects: readonly RoomEffect[]) {
    return effects.find((effect) => effect.kind === 'record_results');
  }

  it('carries one result per player who submitted', () => {
    const state = recordedRound('ada', 'bob');
    const after = run(
      [
        says('ada', { type: 'submit_answer', marked: [1] }, 0, 10),
        says('bob', { type: 'submit_answer', marked: [2] }, 0, 20),
      ],
      state,
    );

    const written = resultsIn(after.effects);
    expect(written?.gameId).toBe('game-1');
    expect(written?.results.map((result) => result.participantId).sort()).toEqual([
      'participant-ada',
      'participant-bob',
    ]);
  });

  it('carries the marks, which is what the answer table has never held', () => {
    const state = recordedRound('ada');
    const after = run(
      [says('ada', { type: 'submit_answer', marked: [1, 3] }, 0, 10)],
      state,
    );

    // Graded and discarded before this step: a debrief could say what a player
    // scored and nothing anywhere could say what they marked to earn it.
    expect(resultsIn(after.effects)?.results[0]?.marked).toEqual([1, 3]);
  });

  it('answers the streak rule where the round is graded', () => {
    // `SOLUTION` falsifies paragraph 2 and nothing else, so marking exactly it
    // is every falsification found and nothing true marked. The rule is
    // `@wikifake/domain`'s and is applied here, which is why `@wikifake/db`
    // never has to know it.
    const perfect = run(
      [says('ada', { type: 'submit_answer', marked: [2] }, 0, 10)],
      recordedRound('ada'),
    );
    expect(resultsIn(perfect.effects)?.results[0]?.perfect).toBe(true);

    // And the half that keeps the streak honest: the falsification found, and
    // a true paragraph marked as well.
    const flawed = run(
      [says('ada', { type: 'submit_answer', marked: [1, 2] }, 0, 10)],
      recordedRound('ada'),
    );
    expect(resultsIn(flawed.effects)?.results[0]?.perfect).toBe(false);
  });

  it('leaves out a player who never submitted, rather than writing a zero', () => {
    /*
     * The leaderboard shows them a zero — C2.4 — and that is a display rule,
     * not a result. `participant_score_with_submission` forbids a score without
     * a submission, and writing the zero down would turn "did not answer" into
     * "answered and scored nothing": a different thing, and the one a profile
     * would go on to count as a finished round.
     */
    const state = recordedRound('ada', 'bob');
    const after = run(
      [says('ada', { type: 'submit_answer', marked: [1] }, 0, 10)],
      state,
    );
    // Ada alone has answered, so the round is not over yet; the clock ends it.
    const ended = run([{ kind: 'timer_expired' }], after.state);

    const written = resultsIn(ended.effects);
    expect(written?.results).toHaveLength(1);
    expect(written?.results[0]?.participantId).toBe('participant-ada');
  });

  it('emits nothing at all for a round with nowhere to write', () => {
    // `READY` carries no record, which is the shape `round.test.ts` uses
    // throughout — so the effect has to be absent rather than empty, or a
    // service would open a transaction to write nothing.
    const state = run([
      ...joined('ada'),
      says('ada', { type: 'force_start' }),
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
      READY,
    ]).state;
    const after = run(
      [says('ada', { type: 'submit_answer', marked: [1] }, 0, 10)],
      state,
    );

    expect(resultsIn(after.effects)).toBeUndefined();
  });

  it('says nothing about a clock', () => {
    // `purity.test.ts` holds these rules to reading none, so the effect carries
    // no timestamp: when a round was written down is the writer's instant, and
    // the solo path stamps it the same way, from an injected `now`.
    const state = recordedRound('ada');
    const after = run(
      [says('ada', { type: 'submit_answer', marked: [1] }, 0, 10)],
      state,
    );

    expect(Object.keys(resultsIn(after.effects) ?? {}).sort()).toEqual([
      'gameId',
      'kind',
      'results',
    ]);
  });
});
