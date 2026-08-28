'use client';

// Step 11.3 — the explicit switch.
//
// One link per locale, each pointing at the page the player is already on,
// under the other prefix. `Link` from `navigation.ts` does the two things the
// step asks: it navigates to the same path in the chosen language, and it
// writes the choice cookie the proxy reads ahead of `Accept-Language` — so
// the choice persists, and always wins over detection.
//
// Each language is named in itself — "English", "Français" — because the name
// a player is looking for is the one they can read. The keys exist in both
// catalogues all the same, so the parity test holds this zone like any other.
import { cn } from '@wikifake/ui';
import { useLocale, useTranslations } from 'next-intl';

import { LOCALES } from './locales.js';
import { Link, usePathname } from './navigation.js';

export function LocaleSwitch() {
  const t = useTranslations('language');
  const locale = useLocale();
  // The locale-less pathname: `/fr/play` and `/play` are both `/play` here,
  // which is what lets one `href` serve as "this page, in that language".
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')} className="flex items-center gap-3 text-xs">
      {LOCALES.map((candidate) => (
        <Link
          key={candidate}
          href={pathname}
          locale={candidate}
          aria-current={candidate === locale ? 'true' : undefined}
          className={cn(
            candidate === locale
              ? 'font-semibold text-ink'
              : 'text-muted underline-offset-4 hover:underline',
          )}
        >
          {t(`names.${candidate}`)}
        </Link>
      ))}
    </nav>
  );
}
