'use client';

// Phase two: what the player thinks it should say, and what the model makes of
// that.
//
// One capture at a time. The current form walks a list of them with an index and
// a shared `currentForm`, so a field typed for one report is still in the box for
// the next; here a report is completed and closed, and the next one starts empty
// because it is a different mount.
import type { flagsApi } from '@wikifake/protocol';
import { Badge, Button, Input, Label, Separator } from '@wikifake/ui';
import { useId, useState, type FormEvent } from 'react';

import { fateOf, readingOf, reportFlag, type Capture } from './flags.js';

export interface FlagReportProps {
  readonly capture: Capture;
  readonly articleTitle: string;
  readonly articleUrl: string;
  /** The room this happened in, or '' in solo. */
  readonly roomCode: string;
  onDone(id: string): void;
  onCancel(): void;
}

/** One URL per line, which is how the current form takes them. */
function urlsIn(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export function FlagReport({
  capture,
  articleTitle,
  articleUrl,
  roomCode,
  onDone,
  onCancel,
}: FlagReportProps) {
  const ids = useId();
  const [correction, setCorrection] = useState('');
  const [explanation, setExplanation] = useState('');
  const [sources, setSources] = useState('');
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [answer, setAnswer] = useState<flagsApi.FlagReportResponse | null>(null);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (busy || correction.trim() === '') return;

    setBusy(true);
    setRefusal(null);
    void (async () => {
      const sent = await reportFlag({
        articleTitle,
        articleUrl,
        flaggedClaim: capture.paragraphText,
        proposedCorrection: correction.trim(),
        quickNote: capture.quickNote,
        explanation: explanation.trim(),
        sources: urlsIn(sources),
        // C4 — the route attributes the report to the account that sent it and
        // ignores whoever the payload claims to be, so there is nothing to say
        // here.
        playerId: 'anonymous',
        roomCode,
      });
      if (sent.ok) setAnswer(sent.value);
      else setRefusal(sent.message);
      setBusy(false);
    })();
  };

  if (answer !== null) {
    const reading = readingOf(answer.verification);
    return (
      <div
        role="status"
        className="rounded-lg border border-line bg-bg-grain p-4"
        aria-label="What the check found"
      >
        <p className="flex flex-wrap items-center gap-2">
          <Badge tone={reading.tone}>{reading.headline}</Badge>
          <span className="font-mono text-xs tabular-nums text-muted">
            {String(answer.verification.confidence)}% sure
          </span>
        </p>
        <p className="mt-2 text-sm text-ink-2">{answer.verification.reasoning}</p>

        {answer.verification.sourcesFound.length === 0 ? null : (
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {answer.verification.sourcesFound.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-muted">{fateOf(answer.status)}</p>

        <Button
          variant="ghost"
          className="mt-3 w-full"
          onClick={() => {
            onDone(capture.id);
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-bg-grain p-4">
      <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        paragraph {String(capture.paragraphIndex)}
      </p>
      <p className="mt-1 text-sm text-ink italic">“{capture.paragraphText}”</p>
      {capture.quickNote === '' ? null : (
        <p className="mt-1 text-xs text-muted">Your note: {capture.quickNote}</p>
      )}

      <Separator className="my-4" />

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-correction`}>What it should say</Label>
          <Input
            id={`${ids}-correction`}
            value={correction}
            maxLength={2000}
            onChange={(event) => {
              setCorrection(event.target.value);
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-why`}>Why, if you can say</Label>
          <Input
            id={`${ids}-why`}
            value={explanation}
            maxLength={2000}
            onChange={(event) => {
              setExplanation(event.target.value);
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-sources`}>Sources, one link per line</Label>
          <textarea
            id={`${ids}-sources`}
            value={sources}
            rows={2}
            onChange={(event) => {
              setSources(event.target.value);
            }}
            className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Not now
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-[2]"
          disabled={busy || correction.trim() === ''}
        >
          {busy ? 'Checking…' : 'Send the report'}
        </Button>
      </div>

      {refusal === null ? null : (
        <p role="alert" className="mt-3 text-sm text-danger">
          {refusal}
        </p>
      )}
    </form>
  );
}
