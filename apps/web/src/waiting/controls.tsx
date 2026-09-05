'use client';

// The two controls every minigame shares.
//
// The current games each grow their own: a `<button className="back-to-launcher">`
// inside the Snake overlay, an automatic re-deal in `MemoryCards`, nothing at all
// in `PatternMatch`. The step asks that all six "launch and replay", so replay is
// one control with one label rather than six inventions — and a player who has
// finished a game does not have to work out which of them offers a way back.
//
// The label itself is the catalogue's (`controls.playAgain`): one key shared by
// all six games, so a player still learns it once, in any locale.
import { Button } from '@wikifake/ui';
import { useTranslations } from 'next-intl';

export interface PlayAgainProps {
  onClick(): void;
}

export function PlayAgain({ onClick }: PlayAgainProps) {
  const t = useTranslations('waiting');
  return (
    <Button variant="ghost" onClick={onClick}>
      {t('controls.playAgain')}
    </Button>
  );
}

export interface GameOverProps {
  onRestart(): void;
}

/** The overlay the two arcade games end on. */
export function GameOver({ onRestart }: GameOverProps) {
  const t = useTranslations('waiting');
  return (
    <div
      // Above the board, and announced: a game that has ended looks exactly
      // like a game nobody is playing.
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface"
      role="status"
    >
      <p className="text-2xl text-ink">{t('controls.gameOver')}</p>
      <PlayAgain onClick={onRestart} />
    </div>
  );
}
