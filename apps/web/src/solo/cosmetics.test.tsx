/** @vitest-environment jsdom */

// A solo round drawing the marks the player bought — step H.6.
//
// Its own file rather than a section of `solo.test.tsx`, which the pre-commit
// hook decided: that file reached 558 lines, and the 500-line rule is what keeps
// a suite readable. The split is also the right one — `solo.test.tsx` is the
// journey of step 7.8, and this is one thing the journey now carries.
//
// The end of a path with four links in it: a `cosmetic_purchase` row in the
// ledger, a column on `profile`, an identifier over the wire, a hex on screen.
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from '../i18n/testing.js';
import { SoloGame } from './solo.js';
import { SETTLE_MS } from '../lobby/generation.js';

/** The solo debrief offers a way back, and that is a navigation. */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined }),
}));

const ROUND = {
  sessionId: 'a-session-handle-16',
  timeLimit: 300,
  topic: 'Chat',
  paragraphs: [
    'Le chat dort seize heures par jour.',
    'Sa vision nocturne est bonne.',
    'Il ronronne en expirant.',
  ],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
};

const NOTHING_WORN = { marker: null, markStyle: null, frame: null, owned: [] };

/** The round, and an outfit with whatever is being tested worn. */
function serveWearing(worn: { marker?: string | null; markStyle?: string | null }): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      const body = path.endsWith('/account/cosmetics')
        ? { ...NOTHING_WORN, ...worn }
        : ROUND;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      }) as unknown as Promise<Response>;
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
});

/** Past the generation screen and into the round. */
async function intoTheRound(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
}

const paragraph = (at: number) =>
  screen.getByRole('button', { name: new RegExp(ROUND.paragraphs[at] ?? 'nothing') });

describe('H.6 — a solo round draws the marks the player bought', () => {
  /** The decoration on a marked paragraph, which is the only thing a cosmetic
      may reach: `aria-hidden`, childless, and never behind a word. */
  const decoration = (at: number) =>
    paragraph(at).querySelector('span[aria-hidden="true"]');

  it('colours the mark with the worn marker', async () => {
    // The end of the path: a `cosmetic_purchase` row in the ledger, a column on
    // `profile`, an identifier over the wire, a hex on the screen.
    serveWearing({ marker: 'MARKER_VIOLET' });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();
    fireEvent.click(paragraph(0));

    expect(decoration(0)?.getAttribute('style')).toContain('rgb(157, 90, 224)');
  });

  it('rearranges the mark with the worn style', async () => {
    serveWearing({ markStyle: 'MARK_STYLE_BRACKET' });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();
    fireEvent.click(paragraph(0));

    expect(decoration(0)?.className).toContain('border-x-3');
  });

  it('draws the default when nothing is worn', async () => {
    serveWearing({});
    render(<SoloGame topic="Chat" />);
    await intoTheRound();
    fireEvent.click(paragraph(0));

    expect(decoration(0)?.className).toContain('bg-accent');
    expect(decoration(0)?.getAttribute('style')).toBeNull();
  });

  it('asks for the outfit once, and only after there is a round', async () => {
    // The claim `solo.test.tsx` already made about `start` — a topic the route
    // would refuse asks the server for nothing — extended to this read.
    serveWearing({ marker: 'MARKER_VIOLET' });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();

    const asked = vi
      .mocked(fetch)
      .mock.calls.filter(([path]) => String(path).endsWith('/account/cosmetics'));
    expect(asked).toHaveLength(1);
    // After the round: the first request is the one that made it.
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('/start');
  });
});
