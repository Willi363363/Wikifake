'use client';

// The ranking, pinned to a corner while the round runs.
//
// Collapsed it shows the leader; opened, the whole list. The current one expands
// on `onMouseEnter` and collapses on `onMouseLeave`, which no keyboard can do and
// no touch screen has — so it is a button, like the chat handle of 7.7.
//
// The sidebar variant (`Leaderboard.jsx`) is not ported: nothing renders it.
import { Button, cn, Progress } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { Standing } from './leaderboard.js';

export interface LiveRankingProps {
  readonly standings: readonly Standing[];
}

export function LiveRanking({ standings }: LiveRankingProps) {
  const t = useTranslations('round');
  const [open, setOpen] = useState(false);

  // Alone in a room, a ranking of one is furniture.
  if (standings.length < 2) return null;

  const leader = standings[0];
  // The bar is relative to the leader, so it says "how far behind" rather than
  // "how close to a number nobody knows".
  const most = Math.max(1, leader?.score ?? 1);

  return (
    <aside
      aria-label={t('liveRanking.aria')}
      className="fixed bottom-3 left-3 z-30 w-[min(17rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-glass-strong shadow-md backdrop-blur-md"
    >
      <Button
        variant="ghost"
        className="w-full justify-between rounded-none border-0"
        aria-expanded={open}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
          {t('liveRanking.header', { count: standings.length })}
        </span>
        {open ? (
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {t('liveRanking.close')}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="text-xs text-ink">{leader?.name}</span>
            <span className="font-mono text-xs tabular-nums text-ink">
              {String(leader?.score ?? 0)}
            </span>
          </span>
        )}
      </Button>

      {!open ? null : (
        <ol
          // Polite, and it is a list: a score changing five times a second is
          // not worth interrupting anybody for, and the order is the content.
          aria-live="polite"
          className="space-y-2.5 border-t border-line px-3 py-3"
        >
          {standings.map((standing, at) => (
            <li
              key={standing.name}
              className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-2"
            >
              <span
                className={cn(
                  'font-mono text-[11px] font-semibold tabular-nums',
                  at === 0 ? 'text-bronze' : 'text-muted',
                )}
              >
                {String(at + 1).padStart(2, '0')}
              </span>

              <span className="min-w-0">
                <span
                  className={cn(
                    'block truncate text-xs text-ink',
                    standing.you && 'font-semibold',
                  )}
                >
                  {standing.name}
                  {/* The separator is layout; only the word is translated. */}
                  {standing.you ? (
                    <span className="text-muted">{` · ${t('liveRanking.you')}`}</span>
                  ) : null}
                </span>
                <Progress
                  value={Math.max(0, standing.score)}
                  max={most}
                  className="mt-1"
                  aria-label={t('liveRanking.progressAria', {
                    name: standing.name,
                    score: standing.score,
                  })}
                />
              </span>

              <span className="font-mono text-xs font-semibold tabular-nums text-ink">
                {String(standing.score)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
