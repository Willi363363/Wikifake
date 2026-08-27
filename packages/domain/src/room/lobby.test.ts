import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from '@wikifake/protocol';
import { serverMessages } from '@wikifake/protocol';

import { reduceRoom } from './reduce.js';
import type { RoomEvent } from './events.js';
import { broadcasts, joined, refusal, run, says } from './scenario.js';
import { emptyRoom, type RoomState } from './state.js';
import { FALLBACK_TOPICS, selectTopic } from './topics.js';

describe('C1.7 — the options belong to the host', () => {
  it('lets the host set them', () => {
    const { state } = run([
      ...joined('ada', 'bob'),
      says('ada', { type: 'set_ready', ready: true, withItems: false, timeLimit: 120 }),
    ]);
    expect(state.options).toEqual({ withItems: false, timeLimit: 120 });
  });

  // The client attaches the options to every `set_ready`, guest included, so
  // they are dropped rather than refused: answering an error to every guest's
  // ready would be noise, and their own `ready` is legitimate.
  it('takes a guest ready but ignores the options they attached', () => {
    const { state } = run([
      ...joined('ada', 'bob'),
      says('bob', { type: 'set_ready', ready: true, withItems: false, timeLimit: 30 }),
    ]);
    expect(state.options).toEqual({ withItems: true, timeLimit: 300 });
    expect(state.players.find((player) => player.name === 'bob')?.ready).toBe(true);
  });

  it('leaves an option the host did not mention alone', () => {
    const { state } = run([
      ...joined('ada'),
      says('ada', { type: 'set_ready', ready: true, timeLimit: 60 }),
    ]);
    expect(state.options).toEqual({ withItems: true, timeLimit: 60 });
  });
});

describe('D6 — the round length cannot change once a round is under way', () => {
  it('refuses set_ready during a round', () => {
    const inRound: RoomState = { ...run(joined('ada')).state, phase: 'round' };
    const outcome = reduceRoom(
      inRound,
      says('ada', { type: 'set_ready', ready: true, timeLimit: 600 }),
    );
    expect(refusal(outcome.effects)).toBe('out_of_phase');
    expect(outcome.state.options.timeLimit).toBe(300);
  });

  it('refuses it while an article is being generated', () => {
    const generating: RoomState = { ...run(joined('ada')).state, phase: 'generating' };
    const outcome = reduceRoom(
      generating,
      says('ada', { type: 'set_ready', ready: true, timeLimit: 600 }),
    );
    expect(refusal(outcome.effects)).toBe('out_of_phase');
  });
});

describe('C1.7 — host-only commands', () => {
  const lobby = run(joined('ada', 'bob')).state;

  it.each([
    [{ type: 'force_start' } as const],
    [{ type: 'start_game', topic: 'Paris' } as const],
  ])('refuses %j to a guest', (message) => {
    const outcome = reduceRoom(lobby, says('bob', message));
    expect(refusal(outcome.effects)).toBe('not_host');
  });

  // "without changing the room state" is the load-bearing half: the current
  // handler applies the options before it checks who sent the message.
  it('changes nothing at all when it refuses', () => {
    const outcome = reduceRoom(
      lobby,
      says('bob', { type: 'force_start', withItems: false, timeLimit: 30 }),
    );
    expect(outcome.state).toBe(lobby);
  });

  it('refuses force_pick to a guest', () => {
    const voting = reduceRoom(lobby, says('ada', { type: 'force_start' })).state;
    const withBallot = reduceRoom(
      voting,
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
    );
    const outcome = reduceRoom(withBallot.state, says('bob', { type: 'force_pick' }));
    expect(refusal(outcome.effects)).toBe('not_host');
    expect(outcome.state).toBe(withBallot.state);
  });

  it('lets the host open the vote', () => {
    const outcome = reduceRoom(lobby, says('ada', { type: 'force_start' }));
    expect(outcome.state.phase).toBe('voting');
    expect(broadcasts(outcome.effects)).toEqual([{ type: 'theme_vote_start' }]);
  });
});

