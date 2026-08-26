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
        <DialogTitle>Report a real error</DialogTitle>
        <DialogDescription>
          Not one of ours — something Wikipedia itself gets wrong. Pick the paragraph; the
          report is written up at the end of the round.
        </DialogDescription>

        <ul
          className="mt-4 max-h-[40vh] space-y-2 overflow-y-auto"
          role="radiogroup"
          aria-label="Which paragraph"
        >
          {paragraphs.map((text, at) => {
            const number = at + 1;
            return (
              <li key={number}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen === number}
                  aria-label={`Paragraph ${String(number)}`}
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
                  {text}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 space-y-1.5">
          <label htmlFor="flag-note" className="text-sm text-ink">
            A quick note, if you have one
          </label>
          <Input
            id="flag-note"
            value={note}
            maxLength={NOTE_LIMIT}
            placeholder="The date looks wrong"
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={close}>
            Cancel
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
            Flag it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
