'use client';

// The two controls every minigame shares.
//
// The current games each grow their own: a `<button className="back-to-launcher">`
// inside the Snake overlay, an automatic re-deal in `MemoryCards`, nothing at all
// in `PatternMatch`. The step asks that all six "launch and replay", so replay is
// one control with one label rather than six inventions — and a player who has
// finished a game does not have to work out which of them offers a way back.
import { Button } from '@wikifake/ui';

export interface PlayAgainProps {
  onClick(): void;
}

/** The same label in all six, so a player learns it once. */
export const PLAY_AGAIN = 'Play again';

export function PlayAgain({ onClick }: PlayAgainProps) {
  return (
    <Button variant="ghost" onClick={onClick}>
      {PLAY_AGAIN}
    </Button>
  );
}

export interface GameOverProps {
  onRestart(): void;
}

/** The overlay the two arcade games end on. */
export function GameOver({ onRestart }: GameOverProps) {
  return (
    <div
      // Above the board, and announced: a game that has ended looks exactly
      // like a game nobody is playing.
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-glass-strong backdrop-blur-sm"
      role="status"
    >
      <p className="text-2xl text-ink">Game over</p>
      <PlayAgain onClick={onRestart} />
    </div>
  );
}
