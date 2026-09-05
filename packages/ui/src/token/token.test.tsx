// The component the game is actually made of.
//
// Two halves. The precedence — which of eight looks a paragraph wears — is a
// pure function and is checked as one. Everything else is checked by driving the
// component the way a player without a mouse would, because "reachable by tab
// and activated by keyboard" is the whole point of the step: the current token
// is a `<span onClick>`, so the current game cannot be played without a mouse at
// all.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ParagraphToken } from './paragraph-token.js';
import {
  isInteractive,
  TOKEN_LABELS,
  TOKEN_STATES,
  tokenStateFor,
  VERDICT_STATES,
  type TokenState,
} from './state.js';

afterEach(cleanup);

const TEXT = 'Le chat dort seize heures par jour.';

describe('6.4 — which look a paragraph wears', () => {
  it('is idle when nothing has happened to it', () => {
    expect(tokenStateFor({})).toBe('idle');
  });

  it.each([
    [{ marked: true }, 'selected'],
    [{ corrected: true }, 'edited'],
    [{ hinted: true }, 'hinted'],
    [{ scanned: true }, 'scanned'],
  ] as const)('reads %j as %s', (facts, expected) => {
    expect(tokenStateFor(facts)).toBe(expected);
  });

  // The order of the current component, kept. Once the round is over, "you
  // marked this" is no longer the interesting fact about the paragraph.
  it.each(VERDICT_STATES)('lets the %s verdict replace everything', (verdict) => {
    expect(
      tokenStateFor({
        marked: true,
        corrected: true,
        hinted: true,
        scanned: true,
        verdict: verdict as 'found',
      }),
    ).toBe(verdict);
  });

  it('prefers a correction to a mark, and a mark to what was paid for', () => {
    expect(tokenStateFor({ marked: true, corrected: true })).toBe('edited');
    expect(tokenStateFor({ marked: true, hinted: true })).toBe('selected');
    expect(tokenStateFor({ hinted: true, scanned: true })).toBe('hinted');
  });

  // C1.2 — the solution leaves the server once, with `game_end`. A screen that
  // has none of it must still be able to render every paragraph.
  it('needs nothing about the solution to answer', () => {
    expect(tokenStateFor({ marked: true, verdict: null })).toBe('selected');
    expect(VERDICT_STATES.every((state) => !isInteractive(state))).toBe(true);
  });
});

describe('6.4 — the paragraph token', () => {
  const paint = (state: TokenState, extra: Record<string, unknown> = {}) =>
    render(
      <ParagraphToken state={state} {...extra}>
        {TEXT}
      </ParagraphToken>,
    );

  // The criterion: every variant has its render test.
  it.each(TOKEN_STATES)('renders the %s state', (state) => {
    paint(state);
    const token = document.querySelector('[data-state]');
    expect(token?.getAttribute('data-state')).toBe(state);
    expect(token?.textContent).toContain(TEXT);
    // Theme tokens only: a hex here is a colour outside the palette, and one
    // that dark mode cannot answer for.
    expect(token?.className).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  describe('while the round is running', () => {
    it.each(TOKEN_STATES.filter(isInteractive))('is a button when %s', (state) => {
      paint(state);
      expect(screen.getByRole('button').textContent).toContain(TEXT);
    });

    it('is reachable by tab', async () => {
      const user = userEvent.setup();
      paint('idle');

      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button'));
    });

    it.each(['{Enter}', ' '])('is marked by %s', async (key) => {
      const user = userEvent.setup();
      const marked = vi.fn();
      paint('idle', { onClick: marked });

      await user.tab();
      await user.keyboard(key);
      expect(marked).toHaveBeenCalledTimes(1);
    });

    it('shows a focus ring rather than removing the outline', () => {
      paint('idle');
      const classes = screen.getByRole('button').className;
      expect(classes).toContain('outline-none');
      // A ring of any non-zero width, and in the colour reserved for focus.
      // Pinning `ring-2` failed on a width change for no reason, while
      // `ring-0` — the change that matters — would have passed it.
      expect(classes).toMatch(/focus-visible:ring-(?:\[[1-9]\d*px\]|[1-9]\d*(?![\w-]))/);
      expect(classes).toContain('focus-visible:ring-accent-line');
    });

    // The gesture is a toggle, and nothing in the current interface says so.
    it.each([
      ['idle', false],
      ['selected', true],
      ['edited', true],
      ['hinted', false],
      ['scanned', false],
    ] as const)('says %s means pressed=%s', (state, pressed) => {
      paint(state);
      expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe(
        String(pressed),
      );
    });

    it('stops being pressable when it is disabled', async () => {
      const user = userEvent.setup();
      const marked = vi.fn();
      paint('idle', { onClick: marked, disabled: true });

      expect(screen.queryByRole('button')).toBeNull();
      await user.tab();
      expect(marked).not.toHaveBeenCalled();
    });
  });

  describe('once the round is over', () => {
    // `cursor: default` in the current stylesheet says the same thing. A control
    // that looks pressable and does nothing is worse than one that does not.
    it.each(VERDICT_STATES)('is not a control when %s', (state) => {
      paint(state);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it.each(VERDICT_STATES)('is not reachable by tab when %s', async (state) => {
      const user = userEvent.setup();
      paint(state);

      await user.tab();
      expect(document.body.contains(document.activeElement)).toBe(true);
      expect(document.activeElement?.getAttribute('data-state')).toBeNull();
    });
  });

  describe('what it says, rather than what it looks like', () => {
    // The current badges are `::after { content: "✓" }`. A pseudo-element's
    // content is inconsistently exposed to assistive technology and cannot be
    // translated — which is how "🔎 INDICE" ended up as French inside a
    // stylesheet.
    it.each(TOKEN_STATES.filter((state) => TOKEN_LABELS[state] !== null))(
      'announces the %s state in words',
      (state) => {
        paint(state);
        const token = document.querySelector('[data-state]');
        expect(token?.textContent).toContain(TOKEN_LABELS[state]);
      },
    );

    it('lets a caller replace the wording, which is how phase 11 translates it', () => {
      paint('found', { label: 'trouvé' });
      expect(document.querySelector('[data-state]')?.textContent).toContain('trouvé');
      expect(document.querySelector('[data-state]')?.textContent).not.toContain('found');
    });

    it('says nothing when a caller asks it to say nothing', () => {
      paint('found', { label: null });
      const text = document.querySelector('[data-state]')?.textContent ?? '';
      expect(text.trim()).toBe(`${TEXT}✓`);
    });

    // The glyphs are decoration. If they were the message, a screen reader would
    // read "found" as "tick".
    it('hides the badge glyph from the accessibility tree', () => {
      paint('found');
      const glyph = document.querySelector('[aria-hidden]');
      expect(glyph?.textContent).toBe('✓');
    });

    // Three verdicts told apart by hue alone is three verdicts nobody
    // colour-blind can tell apart. Each carries something else as well.
    it.each(VERDICT_STATES)('does not rely on colour alone for %s', (state) => {
      paint(state);
      const token = document.querySelector('[data-state]');
      const marked =
        (token?.textContent?.includes(TOKEN_LABELS[state] as string) ?? false) &&
        (state === 'false-positive'
          ? token?.className.includes('line-through')
          : token?.querySelector('[aria-hidden]') !== null);
      expect(marked).toBe(true);
    });
  });
});
