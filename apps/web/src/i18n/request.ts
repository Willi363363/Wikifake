// What `next-intl` asks the server on every request: which locale, and which
// messages. Named by `createNextIntlPlugin` in `next.config.ts`; both the
// server components and `NextIntlClientProvider` read their configuration
// from here.
import { getRequestConfig } from 'next-intl/server';

import { messagesFor } from './catalogue.js';
import { DEFAULT_LOCALE } from './locales.js';

export default getRequestConfig(async () => {
  // Every live request is English for now: reading `Accept-Language` and the
  // player's explicit choice is step 11.3, localised routing is step 11.4.
  // This constant is the single line those steps replace.
  const locale = DEFAULT_LOCALE;

  return { locale, messages: await messagesFor(locale) };
});