describe('the topic vote', () => {
  const openVote = (...names: readonly string[]): RoomState =>
    reduceRoom(run(joined(...names)).state, says(names[0]!, { type: 'force_start' }))
      .state;

  it('reports who has voted, out of how many players', () => {
    const voting = openVote('ada', 'bob', 'cyd');
    const outcome = reduceRoom(
      voting,
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
    );
    expect(broadcasts(outcome.effects)).toEqual([
      { type: 'theme_vote_update', submitted: ['ada'], total: 3 },
    ]);
    expect(outcome.state.phase).toBe('voting');
  });

  it('picks a topic once everyone has voted', () => {
    let state = openVote('ada', 'bob');
    state = reduceRoom(
      state,
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
    ).state;
    const outcome = reduceRoom(
      state,
      says('bob', { type: 'submit_theme', topic: 'Lyon' }),
    );
    expect(outcome.state.phase).toBe('generating');
    expect(outcome.effects.some((effect) => effect.kind === 'generate_article')).toBe(
      true,
    );
  });

  it('announces the ballots with the chosen topic', () => {
    let state = openVote('ada', 'bob');
    state = reduceRoom(
      state,
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
    ).state;
    const outcome = reduceRoom(
      state,
      says('bob', { type: 'submit_theme', topic: 'Lyon' }),
    );
    const selected = broadcasts(outcome.effects).find(
      (message) => message.type === 'theme_selected',
    );
    expect(selected).toMatchObject({ ballots: { ada: 'Paris', bob: 'Lyon' } });
  });

  // The draw is a rule of the game — the fastest voter must not always win —
  // and the seed is what keeps it testable.
  it('follows the seed it was given', () => {
    const pick = (seed: number): string => {
      let state = openVote('ada', 'bob');
      state = reduceRoom(
        state,
        says('ada', { type: 'submit_theme', topic: 'Paris' }),
      ).state;
      const outcome = reduceRoom(
        state,
        says('bob', { type: 'submit_theme', topic: 'Lyon' }, seed),
      );
      return outcome.state.generating?.topic ?? '';
    };
    expect(pick(0)).toBe('Paris');
    expect(pick(1)).toBe('Lyon');
    expect(pick(2)).toBe('Paris');
  });

  it('counts a topic proposed twice once', () => {
    let state = openVote('ada', 'bob');
    state = reduceRoom(
      state,
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
    ).state;
    const outcome = reduceRoom(
      state,
      says('bob', { type: 'submit_theme', topic: 'Paris' }),
    );
    expect(outcome.state.generating?.topic).toBe('Paris');
    // One proposal, so the queue behind it is the fallback list — minus the
    // chosen topic, which happens to be the first fallback.
    expect(outcome.state.generating?.remaining).not.toContain('Paris');
    expect(outcome.state.generating?.remaining[0]).toBe(FALLBACK_TOPICS[1]);
  });

  it('never queues the chosen topic behind itself', () => {
    let state = openVote('ada', 'bob');
    state = reduceRoom(state, says('ada', { type: 'submit_theme', topic: 'Lyon' })).state;
    const outcome = reduceRoom(
      state,
      says('bob', { type: 'submit_theme', topic: 'Lyon' }),
    );
    expect(outcome.state.generating?.remaining).not.toContain('Lyon');
  });

  it('names the player who proposed the chosen topic', () => {
    let state = openVote('ada', 'bob');
    state = reduceRoom(
      state,
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
    ).state;
    const outcome = reduceRoom(
      state,
      says('bob', { type: 'submit_theme', topic: 'Lyon' }),
    );
    expect(outcome.state.generating?.proposer).toBe('ada');
  });

  it('queues the losing proposals ahead of the fallbacks', () => {
    let state = openVote('ada', 'bob');
    state = reduceRoom(
      state,
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
    ).state;
    const outcome = reduceRoom(
      state,
      says('bob', { type: 'submit_theme', topic: 'Lyon' }),
    );
    expect(outcome.state.generating?.remaining[0]).toBe('Lyon');
  });

  it('clears the ballots once a topic is chosen', () => {
    const state = openVote('ada');
    const outcome = reduceRoom(
      state,
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
    );
    expect(outcome.state.ballots).toEqual({});
  });

  it('refuses to close an empty vote', () => {
    const voting = openVote('ada', 'bob');
    const outcome = reduceRoom(voting, says('ada', { type: 'force_pick' }));
    expect(refusal(outcome.effects)).toBe('no_theme_submitted');
    expect(outcome.state).toBe(voting);
  });

  it('lets the host close a vote that has ballots', () => {
    const voting = openVote('ada', 'bob');
    const withBallot = reduceRoom(
      voting,
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
    );
    const outcome = reduceRoom(withBallot.state, says('ada', { type: 'force_pick' }));
    expect(outcome.state.phase).toBe('generating');
    expect(outcome.state.generating?.topic).toBe('Paris');
  });

  // Not reachable through the lobby — `submit_theme` always adds a ballot and
  // `force_pick` refuses an empty box — but step 1.9 gets here when every
  // proposal fails to yield an article.
  it('falls back to its own list when there is no ballot at all', () => {
    const outcome = selectTopic(openVote('ada'), 0);
    expect(outcome.state.generating?.topic).toBe(FALLBACK_TOPICS[0]);
    expect(outcome.state.generating?.proposer).toBe(null);
  });
});

