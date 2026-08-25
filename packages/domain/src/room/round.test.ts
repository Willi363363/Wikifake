import { describe, expect, it } from 'vitest';
import type { ArticleView, FalsifiedPosition } from '@wikifake/protocol';

import { REVEAL_COST } from '../scoring.js';
import type { RoomEvent } from './events.js';
import { reduceRoom } from './reduce.js';
import { broadcasts, joined, run, says } from './scenario.js';
import type { RoomState } from './state.js';

const ARTICLE: ArticleView = {
  topic: 'Paris',
  paragraphs: [
    'Paris est la capitale.',
    'La ville compte deux arrondissements.',
    'La Seine.',
  ],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Paris',
};

const SOLUTION: FalsifiedPosition[] = [
  {
    paragraphIndex: 2,
    falseInfoNumber: 1,
    falseStatement: 'La ville compte deux arrondissements.',
    explanation: 'Paris compte vingt arrondissements.',
    hint: 'Vérifiez le nombre.',
  },
];

const READY: RoomEvent = { kind: 'article_ready', article: ARTICLE, solution: SOLUTION };

/** A room in a round, with the given players, started through the topic vote. */
function inRound(...names: readonly string[]): RoomState {
  const events: RoomEvent[] = [
    ...joined(...names),
    says(names[0]!, { type: 'force_start' }),
    ...names.map((name) => says(name, { type: 'submit_theme', topic: 'Paris' })),
    READY,
  ];
  return run(events).state;
}

describe('D3 — one way into a round', () => {
  it('starts on article_ready and announces it', () => {
    const generating = run([
      ...joined('ada', 'bob'),
      says('ada', { type: 'start_game', topic: 'Paris' }),
    ]).state;
    const outcome = reduceRoom(generating, READY);

    expect(outcome.state.phase).toBe('round');
    const start = broadcasts(outcome.effects).find(
      (message) => message.type === 'game_start',
    );
    expect(start).toMatchObject({
      topic: 'Paris',
      totalFakes: 1,
      players: [
        { name: 'ada', colour: expect.any(String) },
        { name: 'bob', colour: expect.any(String) },
      ],
    });
  });

  // C1.1 — the same assertion as the protocol's, at the reducer's level: the
  // announcement is built from the article, so the solution has no way in.
  it('announces nothing of the solution', () => {
    const outcome = reduceRoom(
      run([...joined('ada'), says('ada', { type: 'start_game', topic: 'Paris' })]).state,
      READY,
    );
    const serialised = JSON.stringify(broadcasts(outcome.effects));
    expect(serialised).not.toContain('vingt arrondissements');
    expect(serialised).not.toContain('Vérifiez le nombre');
  });

  it('arms the timer for the round length', () => {
    const outcome = reduceRoom(
      run([
        ...joined('ada'),
        says('ada', { type: 'start_game', topic: 'Paris', timeLimit: 120 }),
      ]).state,
      READY,
    );
    expect(outcome.effects).toContainEqual({ kind: 'arm_timer', seconds: 120 });
  });

  // A late article from an abandoned generation must not restart a round that
  // already ended.
  it('ignores an article that arrives outside a generation', () => {
    const lobby = run(joined('ada')).state;
    expect(reduceRoom(lobby, READY).state).toBe(lobby);
  });
});

