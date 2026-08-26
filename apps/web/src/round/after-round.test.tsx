/** @vitest-environment jsdom */

// What the round looks like once it is over, and what a flag does either side of
// that line.
//
// Split from `round.test.tsx` when it crossed the 500-line cap. The debrief's own
// sequencing is `debrief/debrief.test.tsx`; the flag chain is
// `../flags/flags.test.tsx`. What is asserted here is what the round does with
// them: the attribution that has to survive the end (C6.1), the verdicts drawn on
// the article, and the flag button that stops being offered.
import { act, cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ARTICLE, paintRound as paint } from './testing.js';

afterEach(() => {
  cleanup();
});

// Step 8.7 — C6.1's second half, and the verdicts on the article.
describe('8.7 — after the round', () => {
  const SOLUTION = [
    {
      paragraphIndex: 1,
      falseInfoNumber: 1,
      falseStatement: ARTICLE.paragraphs[0] ?? '',
      explanation: 'Il en dort douze.',
      hint: 'Regardez la durée.',
    },
  ];

  const BREAKDOWN = {
    truePositives: 1,
    falsePositives: 1,
    hintsUsed: 0,
    hintPenalty: 0,
    scoreStolen: 0,
    timeBonus: 0,
  };

  const withDebrief = () =>
    paint({
      submitted: true,
      debrief: {
        score: 70,
        breakdown: BREAKDOWN,
        solution: SOLUTION,
        standings: [{ name: 'ada', colour: '#e63946', breakdown: BREAKDOWN, you: true }],
        onwardLabel: 'Play again',
        onOnward: vi.fn(),
      },
    });

  // C6.1 — "during **and** after the round". The current debrief is a fixed
  // full-screen modal, which covers the attribution entirely.
  it('keeps the attribution on screen', () => {
    withDebrief();

    expect(screen.getByRole('region', { name: 'Debrief' })).not.toBeNull();
    expect(screen.getByText(/Text deliberately modified/)).not.toBeNull();
    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).not.toBeNull();
    expect(screen.getByRole('link', { name: '“Chat”' }).getAttribute('href')).toBe(
      ARTICLE.wikipediaUrl,
    );
  });

  it('keeps the article on screen, with its verdicts', () => {
    withDebrief();

    // Nothing was marked here, so the one falsification is a miss and the rest
    // have nothing to say.
    const marks = screen
      .getAllByText(new RegExp(`^(${ARTICLE.paragraphs.join('|')})`))
      .map((each) => each.getAttribute('data-state'));
    expect(marks).toEqual(['missed', 'idle', 'idle']);
  });

  it('stops the clock', () => {
    vi.useFakeTimers();
    try {
      withDebrief();
      const before = screen.getByRole('timer').textContent;
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.getByRole('timer').textContent).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('takes the paragraphs out of play', () => {
    withDebrief();
    // A verdict is not an action: the primitive renders a paragraph rather than
    // a button, because a control that looks pressable and does nothing is worse
    // than one that does not.
    expect(
      screen.queryByRole('button', { name: new RegExp(ARTICLE.paragraphs[0] ?? 'x') }),
    ).toBeNull();
  });
});

// Step 8.8 — where the two phases of a flag sit in the round.
describe('8.8 — flagging a real error', () => {
  const noFlags = () => ({ captures: [], capture: vi.fn(), drop: vi.fn() });

  it('offers it during the round', () => {
    paint({ flags: noFlags() });
    expect(screen.getByRole('button', { name: /^Report an error/ })).not.toBeNull();
  });

  it('offers nothing where there is nowhere to send one', () => {
    paint();
    expect(screen.queryByRole('button', { name: /^Report an error/ })).toBeNull();
  });

  it('counts what has been flagged so far', () => {
    paint({
      flags: {
        captures: [
          { id: 'f1', paragraphIndex: 1, paragraphText: 'x', quickNote: '' },
          { id: 'f2', paragraphIndex: 2, paragraphText: 'y', quickNote: '' },
        ],
        capture: vi.fn(),
        drop: vi.fn(),
      },
    });
    expect(
      screen.getByRole('button', { name: /^Report an error/ }).textContent,
    ).toContain('2');
  });

  it('stops offering it once the round is over', () => {
    // Reporting a real error is not something to do to an article that is
    // already being explained.
    paint({
      flags: noFlags(),
      submitted: true,
      debrief: {
        score: 0,
        breakdown: {
          truePositives: 0,
          falsePositives: 0,
          hintsUsed: 0,
          hintPenalty: 0,
          scoreStolen: 0,
          timeBonus: 0,
        },
        solution: [
          {
            paragraphIndex: 1,
            falseInfoNumber: 1,
            falseStatement: ARTICLE.paragraphs[0] ?? '',
            explanation: 'Il en dort douze.',
            hint: 'Regardez la durée.',
          },
        ],
        standings: [],
        onwardLabel: 'Play again',
        onOnward: vi.fn(),
      },
    });

    expect(screen.queryByRole('button', { name: /^Report an error/ })).toBeNull();
  });

  it('shows what was flagged in the debrief, where there is time to write it up', () => {
    paint({
      flags: {
        captures: [
          { id: 'f1', paragraphIndex: 2, paragraphText: 'y', quickNote: 'wrong date' },
        ],
        capture: vi.fn(),
        drop: vi.fn(),
      },
      submitted: true,
      debrief: {
        score: 0,
        breakdown: {
          truePositives: 0,
          falsePositives: 0,
          hintsUsed: 0,
          hintPenalty: 0,
          scoreStolen: 0,
          timeBonus: 0,
        },
        solution: [
          {
            paragraphIndex: 1,
            falseInfoNumber: 1,
            falseStatement: ARTICLE.paragraphs[0] ?? '',
            explanation: 'Il en dort douze.',
            hint: 'Regardez la durée.',
          },
        ],
        standings: [],
        onwardLabel: 'Play again',
        onOnward: vi.fn(),
      },
    });

    expect(screen.getByRole('region', { name: 'What you flagged' })).not.toBeNull();
    expect(screen.getByText('wrong date')).not.toBeNull();
  });
});
