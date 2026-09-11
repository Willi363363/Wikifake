'use client';

// Step E.6 — the invitation, at the one moment it is worth anything.
//
// The mechanism that keeps a guest's rounds has existed since 4.3: a guest holds
// a real anonymous `user` row, and `onLinkAccount` moves their games and their
// statistics onto the account they create afterwards. It is tested at every
// level and it works.
//
// **Nobody was ever told.** The only pointer to an account was E.5's link on the
// entry screen, which a player passes *before* they have anything to keep and
// which says nothing about keeping it. Continuity nobody is invited to use is
// continuity nobody uses, and a guest who closes the tab after a good round
// loses it — not to a defect, but to a sentence that was never written.
//
// So it is here, on the debrief, beside the score. That is the only moment when
// "keep this" names something the player can see.
import { buttonVariants } from '@wikifake/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { authClient } from './client.js';

/**
 * Offered to a guest, and to nobody else.
 *
 * Read from the *client's* session rather than passed down, and that is a
 * decision rather than a shortcut. `/solo` is a prerendered static page — E.3.2
 * kept it that way on purpose — so there is no server component above this one
 * to ask, and threading the answer through the round would mean a protocol field
 * on the solo submission *and* a second one on the room's `game_end`, for a
 * question that is about the browser's identity rather than about the round.
 *
 * Three states, and only one of them shows anything:
 *
 *   - **pending** — nothing. A block that appears a moment after the debrief
 *     has settled is a block that moves the button under the player's cursor;
 *   - **a guest** — the invitation;
 *   - **an account, or no session at all** — nothing. An account has already
 *     kept the round. No session means no round was played by anybody, which on
 *     this screen means the session request did not arrive: inventing an
 *     invitation out of a failed fetch would tell a signed-in player their round
 *     is about to be lost.
 */
export function KeepRound() {
  const t = useTranslations('account.keepRound');
  const { data, isPending } = authClient.useSession();

  if (isPending || data === null) return null;
  if (data.user.isAnonymous !== true) return null;

  return (
    // A wash carries `ink`, never a fill — `fills.test.ts`. The structural
    // border and the hard shadow are the direction's, and the corners stay
    // square.
    <section
      aria-label={t('aria')}
      className="mt-6 border-3 border-line-strong bg-accent-soft p-4 shadow-md"
    >
      <h3 className="text-sm font-medium text-ink">{t('title')}</h3>
      <p className="mt-1 text-sm text-ink-2">{t('lead')}</p>
      <Link
        href="/sign-up"
        className={buttonVariants({ variant: 'primary', className: 'mt-4' })}
      >
        {t('cta')}
      </Link>
    </section>
  );
}