describe('starting straight on a topic', () => {
  it('goes to generating with the host as proposer', () => {
    const lobby = run(joined('ada')).state;
    const outcome = reduceRoom(
      lobby,
      says('ada', { type: 'start_game', topic: 'Paris' }),
    );
    expect(outcome.state.phase).toBe('generating');
    expect(outcome.state.generating).toMatchObject({ topic: 'Paris', proposer: 'ada' });
    expect(outcome.effects).toEqual([{ kind: 'generate_article', topic: 'Paris' }]);
  });

  it('applies the options it carries', () => {
    const lobby = run(joined('ada')).state;
    const outcome = reduceRoom(
      lobby,
      says('ada', {
        type: 'start_game',
        topic: 'Paris',
        withItems: false,
        timeLimit: 60,
      }),
    );
    expect(outcome.state.options).toEqual({ withItems: false, timeLimit: 60 });
  });
});

describe('guards answer instead of going quiet', () => {
  const lobby = run(joined('ada')).state;

  // The current handlers `return` on a phase mismatch, so the client is told
  // nothing and waits for a reply that never comes.
  it.each([
    [{ type: 'submit_theme', topic: 'Paris' } as const],
    [{ type: 'force_pick' } as const],
  ])('refuses %j outside a vote', (message) => {
    expect(refusal(reduceRoom(lobby, says('ada', message)).effects)).toBe('out_of_phase');
  });

  const ROUND_MESSAGES: IncomingMessage[] = [
    { type: 'live_score', score: 10 },
    { type: 'cursor', x: 0.5, y: 0.5 },
    { type: 'submit_answer', marked: [1] },
    { type: 'unsubmit_answer' },
    { type: 'unlock_hint', falseInfoNumber: 1, level: 1 },
    { type: 'use_item', instanceId: 'i', targets: [], marked: [] },
  ];

  it.each(ROUND_MESSAGES)('refuses the round message %j in the lobby', (message) => {
    expect(refusal(reduceRoom(lobby, says('ada', message)).effects)).toBe('out_of_phase');
  });

  it('refuses force_start once the vote is open', () => {
    const voting = reduceRoom(lobby, says('ada', { type: 'force_start' })).state;
    expect(
      refusal(reduceRoom(voting, says('ada', { type: 'force_start' })).effects),
    ).toBe('out_of_phase');
  });

  // The current handlers index `room.players[player_name]` directly, so a
  // message arriving just after a departure raises a KeyError.
  it('refuses a message from someone who is not in the room', () => {
    expect(refusal(reduceRoom(lobby, says('zoe', { type: 'get_lobby' })).effects)).toBe(
      'room_not_found',
    );
  });
});

describe('the chat works in every phase', () => {
  it.each([['lobby'], ['voting'], ['generating'], ['round']] as const)(
    'in %s',
    (phase) => {
      const state: RoomState = { ...run(joined('ada')).state, phase };
      const outcome = reduceRoom(
        state,
        says('ada', { type: 'chat_message', content: 'bien joué' }),
      );
      expect(broadcasts(outcome.effects)).toEqual([
        { type: 'chat_message', sender: 'ada', content: 'bien joué' },
      ]);
    },
  );
});

describe('every broadcast is a real protocol message', () => {
  it('validates the messages a whole lobby run emits', () => {
    const script: RoomEvent[] = [
      ...joined('ada', 'bob'),
      says('ada', { type: 'set_ready', ready: true }),
      says('ada', { type: 'force_start' }),
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
      says('bob', { type: 'submit_theme', topic: 'Lyon' }),
    ];
    let state = emptyRoom();
    for (const event of script) {
      const outcome = reduceRoom(state, event);
      state = outcome.state;
      for (const effect of outcome.effects) {
        if (effect.kind === 'broadcast' || effect.kind === 'send') {
          expect(
            serverMessages.outgoingMessage.safeParse(effect.message).success,
            JSON.stringify(effect.message),
          ).toBe(true);
        }
      }
    }
  });
});
