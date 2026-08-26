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
import { useEffect, useState } from 'react';

import { ArticleCard, type ArticleFacts } from './article.js';
import { Brief } from './brief.js';
import { RoundFooter } from './footer.js';
import { RoundTopBar } from './top-bar.js';
import { useTimers } from '../timers.js';

export interface RoundProps {
  readonly article: ArticleFacts;
  readonly timeLimit: number;
  /** True once the answer is with the server. */
  readonly submitted: boolean;
  /** True while a request is in flight. */
  readonly busy: boolean;
  /** What the server refused, or null. */
  readonly refusal: string | null;
  onSubmit(marked: readonly number[]): void;
  /** Absent where a submission cannot be taken back — solo, over REST. */
  readonly onUnsubmit?: (() => void) | undefined;
}

export function Round({
  article,
  timeLimit,
  submitted,
  busy,
  refusal,
  onSubmit,
  onUnsubmit,
}: RoundProps) {
  const timers = useTimers();
  const [marked, setMarked] = useState<readonly number[]>([]);
  const [left, setLeft] = useState(timeLimit);
  const [briefing, setBriefing] = useState(false);
  const over = left <= 0;

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
        onSubmit={() => {
          onSubmit(marked);
        }}
        onUnsubmit={onUnsubmit}
        onOpenBrief={() => {
          setBriefing(true);
        }}
      />

      <main className="mx-auto max-w-4xl px-4 py-6">
        <ArticleCard
          article={article}
          marked={marked}
          locked={submitted || busy}
          onToggle={toggle}
        />

        {refusal === null ? null : (
          <p role="alert" className="mt-4 text-center text-sm text-danger">
            {refusal}
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
    </div>
  );
}
