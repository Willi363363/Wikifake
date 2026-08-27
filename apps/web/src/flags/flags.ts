'use client';

// A player reporting a **genuine** factual error — as opposed to the ones the
// game put there on purpose.
//
// Two phases, and that is the current design worth keeping. Reporting properly
// means writing a correction and finding a source, and asking for that in the
// middle of a timed round is asking for nothing at all. So the round captures
// the paragraph and an optional note in one gesture, and the report is completed
// afterwards, from what was captured.
import { flagsApi } from '@wikifake/protocol';
import { decode } from '@wikifake/protocol';
import { useCallback, useEffect, useState } from 'react';

import { post, UNREADABLE, type Answer } from '../api.js';

/** Something a player noticed, kept until they can write it up. */
export interface Capture {
  /** Local, for the list key. Monotonic, not random: no hydration to break. */
  readonly id: string;
  /** 1-based, as everything about a paragraph is (C3.3). */
  readonly paragraphIndex: number;
  readonly paragraphText: string;
  readonly quickNote: string;
}

let counter = 0;

export interface CapturesState {
  readonly captures: readonly Capture[];
  capture(paragraphIndex: number, paragraphText: string, quickNote: string): void;
  drop(id: string): void;
}

/** What this round's player has flagged. Cleared with the round. */
export function useCaptures(roundKey: string): CapturesState {
  const [captures, setCaptures] = useState<readonly Capture[]>([]);

  useEffect(() => {
    setCaptures([]);
  }, [roundKey]);

  const capture = useCallback(
    (paragraphIndex: number, paragraphText: string, quickNote: string) => {
      counter += 1;
      // Taken here, not inside the updater. An updater runs during a later
      // render, so two calls in one batch would both read the counter after both
      // had incremented it — and two flags would share an id, which is a key
      // collision and a `drop` that removes the wrong one.
      const id = `flag-${String(counter)}`;
      setCaptures((was) => [...was, { id, paragraphIndex, paragraphText, quickNote }]);
    },
    [],
  );

  const drop = useCallback((id: string) => {
    setCaptures((was) => was.filter((each) => each.id !== id));
  }, []);

  return { captures, capture, drop };
}

/** `POST /api/flag-report` — the report goes up, the model's verdict comes back. */
export async function reportFlag(
  request: flagsApi.FlagReportRequest,
): Promise<Answer<flagsApi.FlagReportResponse>> {
  const answered = await post('/api/flag-report', request);
  if (!answered.ok) return answered;

  // Decoded, and this response is worth decoding: `verdict` and
  // `recommendation` come out of a language model, and the schema is what stops
  // a sixth value the prompt never listed reaching the screen.
  const read = decode(flagsApi.flagReportResponse, answered.value);
  return read.ok
    ? { ok: true, value: read.value }
    : { ok: false, message: UNREADABLE, code: null };
}

export interface VerdictReading {
  readonly headline: string;
  readonly tone: 'green' | 'bronze' | 'danger';
}

/**
 * What a verdict says, in words a player can act on.
 *
 * The three values are the contract's, and the mapping is exhaustive by type:
 * the current form prints whatever string the model produced, which is how a
 * value nobody planned for would be shown to a player as though it meant
 * something.
 */
export function readingOf(verification: flagsApi.FlagVerification): VerdictReading {
  switch (verification.verdict) {
    case 'likely_valid':
      return { headline: 'Looks right', tone: 'green' };
    case 'uncertain':
      return { headline: 'Not sure', tone: 'bronze' };
    case 'unsupported':
      return { headline: 'Not supported', tone: 'danger' };
  }
}

/** What happens to the report next. Also exhaustive, and also a closed union. */
export function fateOf(status: flagsApi.FlagStatus): string {
  switch (status) {
    case 'pending_human_review':
      return 'A person will look at it.';
    case 'ai_reviewed':
      return 'Recorded, with the check above.';
    case 'rejected_by_ai':
      return 'Recorded, but it will not go further as it stands.';
  }
}
