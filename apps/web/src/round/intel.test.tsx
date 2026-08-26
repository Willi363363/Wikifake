/** @vitest-environment jsdom */

// C1.4 — the intel panel: what it costs to be told, and what it says once you
// have paid.
//
// Split from `round.test.tsx` when it crossed the 500-line cap. The harness both
// files use is `testing.tsx`; the ledger's own rule — monotonic, and the penalty
// the server's — is `hints.test.tsx`, without a DOM.
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ARTICLE, noHints, paintRound as paint, tokens } from './testing.js';
import type { HintsState } from './hints.js';

afterEach(() => {
  cleanup();
});

describe('8.2 — the intel panel', () => {
  const nudged: HintsState = noHints({
    held: { 1: { level: 1, hint: 'Look at the duration.' } },
    hintsUsed: 1,
    penalty: 50,
  });

  const revealed: HintsState = noHints({
    held: {
      1: {
        level: 2,
        hint: 'Look at the duration.',
        truth: 'A cat sleeps about twelve hours.',
        paragraphIndex: 1,
      },
    },
    hintsUsed: 1,
    penalty: 200,
    hintedParagraphs: new Set([1]),
  });

  const openIntel = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /^Intel/ }));
    return screen.getByRole('dialog');
  };

  it('offers one card per falsification, and no more', async () => {
    const user = userEvent.setup();
    paint({ article: { ...ARTICLE, totalFakes: 3 } });
    const panel = await openIntel(user);

    // Numbers, never positions: the player buys against a target number, and
    // which paragraph it is comes back only with the reveal.
    expect(panel.textContent).toContain('target 01');
    expect(panel.textContent).toContain('target 03');
    expect(panel.textContent).not.toContain('target 04');
  });

  it('shows nothing about a target that has not been bought', async () => {
    const user = userEvent.setup();
    paint();
    const panel = await openIntel(user);

    expect(panel.textContent).toContain('▒');
    expect(screen.getByRole('button', { name: 'Buy a hint on target 1' })).not.toBeNull();
  });

  it('asks the server for the level the player pressed', async () => {
    const user = userEvent.setup();
    const asked = vi.fn();
    paint({ onUnlockHint: asked });
    await openIntel(user);

    await user.click(screen.getByRole('button', { name: 'Buy a hint on target 1' }));
    expect(asked).toHaveBeenCalledWith(1, 1);

    await user.click(screen.getByRole('button', { name: 'Reveal target 1' }));
    expect(asked).toHaveBeenCalledWith(1, 2);
  });

  it('shows the nudge once it is paid for, and what it cost', async () => {
    const user = userEvent.setup();
    paint({ hints: nudged });
    const panel = await openIntel(user);

    expect(panel.textContent).toContain('Look at the duration.');
    expect(panel.textContent).toContain('spent 50');
    expect(panel.textContent).toContain('level 1');
  });

  // The completion criterion, on screen: level 2 is displayed, and the buttons
  // that would charge for it again are shut.
  it('shows the truth at level 2, and sells neither level twice', async () => {
    const user = userEvent.setup();
    paint({ hints: revealed });
    const panel = await openIntel(user);

    expect(panel.textContent).toContain('twelve hours');
    expect(
      screen
        .getByRole('button', { name: 'Buy a hint on target 1' })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Reveal target 1' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('points at the paragraph a reveal named, and only that one', () => {
    paint({ hints: revealed });
    const marks = tokens().map((token) => token.getAttribute('data-state'));
    expect(marks).toEqual(['hinted', 'idle', 'idle']);
  });

  it('points at nothing for a nudge', () => {
    paint({ hints: nudged });
    for (const token of tokens()) {
      expect(token.getAttribute('data-state')).toBe('idle');
    }
  });

  it('counts what has been bought, on the way in', async () => {
    const user = userEvent.setup();
    paint({ hints: nudged });
    expect(screen.getByRole('button', { name: /^Intel/ }).textContent).toContain('1');
    await openIntel(user);
  });

  it('sells nothing once the answer is with the server', async () => {
    const user = userEvent.setup();
    paint({ submitted: true });
    await openIntel(user);

    expect(
      screen
        .getByRole('button', { name: 'Buy a hint on target 1' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  // The done-when's second half: `hints_blocked` displays, and does not crash.
  describe('C1.5 — a rival has jammed it', () => {
    const jammed: HintsState = noHints({ blocked: true });

    // A modal a rival can make appear on your screen while you are reading is a
    // modal that steals your focus on their command. The current game opens one.
    it('does not open a panel over the article', () => {
      paint({ hints: jammed });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('heading', { level: 1 })).not.toBeNull();
    });

    it('says so on the button instead', () => {
      paint({ hints: jammed });
      expect(screen.getByRole('button', { name: 'Intel — jammed' })).not.toBeNull();
    });

    it('says what happened, and that nothing was charged, when the panel is opened', async () => {
      const user = userEvent.setup();
      paint({ hints: jammed });
      await user.click(screen.getByRole('button', { name: 'Intel — jammed' }));

      expect(screen.getByRole('dialog').textContent).toContain('jammed your intel');
      expect(screen.getByRole('alert').textContent).toContain('Nothing was charged');
    });

    it('leaves the targets buyable, because the lock lifts', async () => {
      const user = userEvent.setup();
      paint({ hints: jammed });
      await user.click(screen.getByRole('button', { name: 'Intel — jammed' }));

      expect(
        screen
          .getByRole('button', { name: 'Buy a hint on target 1' })
          .hasAttribute('disabled'),
      ).toBe(false);
    });

    it('clears the notice when the panel is closed', async () => {
      const user = userEvent.setup();
      const cleared = vi.fn();
      paint({ hints: noHints({ blocked: true, clearBlocked: cleared }) });

      await user.click(screen.getByRole('button', { name: 'Intel — jammed' }));
      await user.keyboard('{Escape}');
      expect(cleared).toHaveBeenCalled();
    });

    it('is one panel, not a modal over a modal', async () => {
      const user = userEvent.setup();
      paint({ hints: jammed });
      await user.click(screen.getByRole('button', { name: 'Intel — jammed' }));

      // The current game opens a second full-screen modal over the intel room,
      // which is a focus trap fighting a focus trap.
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    });
  });
});
