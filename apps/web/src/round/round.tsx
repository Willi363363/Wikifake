'use client';

// The round, recomposed.
//
// `GameSession.jsx` is 456 lines that own the article, the selection, the timer,
// the hints, the items, the effects, the cursors, the leaderboard, the chat and
// the debrief. This owns two things: which paragraphs are marked, and how long
// is left. Everything else it is handed or reports.
//
// One screen for solo and multiplayer, which is what makes the negative
// assertions worth writing once. What differs is who submits and what comes
// back — a REST response in one, `game_end` in the other — and neither is this
// component's business.
import type { ItemInstance } from '@wikifake/protocol';
import { useEffect, useState } from 'react';

import { ArticleCard, type ArticleFacts } from './article.js';
import { Brief } from './brief.js';
import { PlayerCursors, type CursorView } from './player-cursors.js';
import { Overlays } from './effects/overlays.js';
import type { EffectsState } from './effects.js';
import { RoundFooter } from './footer.js';
import type { HintsState } from './hints.js';
import { Intel } from './intel.js';
import { ItemBar } from './item-bar.js';
import { isSelfCast } from './item-labels.js';
import { ItemTarget } from './item-target.js';
import { ItemToasts } from './item-toasts.js';
import type { ItemsState } from './items.js';
import { RoundTopBar } from './top-bar.js';
import { useTimers } from '../timers.js';

/** Shared, so a round with no items does not allocate a set per render. */
const EMPTY: ReadonlySet<number> = new Set();
const NOTHING: ReadonlySet<never> = new Set();

export interface RoundProps {
  readonly article: ArticleFacts;
  readonly timeLimit: number;
  /** True once the answer is with the server. */
  readonly submitted: boolean;
  /** True while a request is in flight. */
  readonly busy: boolean;
  /** What the server refused, or null. */
  readonly refusal: string | null;
  /** C1.4 — what has been bought, held by whoever owns the transport. */
  readonly hints: HintsState;
  /**
   * D6 — the hand, and what has been thrown. Absent in solo, and absent is not
   * empty: there is nobody to throw at, so there is no bar at all.
   */
  readonly items?: ItemsState | undefined;
  /** Everyone but this player. Empty where there is nobody else. */
  readonly rivals?: readonly string[] | undefined;
  /** What items are doing to the screen. Absent in solo, where nothing is. */
  readonly effects?: EffectsState | undefined;
  /** C5.5 — where the others are pointing. Empty in solo, where nobody is. */
  readonly cursors?: readonly CursorView[] | undefined;
  onSubmit(marked: readonly number[]): void;
  /** Absent where a submission cannot be taken back — solo, over REST. */
  readonly onUnsubmit?: (() => void) | undefined;
  onUnlockHint(falseInfoNumber: number, level: 1 | 2): void;
  /** The marked paragraphs ride along: C1.6 needs them to skip what was found. */
  onUseItem?:
    | ((
        item: ItemInstance,
        targets: readonly string[],
        marked: readonly number[],
      ) => void)
    | undefined;
}

export function Round({
  article,
  timeLimit,
  submitted,
  busy,
  refusal,
  hints,
  items,
  rivals = [],
  effects,
  cursors = [],
  onSubmit,
  onUnsubmit,
  onUnlockHint,
  onUseItem,
}: RoundProps) {
  const timers = useTimers();
  const [marked, setMarked] = useState<readonly number[]>([]);
  const [left, setLeft] = useState(timeLimit);
  const [briefing, setBriefing] = useState(false);
  const [intel, setIntel] = useState(false);
  /** The item waiting for a target, or null. The chain's missing middle. */
  const [aiming, setAiming] = useState<ItemInstance | null>(null);
  const over = left <= 0;

  const throwIt = (item: ItemInstance, targets: readonly string[]): void => {
    setAiming(null);
    onUseItem?.(item, targets, marked);
  };

  useEffect(() => {
    if (over || submitted) return undefined;
    // Registered once: a dependency on the second would rebuild the interval
    // every second and drift.
    return timers.every(1000, () => {
      setLeft((was) => Math.max(0, was - 1));
    });
  }, [over, submitted, timers]);

  useEffect(() => {
    if (!over || submitted || busy) return;
    // The round ends by itself. The current game leaves `time_limit` to the
    // client and does nothing when it runs out, so a player who walks away
    // never gets a score at all — defect 4 of the debt register.
    onSubmit(marked);
    // `marked` is read and deliberately not depended on: it is the selection at
    // the moment the clock expired, and a change after that is a change to a
    // round that is already over.
  }, [busy, over, submitted]);

  const toggle = (paragraph: number): void => {
    if (submitted) return;
    setMarked((was) =>
      was.includes(paragraph)
        ? was.filter((each) => each !== paragraph)
        : [...was, paragraph],
    );
  };

  return (
    <div className="min-h-dvh">
      <RoundTopBar
        topic={article.topic}
        secondsLeft={left}
        marked={marked.length}
        total={article.totalFakes}
        submitted={submitted}
        busy={busy}
        hintsUsed={hints.hintsUsed}
        hintsJammed={hints.blocked}
        onSubmit={() => {
          onSubmit(marked);
        }}
        onUnsubmit={onUnsubmit}
        onOpenBrief={() => {
          setBriefing(true);
        }}
        onOpenIntel={() => {
          setIntel(true);
        }}
      />

      <main className="mx-auto max-w-4xl px-4 py-6">
        <ArticleCard
          article={article}
          marked={marked}
          hinted={hints.hintedParagraphs}
          scanned={items?.scanned ?? EMPTY}
          distortions={effects?.distortions ?? NOTHING}
          locked={submitted || busy}
          onToggle={toggle}
        />

        {refusal === null ? null : (
          <p role="alert" className="mt-4 text-center text-sm text-danger">
            {refusal}
          </p>
        )}

        {items?.refusal === undefined || items.refusal === null ? null : (
          // D6 — an item the server would not let land. Said rather than
          // dropped: an item that vanishes without a word is indistinguishable
          // from a lost frame, which is exactly what the current server does.
          <p role="alert" className="mt-4 text-center text-sm text-danger">
            {items.refusal}
          </p>
        )}

        {submitted ? (
          <p aria-live="polite" className="mt-4 text-center text-sm text-muted">
            Your answer is with the server. The correction arrives when the round ends.
          </p>
        ) : null}

        <RoundFooter />
      </main>

      <Brief
        open={briefing}
        total={article.totalFakes}
        timeLimit={timeLimit}
        onOpenChange={setBriefing}
      />

      <Intel
        open={intel}
        total={article.totalFakes}
        hints={hints}
        locked={submitted || busy}
        onOpenChange={setIntel}
        onUnlock={onUnlockHint}
      />

      <PlayerCursors cursors={cursors} />

      {effects === undefined ? null : (
        <Overlays active={effects.overlays} onDismiss={effects.dismiss} />
      )}

      {items === undefined ? null : (
        <>
          <ItemToasts
            landed={items.landed}
            lastScan={items.lastScan}
            onDismiss={items.dismiss}
          />
          <ItemBar
            hand={items.hand}
            pending={items.pending}
            locked={submitted || busy}
            onPick={(item) => {
              // A self-cast item needs nobody named, so it goes straight out —
              // the current picker asks for a target for the SCANNER too, which
              // the server then refuses.
              if (isSelfCast(item.itemId)) throwIt(item, []);
              else setAiming(item);
            }}
          />
          <ItemTarget
            item={aiming}
            rivals={rivals}
            onConfirm={throwIt}
            onCancel={() => {
              setAiming(null);
            }}
          />
        </>
      )}
    </div>
  );
}
