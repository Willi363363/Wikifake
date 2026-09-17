'use client';

// The room a connection did not come back to — step P.2.
//
// P.1 bounded the retry loop with the domain's own grace window: five attempts
// over thirty seconds, and then `lost`. This is what the player meets at the
// end of it.
//
// **A card over the room, and not a badge in its header.** Every other
// connection state describes a room that is still working, so a word in the
// corner is enough for them. This one describes a room that has stopped: the
// roster is frozen, the chat is dead, and nothing a player clicks does
// anything. A badge reading *connexion perdue* above that is the same lie as
// the *en attente* this track exists to remove, one word longer.
//
// It says the code, because the code is what a player needs to come back to
// the same room and the URL is not always in front of them — a phone in
// full-screen, a link opened from a message. And it offers two ways out rather
// than one: trying again is what a flapping network wants, and going home is
// what a service that is down wants. Neither is the obvious answer from the
// inside, so neither is chosen for them.
import { buttonVariants, Button } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export interface LostConnectionProps {
  /** Shown, because it is what gets a player back into the same room. */
  readonly roomCode: string;
  /** Restarts the loop from the first delay — the provider's `reconnect`. */
  onRetry(): void;
}

export function LostConnection({ roomCode, onRetry }: LostConnectionProps) {
  const t = useTranslations('lobby.lost');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <header className="text-center">
        <p className="text-xs tracking-widest text-muted uppercase">{t('eyebrow')}</p>
        <h1 className="font-mono text-3xl tracking-[0.2em] text-ink">{roomCode}</h1>
      </header>

      <p className="text-center text-sm text-ink-2">{t('body')}</p>

      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" onClick={onRetry}>
          {t('retry')}
        </Button>
        {/* Unprefixed, like every other screen here: the proxy resolves it
            against the player's locale cookie. */}
        <Link href="/" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
          {t('home')}
        </Link>
      </div>
    </main>
  );
}
