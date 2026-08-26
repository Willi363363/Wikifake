// The round's tests, and what they all need.
//
// Extracted when `round.test.tsx` crossed the 500-line cap and the intel panel
// went into its own file: the article, the ledger factory and the token query
// were used by every suite, and copying them is how two harnesses start
// disagreeing about what a round looks like.
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { vi } from 'vitest';

import { Round } from './round.js';
import type { ArticleFacts } from './article.js';
import type { HintsState } from './hints.js';
import type { ItemsState } from './items.js';

/**
 * The article as the server sends it — three paragraphs, one of them false, and
 * no field that says which.
 */
export const ARTICLE: ArticleFacts = {
  topic: 'Chat',
  paragraphs: [
    'Le chat dort seize heures par jour.',
    'Sa vision nocturne est bonne.',
    'Il ronronne en expirant.',
  ],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
};

/**
 * What the server keeps. None of these strings may reach the page before
 * `game_end`, and the falsified paragraph's *original* wording is among them.
 */
export const KEPT_BACK = {
  original: 'Le chat dort douze heures par jour.',
  explanation: 'Un chat dort environ douze heures, pas seize.',
  hint: 'Regardez la durée annoncée.',
  position: 'paragraphIndex',
};

/** A hint ledger with nothing in it, which is every round before a purchase. */
export function noHints(over: Partial<HintsState> = {}): HintsState {
  return {
    held: {},
    hintsUsed: 0,
    penalty: 0,
    hintedParagraphs: new Set(),
    blocked: false,
    apply: vi.fn(),
    block: vi.fn(),
    clearBlocked: vi.fn(),
    ...over,
  };
}

/** A hand with nothing in it, and nothing thrown. */
export function noItems(over: Partial<ItemsState> = {}): ItemsState {
  return {
    hand: [],
    pending: null,
    landed: [],
    scanned: new Set(),
    lastScan: null,
    refusal: null,
    deal: vi.fn(),
    sending: vi.fn(),
    spent: vi.fn(),
    hit: vi.fn(),
    scan: vi.fn(),
    refuse: vi.fn(),
    dismiss: vi.fn(),
    clearRefusal: vi.fn(),
    ...over,
  };
}

/** The paragraph tokens, in order. */
export const tokens = () =>
  screen.getAllByRole('button', {
    name: new RegExp(`^(${ARTICLE.paragraphs.join('|')})`),
  });

/** A round on the fixtures above, with anything a test wants to change. */
export const paintRound = (over: Partial<ComponentProps<typeof Round>> = {}) =>
  render(
    <Round
      article={ARTICLE}
      timeLimit={300}
      submitted={false}
      busy={false}
      refusal={null}
      hints={noHints()}
      onSubmit={vi.fn()}
      onUnlockHint={vi.fn()}
      {...over}
    />,
  );
