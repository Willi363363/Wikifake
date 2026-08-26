/** @vitest-environment jsdom */

// The round, and the two things the step turns on: the central gesture works
// from a keyboard, and the solution is not in the page.
//
// The negative assertion is the important half. It is written **by values**, not
// by field names: with Server Components an object passed from server to client
// is serialised into the page, so a leak does not announce itself with a key
// called `explanation` — it appears as the sentence itself, somewhere in the
// markup. The test therefore holds a solution it knows the strings of and looks
// for those strings in the whole document.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { asClock, pressureAt, URGENT_SECONDS, WARNING_SECONDS } from './clock.js';
import { Round } from './round.js';
import {
  ARTICLE,
  KEPT_BACK,
  noEffects,
  noHints,
  paintRound as paint,
  tokens,
} from './testing.js';
import type { ArticleFacts } from './article.js';

afterEach(() => {
  cleanup();
});

describe('8.1 — the clock', () => {
  it('reads as minutes and seconds, zero-padded', () => {
    expect(asClock(300)).toBe('05:00');
    expect(asClock(59)).toBe('00:59');
    expect(asClock(0)).toBe('00:00');
  });

  it('never reads as a negative time', () => {
    expect(asClock(-10)).toBe('00:00');
  });

  it('names the pressure rather than picking a colour', () => {
    expect(pressureAt(300)).toBe('calm');
    expect(pressureAt(WARNING_SECONDS)).toBe('warning');
    expect(pressureAt(URGENT_SECONDS)).toBe('urgent');
    expect(pressureAt(0)).toBe('urgent');
  });
});

describe('8.1 — the article', () => {
  it('shows every paragraph, and the count of falsifications', () => {
    paint();
    expect(tokens()).toHaveLength(ARTICLE.paragraphs.length);
    // C1.1 — the count, and nothing else about them.
    expect(screen.getByText('1 altered')).not.toBeNull();
  });

  it('names the topic once, as the article’s title', () => {
    paint();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Chat');
  });

  it('says the text was modified, under what licence, and where it came from', () => {
    // C6.1 — a tested legal requirement, and this is the "during the round" half.
    paint();
    expect(screen.getByText(/Text deliberately modified/)).not.toBeNull();
    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).not.toBeNull();
    expect(screen.getByRole('link', { name: '“Chat”' }).getAttribute('href')).toBe(
      ARTICLE.wikipediaUrl,
    );
  });
});

