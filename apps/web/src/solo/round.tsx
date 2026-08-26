'use client';

// The bare round: the paragraphs, a clock, and a submission.
//
// Deliberately bare. "Do not anticipate phase 8" is one of this phase's
// pitfalls, and phase 8 replaces this screen entirely — hints, items, cursors,
// effects, the debrief. What is here is the part the journey needs to exist at
// all: something to mark, and a way to say you are done.
//
// It knows nothing about the network. It reports the paragraphs the player
// marked and is told whether that is in flight, which is what lets the whole of
// it be driven by a test without a fetch.
import type { gameApi } from '@wikifake/protocol';
import { Badge, Button, ParagraphToken, tokenStateFor } from '@wikifake/ui';
import { useEffect, useRef, useState } from 'react';

import { useTimers } from '../timers.js';

/** Where the clock turns from information into pressure. */
const NEARLY_OVER_SECONDS = 30;

export interface SoloRoundProps {
  readonly round: gameApi.StartGameResponse;
  /** True while a submission is in flight. */
  readonly busy: boolean;
  /** The server's last refusal, or null. */
  readonly refusal: string | null;
  onSubmit(marked: readonly number[]): void;
}

/** mm:ss, because a round is minutes and a bare number of seconds is not read. */
export function asClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${String(minutes)}:${String(safe % 60).padStart(2, '0')}`;
}

export function SoloRound({ round, busy, refusal, onSubmit }: SoloRoundProps) {
  const timers = useTimers();
  // 1-based, as the contract says (C3.3): the number the player clicked is the
  // number the server grades, with no arithmetic in between to get wrong.
  const [marked, setMarked] = useState<readonly number[]>([]);
  const [left, setLeft] = useState(round.timeLimit);
  const over = left <= 0;
  // Whether the clock has already submitted for the player. A latch, so a
  // refusal that comes back after the round expired leaves the button usable
  // instead of resubmitting on every render.
  const expired = useRef(false);

  useEffect(() => {
    if (over || busy) return undefined;
    // Not depended on `left`: the interval is registered once and the setter
    // reads the previous value, where a dependency on the second would rebuild
    // the interval every second and drift.
    return timers.every(1000, () => {
      setLeft((was) => Math.max(0, was - 1));
    });
  }, [busy, over, timers]);

  useEffect(() => {
    if (!over || expired.current) return;
    // The round ends by itself. The current game leaves `time_limit` to the
    // client and does nothing when it runs out, so a player who walks away
    // never gets a score at all — defect 4 of the debt register, on the solo
    // path.
    expired.current = true;
    onSubmit(marked);
  }, [marked, onSubmit, over]);

  const toggle = (at: number): void => {
    setMarked((was) =>
      was.includes(at) ? was.filter((each) => each !== at) : [...was, at],
    );
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink">{round.topic}</h1>
        <p
          className="font-mono text-lg tabular-nums text-muted"
          role="timer"
          aria-label="Time left"
        >
          {asClock(left)}
        </p>
      </header>

      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {/* C1.1 — the count, and never which ones. It is the whole of what the
            start payload says about the falsifications. */}
        <Badge tone={left <= NEARLY_OVER_SECONDS ? 'danger' : 'accent'}>
          {String(round.totalFakes)} altered
        </Badge>
        <span>Mark every paragraph you think was tampered with.</span>
      </p>

      <div className="space-y-3 rounded-xl border border-line bg-surface p-5 shadow-md">
        {round.paragraphs.map((text, at) => {
          const number = at + 1;
          return (
            <ParagraphToken
              key={number}
              state={tokenStateFor({ marked: marked.includes(number) })}
              disabled={busy}
              onClick={() => {
                toggle(number);
              }}
            >
              {text}
            </ParagraphToken>
          );
        })}
      </div>

      {/*
        C6.1 — the text is CC BY-SA and it has been deliberately altered, so it
        says both, next to the text, with the source reachable. Phase 8 owns the
        tested requirement and rebuilds this surface; shipping article text with
        no attribution at all in the meantime is not a thing to defer.
      */}
      <p className="text-xs text-muted">
        Text deliberately modified. Original from Wikipedia, under{' '}
        <a
          className="underline hover:text-ink"
          href="https://creativecommons.org/licenses/by-sa/4.0/"
          target="_blank"
          rel="noreferrer"
        >
          CC BY-SA 4.0
        </a>
        {' — '}
        <a
          className="underline hover:text-ink"
          href={round.wikipediaUrl}
          target="_blank"
          rel="noreferrer"
        >
          source article
        </a>
      </p>

      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          disabled={busy}
          onClick={() => {
            onSubmit(marked);
          }}
        >
          {busy
            ? 'Grading…'
            : `Submit ${String(marked.length)} of ${String(round.totalFakes)}`}
        </Button>
        {refusal === null ? null : (
          <p role="alert" className="text-center text-sm text-danger">
            {refusal}
          </p>
        )}
      </div>
    </main>
  );
}
