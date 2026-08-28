/** @vitest-environment jsdom */

// C2.4, D6 — the live ranking.
//
// The done-when is "four players see the same order", and the interesting half of
// that is ties: everyone starts on nothing and the scale moves in steps of 150,
// so four clients receiving the same numbers in four different orders would
// produce four different rankings if score were the only key.
import { act, cleanup, screen } from '@testing-library/react';
import { render } from '../i18n/testing.js';
import { PER_TRUE_POSITIVE } from '@wikifake/domain';
import { afterEach, describe, expect, it } from 'vitest';
import userEvent from '@testing-library/user-event';

import {
  optimisticScore,
  ranked,
  useLiveScores,
  type LiveScoresState,
  type Standing,
} from './leaderboard.js';
import { LiveRanking } from './live-ranking.js';

const ROSTER = [
  { name: 'ada', colour: '#e63946' },
  { name: 'bob', colour: '#457b9d' },
  { name: 'cleo', colour: '#2a9d8f' },
  { name: 'dee', colour: '#e9c46a' },
];

afterEach(() => {
  cleanup();
});

describe('8.6 — the score a player broadcasts', () => {
  it('counts every mark as correct', () => {
    // Deliberately: a live score that reflected which marks were right would be
    // the answer key, published to the room five times a second.
    expect(optimisticScore(2, 0)).toBe(2 * PER_TRUE_POSITIVE);
  });

  it('subtracts what the hints cost', () => {
    // Not a secret: the player paid it.
    expect(optimisticScore(1, 50)).toBe(PER_TRUE_POSITIVE - 50);
  });

  it('can go below nothing', () => {
    expect(optimisticScore(0, 200)).toBe(-200);
  });
});

describe('8.6 — the order four clients agree on', () => {
  it('ranks by descending score', () => {
    const order = ranked(ROSTER, { ada: 150, bob: 450, cleo: 300 }, 'ada');
    expect(order.map((each) => each.name)).toEqual(['bob', 'cleo', 'ada', 'dee']);
  });

  // The done-when. Four clients hold the same scores in four different orders —
  // whichever order the updates happened to arrive in — and must produce one
  // ranking.
  it('produces one order however the scores arrived', () => {
    const scores = { ada: 300, bob: 300, cleo: 300, dee: 0 };
    const shuffles = [
      ['ada', 'bob', 'cleo', 'dee'],
      ['dee', 'cleo', 'bob', 'ada'],
      ['cleo', 'ada', 'dee', 'bob'],
      ['bob', 'dee', 'ada', 'cleo'],
    ];

    /** The roster in a given order, which is all a client is guaranteed. */
    const rosterIn = (names: readonly string[]) =>
      names.flatMap((name) => ROSTER.filter((each) => each.name === name));

    const orders = shuffles.map((names) =>
      ranked(rosterIn(names), scores, 'ada').map((each) => each.name),
    );

    expect(new Set(orders.map((order) => order.join(','))).size).toBe(1);
    expect(orders[0]).toEqual(['ada', 'bob', 'cleo', 'dee']);
  });

  it('lists a player who has sent nothing, on nothing', () => {
    // A player missing from the list until they tick something reads as a player
    // who is not in the room.
    const order = ranked(ROSTER, { bob: 150 }, 'ada');
    expect(order).toHaveLength(4);
    expect(order.find((each) => each.name === 'ada')?.score).toBe(0);
  });

  it('says which one is you', () => {
    const order = ranked(ROSTER, {}, 'cleo');
    expect(order.filter((each) => each.you).map((each) => each.name)).toEqual(['cleo']);
  });

  it('says nobody is you when nobody is', () => {
    expect(ranked(ROSTER, {}, null).some((each) => each.you)).toBe(false);
  });

  it('keeps a negative score in its place', () => {
    const order = ranked(ROSTER, { ada: -200, bob: 0 }, 'ada');
    expect(order.at(-1)?.name).toBe('ada');
  });
});

describe('8.6 — the scores of a round', () => {
  function mount(key: string) {
    const box: { held: LiveScoresState | null } = { held: null };
    function Host({ round }: { round: string }) {
      box.held = useLiveScores(round);
      return null;
    }
    const view = render(<Host round={key} />);
    const state = (): LiveScoresState => {
      const found = box.held;
      if (found === null) throw new Error('the hook did not run');
      return found;
    };
    return {
      state,
      rerender: (next: string) => {
        view.rerender(<Host round={next} />);
      },
    };
  }

  it('records what each player reported', () => {
    const { state } = mount('round-1');
    act(() => {
      state().report('bob', 300);
    });
    expect(state().scores).toEqual({ bob: 300 });
  });

  it('keeps the same object when a score has not moved', () => {
    // `live_score_update` arrives five times a second whether or not the number
    // changed. Rebuilding the map each time re-renders the whole ranking.
    const { state } = mount('round-1');
    act(() => {
      state().report('bob', 300);
    });
    const before = state().scores;

    act(() => {
      state().report('bob', 300);
    });
    expect(state().scores).toBe(before);
  });

  it('starts everyone back at nothing for a new round', () => {
    const { state, rerender } = mount('round-1');
    act(() => {
      state().report('bob', 300);
    });

    rerender('round-2');
    expect(state().scores).toEqual({});
  });
});

describe('8.6 — the ranking on screen', () => {
  const standings: readonly Standing[] = [
    { name: 'bob', colour: '#457b9d', score: 450, you: false },
    { name: 'ada', colour: '#e63946', score: 150, you: true },
  ];

  it('is not there when there is nobody to rank against', () => {
    const { container } = render(<LiveRanking standings={[standings[1] as Standing]} />);
    expect(container.textContent).toBe('');
  });

  it('shows the leader while it is shut', () => {
    render(<LiveRanking standings={standings} />);
    expect(screen.getByText('bob')).not.toBeNull();
    expect(screen.getByText('450')).not.toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('opens from a keyboard, because it is a button', async () => {
    // The current one expands on `onMouseEnter` and collapses on
    // `onMouseLeave`, which no keyboard can do and no touch screen has.
    const user = userEvent.setup();
    render(<LiveRanking standings={standings} />);

    await user.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('list')).not.toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('lists them in the order it was given, and marks you', async () => {
    const user = userEvent.setup();
    render(<LiveRanking standings={standings} />);
    await user.click(screen.getByRole('button'));

    const rows = screen.getAllByRole('listitem').map((each) => each.textContent);
    expect(rows[0]).toContain('bob');
    expect(rows[1]).toContain('ada');
    expect(rows[1]).toContain('you');
  });

  it('measures each bar against the leader', async () => {
    const user = userEvent.setup();
    render(<LiveRanking standings={standings} />);
    await user.click(screen.getByRole('button'));

    // "How far behind", rather than "how close to a number nobody knows".
    const bar = screen.getByRole('progressbar', { name: 'ada: 150' });
    expect(bar.getAttribute('aria-valuemax')).toBe('450');
    expect(bar.getAttribute('aria-valuenow')).toBe('150');
  });

  it('shows a negative score without drawing a negative bar', async () => {
    const user = userEvent.setup();
    render(
      <LiveRanking
        standings={[
          standings[0] as Standing,
          { name: 'ada', colour: '#e63946', score: -200, you: true },
        ]}
      />,
    );
    await user.click(screen.getByRole('button'));

    expect(screen.getByText('-200')).not.toBeNull();
    expect(
      screen
        .getByRole('progressbar', { name: 'ada: -200' })
        .getAttribute('aria-valuenow'),
    ).toBe('0');
  });
});
