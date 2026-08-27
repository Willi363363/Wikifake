import { describe, expect, it } from 'vitest';
import type { ArticleView, FalsifiedPosition, OutgoingMessage } from '@wikifake/protocol';
import { serverMessages } from '@wikifake/protocol';

import { HINT_BLOCK_SECONDS } from '../items.js';
import type { RoomEvent } from './events.js';
import { reduceRoom } from './reduce.js';
import { broadcasts, joined, refusal, run, says } from './scenario.js';
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

/** The round begins at the epoch, so a message stamped `at` is `at` seconds in. */
const STARTED_AT = 0;

const READY: RoomEvent = {
  kind: 'article_ready',
  article: ARTICLE,
  solution: SOLUTION,
  startedAt: STARTED_AT,
};

/** A room in a round, started through the topic vote. */
function inRound(...names: readonly string[]): RoomState {
  const events: RoomEvent[] = [
    ...joined(...names),
    says(names[0]!, { type: 'force_start' }),
    ...names.map((name) => says(name, { type: 'submit_theme', topic: 'Paris' })),
    READY,
  ];
  return run(events).state;
}

function sent(effects: readonly { kind: string }[], type: string): OutgoingMessage[] {
  return effects
    .filter(
      (effect): effect is { kind: 'send'; to: string; message: OutgoingMessage } =>
        effect.kind === 'send',
    )
    .map((effect) => effect.message)
    .filter((message) => message.type === type);
}

describe('spending an item', () => {
  const withHand = (state: RoomState, name: string, itemId: string): RoomState => ({
    ...state,
    players: state.players.map((player) =>
      player.name === name
        ? { ...player, hand: [{ instanceId: 'i1', itemId: itemId as 'BLUR' }] }
        : player,
    ),
  });

  it('announces it, tells the target, and empties the hand', () => {
    const state = withHand(inRound('ada', 'bob'), 'ada', 'BLUR');
    const outcome = reduceRoom(
      state,
      says('ada', { type: 'use_item', instanceId: 'i1', targets: ['bob'], marked: [] }),
    );
    expect(broadcasts(outcome.effects)).toContainEqual({
      type: 'item_used',
      player: 'ada',
      itemId: 'BLUR',
      targets: ['bob'],
    });
    expect(sent(outcome.effects, 'item_effect')).toEqual([
      { type: 'item_effect', itemId: 'BLUR', from: 'ada' },
    ]);
    expect(outcome.state.players.find((player) => player.name === 'ada')?.hand).toEqual(
      [],
    );
  });

  it('C1.5 — SCORE_STEAL is applied server-side', () => {
    const state = withHand(inRound('ada', 'bob'), 'ada', 'SCORE_STEAL');
    const outcome = reduceRoom(
      state,
      says('ada', { type: 'use_item', instanceId: 'i1', targets: ['bob'], marked: [] }),
    );
    expect(
      outcome.state.players.find((player) => player.name === 'bob')?.items.scoreStolen,
    ).toBe(50);
  });

  it('C1.6 — SCANNER answers the caster with a paragraph', () => {
    const state = withHand(inRound('ada', 'bob'), 'ada', 'SCANNER');
    const outcome = reduceRoom(
      state,
      says('ada', { type: 'use_item', instanceId: 'i1', targets: [], marked: [] }),
    );
    expect(sent(outcome.effects, 'scanner_result')).toEqual([
      { type: 'scanner_result', paragraphIndex: 2 },
    ]);
  });

  it('refuses an instance the player does not hold', () => {
    const outcome = reduceRoom(
      inRound('ada', 'bob'),
      says('ada', {
        type: 'use_item',
        instanceId: 'ghost',
        targets: ['bob'],
        marked: [],
      }),
    );
    expect(refusal(outcome.effects)).toBe('item_not_held');
  });

  it('D6 — refuses the caster targeting themselves', () => {
    const state = withHand(inRound('ada', 'bob'), 'ada', 'BLUR');
    const outcome = reduceRoom(
      state,
      says('ada', { type: 'use_item', instanceId: 'i1', targets: ['ada'], marked: [] }),
    );
    expect(refusal(outcome.effects)).toBe('invalid_target');
    expect(
      outcome.state.players.find((player) => player.name === 'ada')?.hand,
    ).toHaveLength(1);
  });
});

describe('buying a hint during a round', () => {
  it('sends the hint to the buyer alone', () => {
    const outcome = reduceRoom(
      inRound('ada', 'bob'),
      says('ada', { type: 'unlock_hint', falseInfoNumber: 1, level: 1 }),
    );
    const hints = sent(outcome.effects, 'hint_unlocked');
    expect(hints).toHaveLength(1);
    expect(JSON.stringify(hints)).toContain('Vérifiez le nombre');
    expect(JSON.stringify(hints)).not.toContain('vingt arrondissements');
  });

  it('C1.5 — refuses while HINT_LOCK is in effect, and bills nothing', () => {
    const jammed: RoomState = (() => {
      const state = inRound('ada', 'bob');
      return {
        ...state,
        players: state.players.map((player) =>
          player.name === 'ada'
            ? {
                ...player,
                items: { ...player.items, hintsBlockedUntil: HINT_BLOCK_SECONDS },
              }
            : player,
        ),
      };
    })();
    const outcome = reduceRoom(
      jammed,
      says('ada', { type: 'unlock_hint', falseInfoNumber: 1, level: 2 }),
    );
    expect(refusal(outcome.effects)).toBe('hints_blocked');
    expect(outcome.state.players.find((player) => player.name === 'ada')?.hints).toEqual(
      {},
    );
  });

  it('refuses a falsification that does not exist', () => {
    const outcome = reduceRoom(
      inRound('ada'),
      says('ada', { type: 'unlock_hint', falseInfoNumber: 9, level: 1 }),
    );
    expect(refusal(outcome.effects)).toBe('hint_not_found');
  });
});

