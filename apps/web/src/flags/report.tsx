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
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('small.flags');
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
        aria-label={t('report.resultAria')}
      >
        <p className="flex flex-wrap items-center gap-2">
          <Badge tone={reading.tone}>{t(`verdict.${reading.id}`)}</Badge>
          <span className="font-mono text-xs tabular-nums text-muted">
            {t('report.confidence', { confidence: answer.verification.confidence })}
          </span>
        </p>
        {/* The reasoning is the model's own output, shown as received: its
            language is whatever the model produced, not the interface's. */}
        <p className="mt-2 text-sm text-ink-2">{answer.verification.reasoning}</p>

        {answer.verification.sourcesFound.length === 0 ? null : (
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {answer.verification.sourcesFound.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-muted">{t(`fate.${fateOf(answer.status)}`)}</p>

        <Button
          variant="ghost"
          className="mt-3 w-full"
          onClick={() => {
            onDone(capture.id);
          }}
        >
          {t('report.done')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-bg-grain p-4">
      <p className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        {t('paragraphTag', { number: capture.paragraphIndex })}
      </p>
      <p className="mt-1 text-sm text-ink italic">
        {/* The quotation marks are the interface's — French quotes «» differ
            from English “” — while the quoted paragraph is fr.wikipedia.org
            text and keeps its own `lang` whatever the interface locale. */}
        {t.rich('report.quoted', {
          text: capture.paragraphText,
          fr: (quoted) => <span lang="fr">{quoted}</span>,
        })}
      </p>
      {capture.quickNote === '' ? null : (
        <p className="mt-1 text-xs text-muted">
          {t('report.yourNote', { note: capture.quickNote })}
        </p>
      )}

      <Separator className="my-4" />

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-correction`}>{t('report.correctionLabel')}</Label>
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
          <Label htmlFor={`${ids}-why`}>{t('report.explanationLabel')}</Label>
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
          <Label htmlFor={`${ids}-sources`}>{t('report.sourcesLabel')}</Label>
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
          {t('report.notNow')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-[2]"
          disabled={busy || correction.trim() === ''}
        >
          {busy ? t('report.checking') : t('report.send')}
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