describe('8.1 — the central gesture', () => {
  it('marks and unmarks by click, and says which it is', () => {
    paint();
    const first = tokens()[0];
    expect(first?.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(first as HTMLElement);
    expect(tokens()[0]?.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(tokens()[0] as HTMLElement);
    expect(tokens()[0]?.getAttribute('aria-pressed')).toBe('false');
  });

  // The done-when of the step: the whole game is clicking these, so a game that
  // needs a mouse is not a game some people can play at all.
  it('marks by keyboard, having been reached by keyboard', async () => {
    const user = userEvent.setup();
    paint();

    // Tab until the first paragraph has focus: it is reachable, which a
    // `<span onClick>` is not.
    for (let step = 0; step < 12 && document.activeElement !== tokens()[0]; step += 1) {
      await user.tab();
    }
    expect(document.activeElement).toBe(tokens()[0]);

    await user.keyboard('{Enter}');
    expect(tokens()[0]?.getAttribute('aria-pressed')).toBe('true');

    await user.keyboard(' ');
    expect(tokens()[0]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('counts what is marked, out of what is altered', () => {
    paint();
    fireEvent.click(tokens()[0] as HTMLElement);
    fireEvent.click(tokens()[2] as HTMLElement);

    expect(screen.getByText('marked').nextElementSibling?.textContent).toBe('2/1');
  });

  it('submits the paragraph numbers, 1-based', () => {
    const sent = vi.fn();
    paint({ onSubmit: sent });

    fireEvent.click(tokens()[0] as HTMLElement);
    fireEvent.click(tokens()[2] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    // C3.3 — the number clicked is the number graded.
    expect(sent).toHaveBeenCalledWith([1, 3]);
  });

  it('stops accepting marks once the answer is with the server', () => {
    paint({ submitted: true });
    // The primitive renders a paragraph rather than a button when it is locked:
    // a control that looks pressable and does nothing is worse than one that
    // does not look pressable.
    expect(
      screen.queryByRole('button', { name: new RegExp(ARTICLE.paragraphs[0] ?? 'x') }),
    ).toBeNull();
  });
});

describe('8.1 — the negative assertion', () => {
  // By values. A key called `explanation` is the leak somebody would notice; the
  // sentence appearing in a serialised RSC payload is the one they would not.
  it.each(Object.entries(KEPT_BACK))('never puts the %s in the page', (_what, held) => {
    paint();
    expect(document.body.innerHTML).not.toContain(held);
  });

  it('says nothing about which paragraphs were altered', () => {
    paint();
    // Every token wears the same state, and the only per-paragraph fact on
    // screen is whether the player marked it.
    for (const token of tokens()) {
      expect(token.getAttribute('data-state')).toBe('idle');
    }
  });

  it('keeps the assertion true once a paragraph is marked', () => {
    paint();
    fireEvent.click(tokens()[0] as HTMLElement);

    expect(tokens()[0]?.getAttribute('data-state')).toBe('selected');
    for (const held of Object.values(KEPT_BACK)) {
      expect(document.body.innerHTML).not.toContain(held);
    }
  });

  // The version of this assertion with teeth, and the shape 9.5's done-when
  // describes: a payload that carries more than the contract allows. A component
  // that spread its article into the markup, or serialised it into an attribute,
  // would put these strings on screen without any code naming them.
  it('puts nothing on screen for a payload that carries more than it should', () => {
    const leaking = {
      ...ARTICLE,
      solution: [
        {
          paragraphIndex: 1,
          falseInfoNumber: 1,
          falseStatement: ARTICLE.paragraphs[0],
          explanation: KEPT_BACK.explanation,
          hint: KEPT_BACK.hint,
        },
      ],
      originals: [KEPT_BACK.original],
    } as ArticleFacts;

    paint({ article: leaking });
    expect(document.body.innerHTML).not.toContain(KEPT_BACK.explanation);
    expect(document.body.innerHTML).not.toContain(KEPT_BACK.hint);
    expect(document.body.innerHTML).not.toContain(KEPT_BACK.original);
  });

  it('keeps it true with the brief open', async () => {
    const user = userEvent.setup();
    paint();
    await user.click(screen.getByRole('button', { name: 'Brief' }));

    expect(screen.getByRole('dialog')).not.toBeNull();
    for (const held of Object.values(KEPT_BACK)) {
      expect(document.body.innerHTML).not.toContain(held);
    }
  });
});

describe('8.1 — the brief', () => {
  it('opens, names the count, and quotes the scale from the domain', async () => {
    const user = userEvent.setup();
    paint();
    await user.click(screen.getByRole('button', { name: 'Brief' }));

    const brief = screen.getByRole('dialog');
    expect(brief.textContent).toContain('One paragraph');
    // The scale is `@wikifake/domain`'s. The current game states it in
    // `frontend/src/config.js` as well as in `backend/src/scoring.py`.
    expect(brief.textContent).toContain('+150');
    expect(brief.textContent).toContain('−80');
  });

  it('closes on escape, which the current modal does not', async () => {
    const user = userEvent.setup();
    paint();
    await user.click(screen.getByRole('button', { name: 'Brief' }));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('8.1 — the timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down from the round’s limit', () => {
    paint({ timeLimit: 90 });
    expect(screen.getByRole('timer').textContent).toContain('01:30');

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole('timer').textContent).toContain('01:25');
  });

  it('says the time is short in words, not only in colour', () => {
    paint({ timeLimit: 31 });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('timer').textContent).toContain('almost out of time');
  });

  it('submits by itself when the clock runs out', () => {
    const sent = vi.fn();
    paint({ timeLimit: 3, onSubmit: sent });

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    // Defect 4 of the debt register: the current game leaves the limit to the
    // client and does nothing when it expires, so a player who walks away never
    // gets a score.
    expect(sent).toHaveBeenCalledWith([]);
  });

  it('submits once, not once per render, after expiry', () => {
    const sent = vi.fn();
    const round = (
      <Round
        article={ARTICLE}
        timeLimit={2}
        submitted={false}
        busy={false}
        refusal={null}
        hints={noHints()}
        onSubmit={sent}
        onUnlockHint={vi.fn()}
      />
    );
    const { rerender } = render(round);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    rerender(round);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(sent).toHaveBeenCalledTimes(1);
  });

  it('stops the clock once the answer is in', () => {
    paint({ timeLimit: 90, submitted: true });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('timer').textContent).toContain('01:30');
  });

  it('leaves no timer behind when it is unmounted', () => {
    const { unmount } = paint();
    unmount();
    act(() => {
      vi.advanceTimersByTime(600_000);
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('8.1 — submitting, and taking it back', () => {
  it('offers no way to take it back where there is none', () => {
    paint({ submitted: true });
    expect(screen.queryByRole('button', { name: 'Take it back' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Submitted' })).not.toBeNull();
  });

  it('offers one where the transport allows it', () => {
    const back = vi.fn();
    paint({ submitted: true, onUnsubmit: back });

    fireEvent.click(screen.getByRole('button', { name: 'Take it back' }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('shows what the server refused, and stays playable', () => {
    paint({ refusal: 'that round is over' });
    expect(screen.getByRole('alert').textContent).toBe('that round is over');
  });

  it('says the answer is with the server once it is', () => {
    paint({ submitted: true });
    expect(screen.getByText(/answer is with the server/)).not.toBeNull();
  });
});

// Step 8.4 — what an item does to the article, as opposed to over it.
describe('8.4 — the article, distorted', () => {
  const card = () => screen.getByRole('article');

  it('is undistorted by default', () => {
    paint();
    expect(card().className).not.toContain('blur');
    expect(card().className).not.toContain('animate-');
  });

  it.each([
    ['blur', 'blur-'],
    ['invert', 'invert'],
    ['mirror', '-scale-x-100'],
    ['tiny', 'text-[9px]'],
    ['spin', 'animate-article-spin'],
    ['shake', 'animate-shake'],
  ] as const)('wears %s', (distortion, expected) => {
    paint({ effects: noEffects({ distortions: new Set([distortion]) }) });
    expect(card().className).toContain(expected);
  });

  it('wears two at once', () => {
    paint({ effects: noEffects({ distortions: new Set(['blur', 'spin']) }) });
    expect(card().className).toContain('blur-');
    expect(card().className).toContain('animate-article-spin');
  });

  // The two the stylesheet switches off under `prefers-reduced-motion`, which is
  // what makes them safe to express as classes at all: at 7 Hz and 1.2s infinite
  // they displace the page, and `motion.css` sets both variables to `none`.
  it('expresses the two displacing effects as theme animations', () => {
    paint({ effects: noEffects({ distortions: new Set(['shake']) }) });
    expect(card().className).toContain('animate-shake');
  });

  it('stays markable while it is distorted', () => {
    // An item that makes the article hard to read is not an item that stops the
    // player playing. The current blur sets `pointerEvents: 'none'` on the card.
    paint({ effects: noEffects({ distortions: new Set(['blur']) }) });
    fireEvent.click(tokens()[0] as HTMLElement);
    expect(tokens()[0]?.getAttribute('aria-pressed')).toBe('true');
  });
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
