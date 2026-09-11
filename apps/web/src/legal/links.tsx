// Step J.3 — the two links, in the one surface every screen shares.
//
// The footer of `app/[locale]/layout.tsx` already exists and already holds the
// language switch, which step 11.3 put there for the same reason these go
// there: a document has to be reachable from wherever somebody happens to be
// when they want it. A policy linked only from the landing is a policy a player
// in a round cannot find.
//
// `Link` from `navigation.ts`, not `next/link`: it keeps the locale prefix, so
// a French player reading `/fr/play` is offered `/fr/privacy` rather than
// dropped into English.
import { useTranslations } from 'next-intl';

import { Link } from '../i18n/navigation.js';

export function LegalLinks() {
  const t = useTranslations('legal');

  return (
    <nav aria-label={t('nav')} className="flex items-center gap-3 text-xs text-muted">
      <Link className="underline-offset-4 hover:underline" href="/faq">
        {t('faq.title')}
      </Link>
      <Link className="underline-offset-4 hover:underline" href="/privacy">
        {t('privacy.title')}
      </Link>
      <Link className="underline-offset-4 hover:underline" href="/terms">
        {t('terms.title')}
      </Link>
    </nav>
  );
}
