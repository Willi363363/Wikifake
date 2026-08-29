// What `next-intl` asks the server on every request: which locale, and which
// messages. Named by `createNextIntlPlugin` in `next.config.ts`; both the
// server components and `NextIntlClientProvider` read their configuration
// from here.
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { messagesFor } from './catalogue.js';
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

  return { locale, messages: await messagesFor(locale) };
});
