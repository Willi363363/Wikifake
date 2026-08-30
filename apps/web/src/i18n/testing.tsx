// The catalogue, for component tests.
//
// Since step 11.2 the round's components read their copy through `next-intl`,
// which resolves against `NextIntlClientProvider` — in production the root
// layout mounts it, so a test that renders a component without one is a test
// rendering a tree production never mounts. This wraps `render` with the
// English provider once, instead of every suite carrying its own.
//
// English deliberately: the suites assert the English copy, and the French
// rendering is proven where French is the point (`page.locale.test.tsx`,
// step 11.6's screens, and the attribution compliance suite of step 11.7,
// which uses `renderIn` below), not incidentally in every unit test.
import { render as renderBare, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import errorsEn from '../../messages/en/errors.json';
import homeEn from '../../messages/en/home.json';
import roundEn from '../../messages/en/round.json';
import waitingEn from '../../messages/en/waiting.json';
import lobbyEn from '../../messages/en/lobby.json';
import smallEn from '../../messages/en/small.json';
import routesEn from '../../messages/en/routes.json';
import languageEn from '../../messages/en/language.json';
import seoEn from '../../messages/en/seo.json';
import errorsFr from '../../messages/fr/errors.json';
import homeFr from '../../messages/fr/home.json';
import roundFr from '../../messages/fr/round.json';
import waitingFr from '../../messages/fr/waiting.json';
import lobbyFr from '../../messages/fr/lobby.json';
import smallFr from '../../messages/fr/small.json';
import routesFr from '../../messages/fr/routes.json';
import languageFr from '../../messages/fr/language.json';
import seoFr from '../../messages/fr/seo.json';
import type { CatalogueMessages } from './catalogue.js';
import type { Locale } from './locales.js';

/** Statically imported: a test harness has no business being async. */
const CATALOGUES: Record<Locale, CatalogueMessages> = {
  en: {
    home: homeEn,
    errors: errorsEn,
    round: roundEn,
    waiting: waitingEn,
    lobby: lobbyEn,
    small: smallEn,
    routes: routesEn,
    language: languageEn,
    seo: seoEn,
  },
  fr: {
    home: homeFr,
    errors: errorsFr,
    round: roundFr,
    waiting: waitingFr,
    lobby: lobbyFr,
    small: smallFr,
    routes: routesFr,
    language: languageFr,
    seo: seoFr,
  },
};

function Catalogue({
  locale,
  children,
}: {
  readonly locale: Locale;
  readonly children: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * `render`, with the catalogue of the given locale provided.
 *
 * For the suites where the locale is the point — proving a screen in French
 * is not the same claim as proving it in English, and the attribution (C6.1)
 * has to hold in every locale.
 */
export function renderIn(
  locale: Locale,
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> = {},
): ReturnType<typeof renderBare> {
  return renderBare(ui, {
    ...options,
    wrapper: ({ children }) => <Catalogue locale={locale}>{children}</Catalogue>,
  });
}

/**
 * `render`, with the English catalogue provided.
 *
 * A drop-in for `@testing-library/react`'s: the wrapper rides through
 * `rerender` too, so the `view.rerender(...)` idiom the suites use keeps
 * working unchanged.
 */
export function render(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> = {},
): ReturnType<typeof renderBare> {
  return renderIn('en', ui, options);
}
