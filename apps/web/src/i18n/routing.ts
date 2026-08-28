// Where each locale lives in a URL, and how a request without one is read.
//
// `as-needed` rather than `always`, because of C7.3: `GET /` must answer HTML
// 200 with a non-empty `<title>`, and under `always` it would answer 307 and
// no document at all. So English — the default — keeps the unprefixed URLs
// the contract and the sitemap already name, and French lives under `/fr`. A
// URL still identifies its language, which is what step 11.4 asks: unprefixed
// is English, `/fr/...` is French.
//
// The cookie is what makes the explicit switch a *choice* (step 11.3): the
// proxy reads it ahead of `Accept-Language`, so a player who picked a
// language keeps it whatever their browser announces. A year rather than the
// session-lived default, because "survives a reload" is the floor of the
// step's criterion, not its ceiling.
import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LOCALE, LOCALES } from './locales.js';

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed',
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
  // The `Link` response header naming every locale's alternate URL is
  // per-locale SEO, and step 11.5 owns that surface — together with the
  // `hreflang` metadata it has to stay consistent with. Emitting half of it
  // here would be the drift 11.5 exists to prevent.
  alternateLinks: false,
});