describe('relays', () => {
  it('broadcasts a live score', () => {
    const outcome = reduceRoom(
      inRound('ada', 'bob'),
      says('ada', { type: 'live_score', score: 150 }),
    );
    expect(broadcasts(outcome.effects)).toEqual([
      { type: 'live_score_update', player: 'ada', score: 150 },
    ]);
  });

  it('sends a cursor to everyone but its owner', () => {
    const outcome = reduceRoom(
      inRound('ada', 'bob', 'cyd'),
      says('ada', { type: 'cursor', x: 0.5, y: 0.25 }),
    );
    expect(outcome.effects).toEqual([
      {
        kind: 'send',
        to: 'bob',
        message: { type: 'cursor_update', player: 'ada', x: 0.5, y: 0.25 },
      },
      {
        kind: 'send',
        to: 'cyd',
        message: { type: 'cursor_update', player: 'ada', x: 0.5, y: 0.25 },
      },
    ]);
  });
});

describe('every message a round emits is a real protocol message', () => {
  it('validates a whole round, start to debrief', () => {
    const script: RoomEvent[] = [
      ...joined('ada', 'bob'),
      says('ada', { type: 'force_start' }),
      says('ada', { type: 'submit_theme', topic: 'Paris' }),
      says('bob', { type: 'submit_theme', topic: 'Lyon' }),
      READY,
      {
        kind: 'items_granted',
        wave: 1,
        grants: { ada: { instanceId: 'i1', itemId: 'SCANNER' } },
      },
      says('ada', { type: 'use_item', instanceId: 'i1', targets: [], marked: [] }),
      says('ada', { type: 'unlock_hint', falseInfoNumber: 1, level: 2 }),
      says('ada', { type: 'live_score', score: 10 }),
      says('ada', { type: 'cursor', x: 0.1, y: 0.2 }),
      says('ada', { type: 'submit_answer', marked: [2] }),
      says('bob', { type: 'submit_answer', marked: [1] }),
    ];

    let state = run([]).state;
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
    expect(state.phase).toBe('lobby');
  });
});

// The round clock. Until step 5.8 nothing stamped a message, so `elapsed` was
// always zero: a `HINT_LOCK` blocked its target for ever, and every player was
// paid a time bonus as though they had answered instantly.
describe('the clock the round is decided against', () => {
  it('lets a jammed player buy again once the block has run out', () => {
    const jammed = (() => {
      const state = inRound('ada', 'bob');
      return {
        ...state,
        players: state.players.map((player) =>
          player.name === 'ada'
            ? {
                ...player,
                items: { ...player.items, hintsBlockedUntil: HINT_BLOCK_SECONDS },
              }
            : player,
        ),
      };
    })();

    const early = reduceRoom(
      jammed,
      says('ada', { type: 'unlock_hint', falseInfoNumber: 1, level: 1 }, 0, 1000),
    );
    expect(refusal(early.effects)).toBe('hints_blocked');

    // The same message, the same state, twenty seconds later.
    const later = reduceRoom(
      jammed,
      says(
        'ada',
        { type: 'unlock_hint', falseInfoNumber: 1, level: 1 },
        0,
        HINT_BLOCK_SECONDS * 1000,
      ),
    );
    expect(refusal(later.effects)).toBeNull();
    expect(sent(later.effects, 'hint_unlocked')).toHaveLength(1);
  });

  it('pays the time bonus for the time that actually passed', () => {
    const state = inRound('ada');
    const limit = state.options.timeLimit;

    const instant = reduceRoom(state, says('ada', { type: 'submit_answer', marked: [] }));
    const hundred = reduceRoom(
      state,
      says('ada', { type: 'submit_answer', marked: [] }, 0, 100_000),
    );

    const bonusOf = (outcome: { state: RoomState }): number | undefined =>
      outcome.state.players.find((player) => player.name === 'ada')?.submission?.breakdown
        .timeBonus;

    // C2.1 — half a point per second left, truncated.
    expect(bonusOf(instant)).toBe(Math.floor(limit * 0.5));
    expect(bonusOf(hundred)).toBe(Math.floor((limit - 100) * 0.5));
  });

  // A message stamped before the round began is clock skew between instances,
  // not a player who has been playing for minus three seconds.
  it('never runs backwards', () => {
    const state = inRound('ada');
    const outcome = reduceRoom(
      state,
      says('ada', { type: 'submit_answer', marked: [] }, 0, -5000),
    );

    const bonus = outcome.state.players[0]?.submission?.breakdown.timeBonus;
    expect(bonus).toBe(Math.floor(state.options.timeLimit * 0.5));
  });
});
