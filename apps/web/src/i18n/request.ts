// What `next-intl` asks the server on every request: which locale, and which
// messages. Named by `createNextIntlPlugin` in `next.config.ts`; both the
// server components and `NextIntlClientProvider` read their configuration
// from here.
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { messagesFor } from './catalogue.js';
import { TIME_ZONE } from './locales.js';
import { routing } from './routing.js';

export default getRequestConfig(async ({ requestLocale }) => {
  // The `[locale]` segment the proxy routed this request to (steps 11.3 and
  // 11.4): the URL prefix when there is one, otherwise the player's cookie,
  // then `Accept-Language`, then English. Validated rather than trusted — the
  // proxy never routes an unknown value here, but this function is also what
  // a direct render gets, and a bad segment must fall back to English rather
  // than fail to load messages.
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  // `timeZone` is not optional in practice: without it the server formats in
  // the machine's zone and the browser in the viewer's, and a date rendered on
  // one and hydrated on the other can differ by a day. See `TIME_ZONE`.
  return { locale, timeZone: TIME_ZONE, messages: await messagesFor(locale) };
});
