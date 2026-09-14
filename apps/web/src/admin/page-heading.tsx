'use client';

// What the open page is called — step K.3.
//
// K.1 made the panel eight routes and left the chassis saying *Admin* on all
// of them. That was right while every section was a block on one page with its
// own `h2`; it is wrong now, because the sections lost those headings when they
// became pages and a document whose only heading is the product's name tells a
// screen reader nothing about where it is.
//
// **The name comes from `sections.ts`**, which is the list the rail is built
// from. The rail and the heading saying different words would be two names for
// one thing — the same reason K.1 put the sections in data rather than in
// markup.
import { useTranslations } from 'next-intl';

import { usePathname } from '../i18n/navigation.js';
import { sectionAt } from './sections.js';

export function PageHeading() {
  const t = useTranslations('admin');
  const here = usePathname();
  const section = sectionAt(here);

  return (
    <h1 className="m-0 truncate text-xl font-extrabold text-ink sm:text-2xl">
      {/* A route with no entry is a page nobody can reach from the rail, and
          `sections.test.ts` fails on one — so the panel's own name is a
          fallback that should never be reached rather than a second answer. */}
      {t(section?.key ?? 'title')}
    </h1>
  );
}