describe('D2 — the single start purges everything a round owns', () => {
  // The step's own criterion. The topic-vote path — the normal one — reset
  // `score` and `answered` and left `hint_levels`, `score_stolen`,
  // `hints_blocked_until` and `scanned` behind, so a player carried last
  // round's hint bill into this one.
  it('clears hints, stolen points, the hint block and the scanner memory', () => {
    let state = inRound('ada', 'bob');

    // Live a round: buy a reveal, then get robbed, jammed, frozen and scanned.
    state = reduceRoom(
      state,
      says('ada', { type: 'unlock_hint', falseInfoNumber: 1, level: 2 }),
    ).state;
    state = {
      ...state,
      players: state.players.map((player) =>
        player.name === 'ada'
          ? {
              ...player,
              items: {
                scoreStolen: 50,
                hintsBlockedUntil: 900,
                timePenaltySeconds: 10,
                scanned: [2],
              },
              hand: [{ instanceId: 'i', itemId: 'BLUR' }],
            }
          : player,
      ),
    };

    // End the round the normal way.
    state = reduceRoom(state, says('ada', { type: 'submit_answer', marked: [2] })).state;
    state = reduceRoom(state, says('bob', { type: 'submit_answer', marked: [] })).state;
    expect(state.phase).toBe('lobby');

    // The dirt survives the debrief — which is why the purge has to happen at
    // the *start* of the next round rather than at the end of this one.
    const dirty = state.players.find((player) => player.name === 'ada');
    expect(Object.keys(dirty?.hints ?? {})).toHaveLength(1);
    expect(dirty?.items.scoreStolen).toBe(50);

    // Second round, through the vote: the path that used to leak.
    state = reduceRoom(state, says('ada', { type: 'force_start' })).state;
    state = reduceRoom(state, says('ada', { type: 'submit_theme', topic: 'Lyon' })).state;
    state = reduceRoom(state, says('bob', { type: 'submit_theme', topic: 'Lyon' })).state;
    expect(state.phase).toBe('generating');
    state = reduceRoom(state, READY).state;
    expect(state.phase).toBe('round');

    const fresh = state.players.find((player) => player.name === 'ada');
    expect(fresh?.hints).toEqual({});
    expect(fresh?.items).toEqual({
      scoreStolen: 0,
      hintsBlockedUntil: 0,
      timePenaltySeconds: 0,
      scanned: [],
    });
    expect(fresh?.hand).toEqual([]);
    expect(fresh?.submission).toBe(null);
    expect(fresh?.answered).toBe(false);
    expect(fresh?.ready).toBe(false);
  });

  it('purges the direct start path the same way', () => {
    let state = inRound('ada');
    state = reduceRoom(
      state,
      says('ada', { type: 'unlock_hint', falseInfoNumber: 1, level: 2 }),
    ).state;
    state = reduceRoom(state, says('ada', { type: 'submit_answer', marked: [] })).state;
    state = reduceRoom(state, says('ada', { type: 'start_game', topic: 'Lyon' })).state;
    state = reduceRoom(state, READY).state;

    expect(state.players[0]?.hints).toEqual({});
  });
});

describe('submissions', () => {
  it('grades from server state and waits for the others', () => {
    const state = inRound('ada', 'bob');
    const outcome = reduceRoom(
      state,
      says('ada', { type: 'submit_answer', marked: [2] }, 0),
    );
    expect(outcome.state.phase).toBe('round');
    const ada = outcome.state.players.find((player) => player.name === 'ada');
    expect(ada?.answered).toBe(true);
    expect(ada?.submission?.score).toBe(300);
  });

  // C1.3 — the penalties come from the ledger, and the message has no field to
  // declare them in.
  it('charges the hints the player actually bought', () => {
    let state = inRound('ada', 'bob');
    state = reduceRoom(
      state,
      says('ada', { type: 'unlock_hint', falseInfoNumber: 1, level: 2 }),
    ).state;
    const outcome = reduceRoom(
      state,
      says('ada', { type: 'submit_answer', marked: [2] }, 0),
    );
    const ada = outcome.state.players.find((player) => player.name === 'ada');
    expect(ada?.submission?.breakdown.hintPenalty).toBe(REVEAL_COST);
    expect(ada?.submission?.score).toBe(300 - REVEAL_COST);
  });

  // D7 — the seconds FREEZE_TIME ate come off the bonus here.
  it('charges the time a freeze cost', () => {
    let state = inRound('ada', 'bob');
    state = {
      ...state,
      players: state.players.map((player) =>
        player.name === 'ada'
          ? { ...player, items: { ...player.items, timePenaltySeconds: 100 } }
          : player,
      ),
    };
    const outcome = reduceRoom(
      state,
      says('ada', { type: 'submit_answer', marked: [2] }, 0),
    );
    const ada = outcome.state.players.find((player) => player.name === 'ada');
    expect(ada?.submission?.breakdown.timeBonus).toBe(100);
  });

  it('takes a submission back', () => {
    let state = inRound('ada', 'bob');
    state = reduceRoom(state, says('ada', { type: 'submit_answer', marked: [2] })).state;
    const outcome = reduceRoom(state, says('ada', { type: 'unsubmit_answer' }));
    const ada = outcome.state.players.find((player) => player.name === 'ada');
    expect(ada?.answered).toBe(false);
    expect(ada?.submission).toBe(null);
  });
});

