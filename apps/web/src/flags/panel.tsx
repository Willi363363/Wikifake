'use client';

// What was flagged, once there is time to write it up.
//
// Shown in the debrief, which is where the round's own promise lands: the
// capture toast says "written up at the end", and this is the end.
import { Button } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('small.flags');
  const [writing, setWriting] = useState<string | null>(null);

  // Nothing flagged, nothing to say. A section headed "nothing to report" is a
  // section that has to be scrolled past.
  if (captures.length === 0) return null;

  return (
    <section
      aria-label={t('panel.title')}
      className="rounded-xl border border-line bg-surface p-6 shadow-md"
    >
      <h2 className="text-sm font-medium text-ink">{t('panel.title')}</h2>
      <p className="mt-1 text-xs text-muted">{t('panel.description')}</p>

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
                  {t('paragraphTag', { number: capture.paragraphIndex })}
                </span>
                {/* The fallback preview is the flagged paragraph — French
                    article text, so it carries its own `lang`. The quick note
                    is the player's own words and carries none. */}
                {capture.quickNote === '' ? (
                  <span lang="fr" className="min-w-0 flex-1 truncate text-sm text-ink-2">
                    {capture.paragraphText}
                  </span>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-2">
                    {capture.quickNote}
                  </span>
                )}
                <Button
                  variant="ghost"
                  aria-label={t('panel.writeUpAria', { number: capture.paragraphIndex })}
                  onClick={() => {
                    setWriting(capture.id);
                  }}
                >
                  {t('panel.writeUp')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('panel.discardAria', { number: capture.paragraphIndex })}
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
