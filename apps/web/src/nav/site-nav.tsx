'use client';

// The bar every screen carries — step L.4.
//
// The layout's own comment used to say that *"a layout that started deciding
// navigation would be deciding the screens here"*, and that restraint was right
// while there were no screens. There are ten now, and the cost of the restraint
// was measured: three clicks to the shop, and no path at all to the panel.
//
// **The phone menu is a checkbox, not state.** `peer-checked` opens it with the
// stylesheet alone, so it works in a browser whose JavaScript failed — which is
// exactly when somebody needs to leave the page they are stuck on. The lab
// learned this the expensive way: its first narrow layout depended on an effect,
// and the effect was the thing that had broken.
//
// **`aria-current` announces the page**, because a colour is visible and not
// audible.
import { useTranslations } from 'next-intl';

import { Link, usePathname } from '../i18n/navigation.js';
import { destinationsFor, type Destination } from './destinations.js';

export interface SiteNavProps {
  /** Decided on the server. A non-admin is handed no entry at all. */
  readonly isAdmin: boolean;
}

const ENTRY = 'text-[14px] whitespace-nowrap transition-colors';

function useLabel(): (one: Destination) => string {
  const home = useTranslations('home');
  const quests = useTranslations('quests');
  const shop = useTranslations('shop');
  const board = useTranslations('leaderboard');
  const admin = useTranslations('admin');

  return (one: Destination) => {
    if (one.zone === 'quests') return quests('title');
    if (one.zone === 'shop') return shop('title');
    if (one.zone === 'leaderboard') return board('title');
    if (one.zone === 'admin') return admin('title');
    return home(one.key as 'play');
  };
}

export function SiteNav({ isAdmin }: SiteNavProps) {
  const t = useTranslations('home');
  const here = usePathname();
  const label = useLabel();
  const entries = destinationsFor(isAdmin);

  return (
    <header className="flex items-center gap-4 px-5 py-4 sm:px-8">
      <Link href="/" className="shrink-0 text-[17px] font-semibold tracking-[-0.01em]">
        {t('title')}
      </Link>

      <nav
        aria-label={t('nav.menu')}
        className="ml-auto hidden items-center gap-7 md:flex"
      >
        {entries.map((one) => (
          <Link
            key={one.route}
            href={one.route}
            aria-current={here === one.route ? 'page' : undefined}
            className={`${ENTRY} ${here === one.route ? 'font-semibold text-ink' : 'text-muted'}`}
          >
            {label(one)}
          </Link>
        ))}
      </nav>

      <input id="site-menu" type="checkbox" className="peer sr-only md:hidden" />
      <label
        htmlFor="site-menu"
        className="ml-auto min-h-11 cursor-pointer rounded-full border-1 border-line px-4 py-1.5 text-[14px] leading-8 md:hidden"
      >
        {t('nav.menu')}
      </label>
      <div className="fixed inset-0 z-40 hidden flex-col gap-1 bg-bg px-6 pt-24 peer-checked:flex md:hidden">
        <label
          htmlFor="site-menu"
          className="absolute top-6 right-6 min-h-11 cursor-pointer text-[14px] leading-11 text-muted"
        >
          {t('nav.close')}
        </label>
        {entries.map((one) => (
          <Link
            key={one.route}
            href={one.route}
            aria-current={here === one.route ? 'page' : undefined}
            className="border-b-1 border-line py-4 text-[24px] font-medium"
          >
            {label(one)}
          </Link>
        ))}
      </div>
    </header>
  );
}
