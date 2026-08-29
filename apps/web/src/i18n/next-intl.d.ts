// Typed message keys: `useTranslations('home')` only accepts keys that exist
// in the English catalogue, and a typo in a key is a compile error instead of
// a raw identifier on a screen. English defines the shape; `catalogue.test.ts`
// holds the other locales to it.
import type { CatalogueMessages } from './catalogue.js';
import type { Locale } from './locales.js';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: CatalogueMessages;
  }
}
