// Step 11.1 — the proof screen: the front door, rendered through the i18n
// library in both locales.
//
// This is the step's "done when" made executable: `next-intl` is not wired
// until one real screen renders from the catalogue in English *and* in
// French. Rendered server-side to a string, because that is what the page is
// in production — a server component — and because a screen proven by
// `renderToStaticMarkup` is proven with no DOM to hide behind.
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { messagesFor } from '../src/i18n/catalogue.js';
import type { Locale } from '../src/i18n/locales.js';
import { SITE_DESCRIPTION } from '../src/indexing.js';

import HomePage from './page.js';

/** The page as one locale's player receives it. */
async function frontDoorIn(locale: Locale): Promise<string> {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={await messagesFor(locale)}>
      <HomePage />
    </NextIntlClientProvider>,
  );
}

describe('11.1 — the front door renders from the catalogue', () => {
  it('speaks English under the en locale', async () => {
    const html = await frontDoorIn('en');
    expect(html).toContain('Pick a subject');
    expect(html).toContain('>Play<');
  });

  it('speaks French under the fr locale', async () => {
    const html = await frontDoorIn('fr');
    expect(html).toContain('Choisissez un sujet');
    expect(html).toContain('>Jouer<');
    // Whole screen, not a sprinkling: the English copy must be gone.
    expect(html).not.toContain('Pick a subject');
    expect(html).not.toContain('>Play<');
  });

  it('keeps the English description in step with the metadata', async () => {
    // `layout.tsx` still serves `SITE_DESCRIPTION` to crawlers until step 11.5
    // makes the metadata per-locale. Since step 11.2 that constant reads the
    // catalogue's `routes` zone, so the same sentence exists twice — the
    // `home` and `routes` zone files — and this is what stops them drifting
    // apart quietly.
    expect(await frontDoorIn('en')).toContain(SITE_DESCRIPTION);
  });
});
