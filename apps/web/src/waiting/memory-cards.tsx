'use client';

// Memory: four pairs, face down, matched two at a time.
//
// The deal is a pure function so a test can hand it a deterministic shuffle,
// and the lock that stops a third card being turned while a pair resolves is
// state rather than a ref — a ref does not re-render, so the current game
// briefly accepts a click it then ignores.
import { cn } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { PlayAgain } from './controls.js';
import { useTimers } from '../timers.js';

/** Four pairs: eight cards, which fills the panel without crowding a phone. */
export const PAIRS = 4;

const ICONS: readonly string[] = ['◆', '●', '▲', '★'];

/** How long a pair stays visible once matched, and once missed. */
const MATCHED_MS = 500;
const MISSED_MS = 900;

/** How long a finished board is admired before it re-deals. */
const CLEARED_MS = 1600;

export interface Card {
  readonly icon: string;
  readonly matched: boolean;
}

/**
 * A shuffled deal.
 *
 * `pick` chooses an index below its argument — `Math.random` in the game, a
 * counter in a test.
 */
export function deal(pick: (below: number) => number): readonly Card[] {
  const cards = ICONS.slice(0, PAIRS).flatMap((icon) => [
    { icon, matched: false },
    { icon, matched: false },
  ]);
  // Fisher-Yates, over a copy we own.
  for (let at = cards.length - 1; at > 0; at -= 1) {
    const to = pick(at + 1);
    const held = cards[at];
    const other = cards[to];
    if (held === undefined || other === undefined) continue;
    cards[at] = other;
    cards[to] = held;
  }
  return cards;
}

const shuffled = (): readonly Card[] =>
  deal((below) => Math.floor(Math.random() * below));

export function MemoryCards() {
  const t = useTranslations('waiting');
  const timers = useTimers();
  const [cards, setCards] = useState<readonly Card[]>(shuffled);
  const [turned, setTurned] = useState<readonly number[]>([]);
  const [moves, setMoves] = useState(0);

  const found = cards.filter((card) => card.matched).length / 2;

  const redeal = (): void => {
    timers.clear();
    setCards(shuffled());
    setTurned([]);
    setMoves(0);
  };

  useEffect(() => {
    if (found !== PAIRS) return undefined;
    return timers.after(CLEARED_MS, redeal);
  }, [found, timers]);

  const turn = (at: number): void => {
    const card = cards[at];
    if (card === undefined || card.matched) return;
    if (turned.length >= 2 || turned.includes(at)) return;

    const now = [...turned, at];
    setTurned(now);
    if (now.length < 2) return;

    setMoves((was) => was + 1);
    const [first, second] = now;
    const pair =
      first !== undefined &&
      second !== undefined &&
      cards[first]?.icon === cards[second]?.icon;

    if (pair) {
      timers.after(MATCHED_MS, () => {
        setCards((was) =>
          was.map((each, index) =>
            index === first || index === second ? { ...each, matched: true } : each,
          ),
        );
        setTurned([]);
      });
      return;
    }
    timers.after(MISSED_MS, () => {
      setTurned([]);
    });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="grid grid-cols-4 gap-1.5"
        role="group"
        aria-label={t('memory.gridLabel')}
      >
        {cards.map((card, at) => {
          const showing = card.matched || turned.includes(at);
          return (
            <button
              key={at}
              type="button"
              onClick={() => {
                turn(at);
              }}
              disabled={card.matched || turned.length >= 2}
              // The glyph is in the document either way — a card that swaps its
              // text on flip is a card whose whole grid re-reads itself to a
              // screen reader on every turn. What it is *called* is what hides.
              // The glyph is a placeholder, not copy: what translates is the
              // sentence around it.
              aria-label={
                showing
                  ? t('memory.cardShowing', { number: at + 1, icon: card.icon })
                  : t('memory.cardFaceDown', { number: at + 1 })
              }
              className={cn(
                'flex size-12 items-center justify-center rounded-md border text-lg transition-all',
                'outline-none focus-visible:ring-2 focus-visible:ring-accent',
                card.matched
                  ? 'border-green bg-green-soft text-green'
                  : showing
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-line bg-surface text-transparent',
              )}
            >
              {/* The name above carries the state; the glyph is decoration,
                  and a screen reader that reads both reads the card twice. */}
              <span aria-hidden="true">{card.icon}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {found === PAIRS
          ? t('memory.allMatched')
          : t('memory.pairsProgress', { found, total: PAIRS })}
      </p>
      <p className="font-mono text-xs tabular-nums text-muted">
        {t('memory.moves', { moves })}
      </p>
      <PlayAgain onClick={redeal} />
    </div>
  );
}
