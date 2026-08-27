/** @vitest-environment jsdom */

// C1.2, C6.1 — the debrief.
//
// The done-when is "slowing the animation down no longer desynchronises the
// reveal", and that is one test: run the ranking on a schedule ten times longer
// and assert the statistics still appear after the last stage and not before.
// It fails against the current design by construction, because there the two
// durations are two numbers that happen to agree.
import { act, cleanup, render, screen } from '@testing-library/react';
import type { FalsifiedPosition, ScoreBreakdown } from '@wikifake/protocol';
import { PER_FALSE_POSITIVE, PER_TRUE_POSITIVE } from '@wikifake/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Debrief } from './panel.js';
import { AnimatedRanking, type FinalStanding } from './ranking.js';
import {
  accuracyOf,
  durationOf,
  gradeFor,
  scoreAtStage,
  STAGES,
  type Stage,
} from './stages.js';
import { verdictsFor } from '../verdicts.js';

const BREAKDOWN: ScoreBreakdown = {
  truePositives: 2,
  falsePositives: 1,
  hintsUsed: 1,
  hintPenalty: 50,
  scoreStolen: 0,
  timeBonus: 40,
};

const SOLUTION: readonly FalsifiedPosition[] = [
  {
    paragraphIndex: 1,
    falseInfoNumber: 1,
    falseStatement: 'Le chat dort seize heures par jour.',
    explanation: 'Il en dort douze.',
    hint: 'Regardez la durée.',
  },
  {
    paragraphIndex: 3,
    falseInfoNumber: 2,
    falseStatement: 'Il ronronne en inspirant.',
    explanation: 'En expirant.',
    hint: 'Le sens compte.',
  },
];

const STANDINGS: readonly FinalStanding[] = [
  { name: 'ada', colour: '#e63946', breakdown: BREAKDOWN, you: true },
  { name: 'bob', colour: '#457b9d', breakdown: null, you: false },
];

/** The same five stages, ten times slower. */
const SLOW: readonly Stage[] = STAGES.map((stage) => ({
  ...stage,
  holds: stage.holds * 10,
}));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('8.7 — the sequence, as arithmetic', () => {
  it('takes as long as its stages say', () => {
    // The current debrief waits 5,400 ms for a sequence of 5,100. Derived, the
    // two cannot disagree.
    expect(durationOf()).toBe(5100);
    expect(durationOf(SLOW)).toBe(51_000);
  });

  it('adds nothing up before it starts', () => {
    expect(scoreAtStage(BREAKDOWN, 0)).toBe(0);
  });

  it('builds the score one stage at a time', () => {
    expect(scoreAtStage(BREAKDOWN, 1)).toBe(2 * PER_TRUE_POSITIVE);
    expect(scoreAtStage(BREAKDOWN, 2)).toBe(2 * PER_TRUE_POSITIVE - PER_FALSE_POSITIVE);
    expect(scoreAtStage(BREAKDOWN, 3)).toBe(
      2 * PER_TRUE_POSITIVE - PER_FALSE_POSITIVE - 50,
    );
    expect(scoreAtStage(BREAKDOWN, 4)).toBe(
      2 * PER_TRUE_POSITIVE - PER_FALSE_POSITIVE - 50 + 40,
    );
  });

  it('counts what was stolen against you, with the hints', () => {
    // C1.5 — a rival's `SCORE_STEAL`. The current stage sequence has no place
    // for it at all, so the tally ended on a different number from the score.
    const robbed: ScoreBreakdown = { ...BREAKDOWN, scoreStolen: 50 };
    expect(scoreAtStage(robbed, 3)).toBe(scoreAtStage(BREAKDOWN, 3) - 50);
  });

  it('scores accuracy on both kinds of mistake', () => {
    expect(accuracyOf({ ...BREAKDOWN, truePositives: 2, falsePositives: 0 }, 2)).toBe(1);
    // Marking everything, and marking nothing, are both punished.
    expect(
      accuracyOf({ ...BREAKDOWN, truePositives: 2, falsePositives: 8 }, 2),
    ).toBeLessThan(0.5);
    expect(accuracyOf({ ...BREAKDOWN, truePositives: 0, falsePositives: 0 }, 2)).toBe(0);
  });

  it('grades the four bands', () => {
    expect(gradeFor(1).label).toBe('Outstanding');
    expect(gradeFor(0.8).label).toBe('Strong');
    expect(gradeFor(0.6).label).toBe('Promising');
    expect(gradeFor(0.2).label).toBe('Taken in');
    expect(gradeFor(null).label).toBe('Taken in');
  });
});

