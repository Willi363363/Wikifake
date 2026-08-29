'use client';

// RICKROLL — the pop-up, and the only effect that waits to be dismissed.
//
// Which is why it is the one effect that takes clicks: everything else is
// `pointer-events-none`, because an item that makes the article hard to read is
// not an item that stops the player marking a paragraph.
//
// Not a `Dialog`. It is not the player's dialog — it is something done *to*
// them — and trapping their focus in it would mean an item that takes the
// keyboard away until it is closed. It has a close button, and nothing else.
import { Button } from '@wikifake/ui';
import { useTranslations } from 'next-intl';

export interface RickrollProps {
  onDismiss(): void;
}

export function Rickroll({ onDismiss }: RickrollProps) {
  const t = useTranslations('round');

  return (
    <div
      role="status"
      aria-label={t('effects.rickroll.aria')}
      className="fixed inset-x-3 top-24 z-50 mx-auto max-w-sm animate-slide-up-fade rounded-xl border border-line-strong bg-surface p-5 text-center shadow-lg"
    >
      <p aria-hidden="true" className="text-4xl">
        🤡
      </p>
      {/* The lyric is a cultural reference: a translation may localise the
          joke rather than the words. */}
      <p className="mt-2 text-lg text-ink">{t('effects.rickroll.headline')}</p>
      <p className="mt-1 text-sm text-muted">{t('effects.rickroll.body')}</p>
      <Button variant="ghost" className="mt-4 w-full" onClick={onDismiss}>
        {t('effects.rickroll.close')}
      </Button>
    </div>
  );
}
