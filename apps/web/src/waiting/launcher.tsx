'use client';

// What fills the wait: closed, the grid of six, or one of them being played.
//
// Three states in one union rather than the current `launcherState` string that
// holds "closed", "selector", or a game id — a string where a game id and a
// screen name are the same kind of thing is a string that will one day hold a
// game called "closed".
//
// Only one game is mounted at a time, and mounting is what starts its clock:
// six games idling behind a grid is six intervals for a screen that is meant to
// be waiting on a network call.
import { Button } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { MINIGAMES, minigameById } from './catalogue.js';

type View =
  | { readonly at: 'closed' }
  | { readonly at: 'grid' }
  | { readonly at: 'playing'; readonly id: string };

const CLOSED: View = { at: 'closed' };
const GRID: View = { at: 'grid' };

export function GameLauncher() {
  const t = useTranslations('waiting');
  const [view, setView] = useState<View>(CLOSED);

  if (view.at === 'closed') {
    return (
      <div className="mt-6 text-center">
        <Button
          onClick={() => {
            setView(GRID);
          }}
        >
          {t('launcher.open')}
        </Button>
      </div>
    );
  }

  if (view.at === 'grid') {
    return (
      <div className="mt-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MINIGAMES.map((game) => (
            // A button, not a card with an onClick. The current launcher uses
            // `<div onClick>`, which no keyboard can reach.
            <button
              key={game.id}
              type="button"
              onClick={() => {
                setView({ at: 'playing', id: game.id });
              }}
              className="flex flex-col items-center gap-1 rounded-lg border border-line bg-surface px-3 py-4 outline-none transition-colors hover:border-accent-line hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span aria-hidden="true" className="text-lg text-accent">
                {game.icon}
              </span>
              <span className="text-xs text-ink">{t(`games.${game.id}.name`)}</span>
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          className="mt-3 w-full"
          onClick={() => {
            setView(CLOSED);
          }}
        >
          {t('launcher.close')}
        </Button>
      </div>
    );
  }

  const game = minigameById(view.id);
  if (game === undefined) {
    // Unreachable through the grid, and cheap to make impossible to crash on.
    return null;
  }
  const { Play } = game;

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setView(GRID);
          }}
        >
          {/* The arrow is decoration, not copy: it stays out of the message and
              out of the button's accessible name. */}
          <span aria-hidden="true">← </span>
          {t('launcher.backToGames')}
        </Button>
        <p className="font-mono text-[10px] tracking-[0.14em] text-ink uppercase">
          {t(`games.${game.id}.name`)}
        </p>
      </div>
      <Play />
    </div>
  );
}
