'use client';

// Phase one: the paragraph, and a note if there is time for one.
//
// A real dialog, from step 6.2. The current capture modal is a fixed `<div>` that
// installs its own `keydown` listener for Escape and its own `mousedown`
// listener for the click-outside — behind a `setTimeout(…, 50)`, because
// otherwise the click that opened it closes it again. All three are what a
// dialog primitive is for.
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** How long a note may be. `quickNote` in the contract caps it at 500. */
export const NOTE_LIMIT = 500;

export interface FlagCaptureProps {
  readonly open: boolean;
  readonly paragraphs: readonly string[];
  onOpenChange(open: boolean): void;
  onCapture(paragraphIndex: number, paragraphText: string, quickNote: string): void;
}

export function FlagCapture({
  open,
  paragraphs,
  onOpenChange,
  onCapture,
}: FlagCaptureProps) {
  const t = useTranslations('small.flags.capture');
  const [chosen, setChosen] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const close = (): void => {
    setChosen(null);
    setNote('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('description')}</DialogDescription>

        <ul
          className="mt-4 max-h-[40vh] space-y-2 overflow-y-auto"
          role="radiogroup"
          aria-label={t('paragraphGroup')}
        >
          {paragraphs.map((text, at) => {
            const number = at + 1;
            return (
              <li key={number}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen === number}
                  aria-label={t('paragraphOption', { number })}
                  onClick={() => {
                    setChosen(number);
                  }}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left text-[13px] leading-snug',
                    'outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    chosen === number
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-surface text-ink-2 hover:border-line-strong',
                  )}
                >
                  <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                    {String(number).padStart(2, '0')}
                  </span>{' '}
                  {/* A paragraph of the fr.wikipedia.org article: data, not
                      interface copy — it keeps its own language whatever the
                      interface locale. */}
                  <span lang="fr">{text}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 space-y-1.5">
          <label htmlFor="flag-note" className="text-sm text-ink">
            {t('noteLabel')}
          </label>
          <Input
            id="flag-note"
            value={note}
            maxLength={NOTE_LIMIT}
            placeholder={t('notePlaceholder')}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={close}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            className="flex-[2]"
            disabled={chosen === null}
            onClick={() => {
              if (chosen === null) return;
              onCapture(chosen, paragraphs[chosen - 1] ?? '', note.trim());
              close();
            }}
          >
            {t('confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
