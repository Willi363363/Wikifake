'use client';

// What was flagged, once there is time to write it up.
//
// Shown in the debrief, which is where the round's own promise lands: the
// capture toast says "written up at the end", and this is the end.
import { Button } from '@wikifake/ui';
import { useState } from 'react';

import { FlagReport } from './report.js';
import type { Capture } from './flags.js';

export interface FlagPanelProps {
  readonly captures: readonly Capture[];
  readonly articleTitle: string;
  readonly articleUrl: string;
  readonly roomCode: string;
  onDrop(id: string): void;
}

export function FlagPanel({
  captures,
  articleTitle,
  articleUrl,
  roomCode,
  onDrop,
}: FlagPanelProps) {
  const [writing, setWriting] = useState<string | null>(null);

  // Nothing flagged, nothing to say. A section headed "nothing to report" is a
  // section that has to be scrolled past.
  if (captures.length === 0) return null;

  return (
    <section
      aria-label="What you flagged"
      className="rounded-xl border border-line bg-surface p-6 shadow-md"
    >
      <h2 className="text-sm font-medium text-ink">What you flagged</h2>
      <p className="mt-1 text-xs text-muted">
        Real errors in the source article, not the ones we put there. Write one up and it
        is checked, then kept.
      </p>

      <ul className="mt-4 space-y-3">
        {captures.map((capture) => (
          <li key={capture.id}>
            {writing === capture.id ? (
              <FlagReport
                capture={capture}
                articleTitle={articleTitle}
                articleUrl={articleUrl}
                roomCode={roomCode}
                onDone={(id) => {
                  setWriting(null);
                  onDrop(id);
                }}
                onCancel={() => {
                  setWriting(null);
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-bg-grain px-3 py-2">
                <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                  paragraph {String(capture.paragraphIndex)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                  {capture.quickNote === '' ? capture.paragraphText : capture.quickNote}
                </span>
                <Button
                  variant="ghost"
                  aria-label={`Write up the report for paragraph ${String(capture.paragraphIndex)}`}
                  onClick={() => {
                    setWriting(capture.id);
                  }}
                >
                  Write it up
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Discard the flag on paragraph ${String(capture.paragraphIndex)}`}
                  onClick={() => {
                    onDrop(capture.id);
                  }}
                >
                  ✕
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