describe('the first way out — everyone submitted', () => {
  it('ends the round and reveals the solution', () => {
    let state = inRound('ada', 'bob');
    state = reduceRoom(state, says('ada', { type: 'submit_answer', marked: [2] })).state;
    const outcome = reduceRoom(state, says('bob', { type: 'submit_answer', marked: [] }));

    expect(outcome.state.phase).toBe('lobby');
    expect(outcome.state.round).toBe(null);
    const end = broadcasts(outcome.effects).find(
      (message) => message.type === 'game_end',
    );
    expect(JSON.stringify(end)).toContain('vingt arrondissements');
  });

  it('cancels the timer', () => {
    const state = inRound('ada');
    const outcome = reduceRoom(
      state,
      says('ada', { type: 'submit_answer', marked: [2] }),
    );
    expect(outcome.effects).toContainEqual({ kind: 'cancel_timer' });
  });

  it('C2.4 — orders the leaderboard by descending score', () => {
    let state = inRound('ada', 'bob');
    state = reduceRoom(
      state,
      says('ada', { type: 'submit_answer', marked: [1, 3] }),
    ).state;
    const outcome = reduceRoom(
      state,
      says('bob', { type: 'submit_answer', marked: [2] }),
    );
    const end = broadcasts(outcome.effects).find(
      (message) => message.type === 'game_end',
    );
    expect(
      end?.type === 'game_end' ? end.leaderboard.map((row) => row.player) : [],
    ).toEqual(['bob', 'ada']);
  });

  it('clears ready so the lobby starts clean', () => {
    const state = inRound('ada');
    const outcome = reduceRoom(state, says('ada', { type: 'submit_answer', marked: [] }));
    expect(outcome.state.players.every((player) => !player.ready)).toBe(true);
  });
});

describe('D4 — the second way out: the clock runs out', () => {
  // The current server never enforces the end of a round: `time_limit` is
  // applied by the client alone, so a round nobody submits to stays open.
  it('ends the round on timer_expired', () => {
    const outcome = reduceRoom(inRound('ada', 'bob'), { kind: 'timer_expired' });
    expect(outcome.state.phase).toBe('lobby');
    expect(
      broadcasts(outcome.effects).some((message) => message.type === 'game_end'),
    ).toBe(true);
  });

  it('scores nothing for whoever did not submit', () => {
    const outcome = reduceRoom(inRound('ada', 'bob'), { kind: 'timer_expired' });
    const end = broadcasts(outcome.effects).find(
      (message) => message.type === 'game_end',
    );
    expect(end?.type === 'game_end' ? end.leaderboard : []).toEqual([
      { player: 'ada', colour: expect.any(String), score: 0, breakdown: null },
      { player: 'bob', colour: expect.any(String), score: 0, breakdown: null },
    ]);
  });

  it('keeps the score of whoever did submit', () => {
    const state = reduceRoom(
      inRound('ada', 'bob'),
      says('ada', { type: 'submit_answer', marked: [2] }),
    ).state;
    const outcome = reduceRoom(state, { kind: 'timer_expired' });
    const end = broadcasts(outcome.effects).find(
      (message) => message.type === 'game_end',
    );
    expect(end?.type === 'game_end' ? end.leaderboard[0]?.player : '').toBe('ada');
  });

  it('does nothing outside a round', () => {
    const lobby = run(joined('ada')).state;
    expect(reduceRoom(lobby, { kind: 'timer_expired' }).state).toBe(lobby);
  });
});

