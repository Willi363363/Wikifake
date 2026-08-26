'use client';

// The solo journey: a topic, a wait, a round, a score.
//
// Three screens and two requests. The generation screen of 7.5 is the same
// component the room uses — what differs is who decides `ready`, and here it is
// a resolved request rather than a socket message, which is exactly what that
// step was for.
//
// The topic arrives in the query string because the entry screen of 7.2 put it
// there: solo has no room, no socket and no nickname — the round is played by
// whoever is holding the browser.
import { decode, topicLabel, type gameApi } from '@wikifake/protocol';
import { buttonVariants } from '@wikifake/ui';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { startRound, submitRound } from './api.js';
import { SoloRound } from './round.js';
import { SoloScore } from './score.js';
import { GenerationScreen } from '../lobby/generation.js';

/**
 * The topic, if it is one the server could be asked about.
 *
 * The query string is not a trusted input: it is whatever is in the address bar.
 * Validated against the same `topicLabel` the route decodes with, so a hand-typed
 * URL is refused here rather than by a 400 after a round trip.
 */
function validTopic(topic: string | null): string | null {
  if (topic === null || topic === '') return null;
  const read = decode(topicLabel, topic);
  return read.ok ? read.value : null;
}

export interface SoloGameProps {
  /** What the entry screen collected. Absent or malformed sends the player back. */
  readonly topic: string | null;
}

export function SoloGame({ topic }: SoloGameProps) {
  const valid = validTopic(topic);

  const [round, setRound] = useState<gameApi.StartGameResponse | null>(null);
  const [result, setResult] = useState<gameApi.SubmitResponse | null>(null);
  const [entered, setEntered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // Guards the one request that must not be repeated. Without it React's
  // development double-mount generates the article twice — two model calls, two
  // rows, and a bill for a round nobody played.
  const asked = useRef(false);

  useEffect(() => {
    if (valid === null || asked.current) return;
    asked.current = true;

    void (async () => {
      const answered = await startRound({ topic: valid });
      if (answered.ok) setRound(answered.value);
      else setRefusal(answered.message);
    })();
  }, [valid]);

  if (valid === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold text-ink">Solo</h1>
        <p role="alert" className="text-sm text-danger">
          {topic === null || topic === ''
            ? 'No topic was given.'
            : 'That topic is not one we can look up.'}
        </p>
        <Back />
      </main>
    );
  }

  // The generation failed, and there is nothing to wait for. Said here rather
  // than under a bar that would fill for ever.
  if (round === null && refusal !== null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold text-ink">{valid}</h1>
        <p role="alert" className="text-sm text-danger">
          {refusal}
        </p>
        <Back />
      </main>
    );
  }

  if (result !== null) return <SoloScore topic={valid} result={result} />;

  // The screen outlives the arrival of the round on purpose: it stays until its
  // bar has been seen to fill, and it is the screen that decides when that is.
  if (round === null || !entered) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
        <GenerationScreen
          topic={valid}
          proposer={null}
          ready={round !== null}
          onEnter={() => {
            setEntered(true);
          }}
        />
      </main>
    );
  }

  const submit = (marked: readonly number[]): void => {
    if (busy) return;
    setBusy(true);
    setRefusal(null);

    void (async () => {
      const answered = await submitRound({
        sessionId: round.sessionId,
        marked: [...marked],
      });
      if (answered.ok) setResult(answered.value);
      else setRefusal(answered.message);
      setBusy(false);
    })();
  };

  return <SoloRound round={round} busy={busy} refusal={refusal} onSubmit={submit} />;
}

function Back() {
  return (
    <p>
      <Link href="/play" className={buttonVariants({ variant: 'ghost' })}>
        Back
      </Link>
    </p>
  );
}