describe('8.7 — the ranking announces its own end', () => {
  it('says nothing until the last stage has landed', () => {
    const finished = vi.fn();
    render(<AnimatedRanking standings={STANDINGS} onFinished={finished} />);

    advance(durationOf() - 100);
    expect(finished).not.toHaveBeenCalled();

    advance(200);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  // The done-when. Ten times slower, and the signal still lands with the last
  // stage rather than at a time anybody wrote down.
  it('says it at the end however long the end takes', () => {
    const finished = vi.fn();
    render(<AnimatedRanking standings={STANDINGS} stages={SLOW} onFinished={finished} />);

    // Past where the default schedule would have ended, and past the 5,400 ms
    // the current debrief waits.
    advance(6000);
    expect(finished).not.toHaveBeenCalled();

    advance(durationOf(SLOW));
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it('climbs, and re-sorts as it climbs', () => {
    const chasing: readonly FinalStanding[] = [
      {
        name: 'ada',
        colour: '#e63946',
        breakdown: { ...BREAKDOWN, truePositives: 3, falsePositives: 4, timeBonus: 0 },
        you: true,
      },
      {
        name: 'bob',
        colour: '#457b9d',
        breakdown: { ...BREAKDOWN, truePositives: 2, falsePositives: 0, timeBonus: 0 },
        you: false,
      },
    ];
    render(<AnimatedRanking standings={chasing} onFinished={vi.fn()} />);

    // Ada leads on corrections…
    advance(900);
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('ada');

    // …and loses it on penalties, which is the point of showing the stages.
    advance(1400);
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('bob');
  });

  it('says who never submitted rather than scoring them at zero silently', () => {
    render(<AnimatedRanking standings={STANDINGS} onFinished={vi.fn()} />);
    expect(screen.getByText(/did not submit/)).not.toBeNull();
  });

  it('leaves no timer behind when it is unmounted', () => {
    const { unmount } = render(
      <AnimatedRanking standings={STANDINGS} onFinished={vi.fn()} />,
    );
    unmount();
    advance(60_000);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('8.7 — the panel', () => {
  const paint = (stages?: readonly Stage[]) =>
    render(
      <Debrief
        breakdown={BREAKDOWN}
        score={330}
        totalFakes={2}
        solution={SOLUTION}
        standings={STANDINGS}
        {...(stages === undefined ? {} : { stages })}
        onwardLabel="Play again"
        onOnward={vi.fn()}
      />,
    );

  it('holds the statistics back until the ranking is done', () => {
    paint();
    expect(screen.queryByText('330')).toBeNull();

    advance(durationOf() + 100);
    expect(screen.getByText('330')).not.toBeNull();
  });

  // The done-when, from the other side: the panel waits on the signal, not on a
  // duration, so stretching the animation stretches the wait.
  it('waits longer when the ranking takes longer', () => {
    paint(SLOW);

    // Where the current debrief would have revealed: 5,400 ms.
    advance(5400);
    expect(screen.queryByText('330')).toBeNull();

    advance(durationOf(SLOW));
    expect(screen.getByText('330')).not.toBeNull();
  });

  it('keeps the solution off the screen until then', () => {
    // C1.2 — this is the only place any of it appears, and this is the first
    // moment it is on the client at all.
    paint();
    expect(screen.queryByText(/Il en dort douze/)).toBeNull();

    advance(durationOf() + 100);
    expect(screen.getByText(/Il en dort douze/)).not.toBeNull();
    expect(screen.getByText(/En expirant/)).not.toBeNull();
  });

  it('lists every falsification, with where it was', () => {
    paint();
    advance(durationOf() + 100);

    expect(screen.getByText('paragraph 1')).not.toBeNull();
    expect(screen.getByText('paragraph 3')).not.toBeNull();
  });

  it('shows the breakdown the server decided, deductions signed', () => {
    paint();
    advance(durationOf() + 100);

    expect(screen.getByText('Found').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Wrongly marked').nextElementSibling?.textContent).toBe('−1');
    expect(screen.getByText('Let through').nextElementSibling?.textContent).toBe('0');
  });

  it('grades the round', () => {
    paint();
    advance(durationOf() + 100);
    expect(screen.getByText('Strong')).not.toBeNull();
  });

  it('offers the way onward only once there is one', () => {
    paint();
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull();

    advance(durationOf() + 100);
    expect(screen.getByRole('button', { name: 'Play again' })).not.toBeNull();
  });
});

describe('8.7 — the verdicts', () => {
  it('marks what was found, what was let through, and what was invented', () => {
    const verdicts = verdictsFor(SOLUTION, [1, 2]);

    expect(verdicts.get(1)).toBe('found');
    expect(verdicts.get(2)).toBe('false-positive');
    expect(verdicts.get(3)).toBe('missed');
  });

  it('says nothing about a paragraph nobody touched', () => {
    expect(verdictsFor(SOLUTION, [1]).has(4)).toBe(false);
  });

  it('has nothing to say before there is a solution', () => {
    expect(verdictsFor([], [1, 2]).get(1)).toBe('false-positive');
    expect(verdictsFor([], []).size).toBe(0);
  });
});