describe('D4 — the third way out: the last unsubmitted player is evicted', () => {
  // The current server waits for a player who is gone, and the room stays in
  // `playing` indefinitely.
  //
  // D5 changed which event this is. A dropped socket no longer ends anything —
  // the player may be back, and the round-end timer is what covers them if they
  // are not. What ends a round early is an **eviction**: the grace window ran
  // out, and they are gone for good.
  it('ends the round when the only one left has already submitted', () => {
    const state = reduceRoom(
      inRound('ada', 'bob'),
      says('ada', { type: 'submit_answer', marked: [2] }),
    ).state;
    const outcome = reduceRoom(state, { kind: 'evict', player: 'bob' });
    expect(outcome.state.phase).toBe('lobby');
    expect(
      broadcasts(outcome.effects).some((message) => message.type === 'game_end'),
    ).toBe(true);
  });

  it('keeps the round open while someone still has to submit', () => {
    const outcome = reduceRoom(inRound('ada', 'bob', 'cyd'), {
      kind: 'evict',
      player: 'cyd',
    });
    expect(outcome.state.phase).toBe('round');
  });

  it('closes the room when the last player is evicted mid-round', () => {
    const outcome = reduceRoom(inRound('ada'), { kind: 'evict', player: 'ada' });
    expect(outcome.effects).toEqual([{ kind: 'cancel_timer' }, { kind: 'close_room' }]);
  });

  // D5 — the exit gate of the phase, as a rule: a round survives one player's
  // network cut. The current server ends it, because the player is deleted.
  it('does not end the round on a dropped socket', () => {
    const state = reduceRoom(
      inRound('ada', 'bob'),
      says('ada', { type: 'submit_answer', marked: [2] }),
    ).state;
    const outcome = reduceRoom(state, { kind: 'leave', player: 'bob' });

    expect(outcome.state.phase).toBe('round');
    expect(
      broadcasts(outcome.effects).some((message) => message.type === 'game_end'),
    ).toBe(false);
    // And what bob had is still bob's, which is what makes coming back worth
    // anything.
    expect(outcome.state.players.map((player) => player.name)).toEqual(['ada', 'bob']);
  });

  it('keeps a submitted score through a disconnection and a reconnection', () => {
    const submitted = reduceRoom(
      inRound('ada', 'bob'),
      says('ada', { type: 'submit_answer', marked: [2] }),
    ).state;
    const dropped = reduceRoom(submitted, { kind: 'leave', player: 'ada' }).state;
    const back = reduceRoom(dropped, { kind: 'join', player: 'ada' }).state;

    const found = back.players.find((player) => player.name === 'ada');
    expect(found?.connected).toBe(true);
    expect(found?.answered).toBe(true);
    expect(found?.submission).not.toBeNull();
  });
});

describe('C3.7 — the article could not be produced', () => {
  it('tries the next candidate', () => {
    const generating = run([
      ...joined('ada'),
      says('ada', { type: 'force_start' }),
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
    ]).state;
    const outcome = reduceRoom(generating, { kind: 'article_failed' });
    expect(outcome.state.phase).toBe('generating');
    expect(outcome.effects.some((effect) => effect.kind === 'generate_article')).toBe(
      true,
    );
  });

  it('gives up with a code once the queue is empty', () => {
    const exhausted: RoomState = {
      ...run(joined('ada')).state,
      phase: 'generating',
      generating: { topic: 'Paris', proposer: 'ada', remaining: [] },
    };
    const outcome = reduceRoom(exhausted, { kind: 'article_failed' });
    expect(outcome.state.phase).toBe('lobby');
    expect(
      broadcasts(outcome.effects).some(
        (message) => message.type === 'error' && message.code === 'generation_failed',
      ),
    ).toBe(true);
  });
});
