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

import { messagesFor } from '../../src/i18n/catalogue.js';
import type { Locale } from '../../src/i18n/locales.js';

import HomePage from './page.js';

/** The page as one locale's player receives it. */
async function frontDoorIn(locale: Locale): Promise<string> {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={await messagesFor(locale)}>
      <HomePage />
    </NextIntlClientProvider>,
  );
}

// The screen these assertions read is `src/landing/` since step C.1, so the
// sentences moved. The claim did not: one real screen, rendered from the
// catalogue, whole, in each locale.
describe('11.1 — the front door renders from the catalogue', () => {
  it('speaks English under the en locale', async () => {
    const html = await frontDoorIn('en');
    expect(html).toContain('Who is lying?');
    expect(html).toContain('It starts with a real article');
    expect(html).toContain('>Play<');
  });

  it('speaks French under the fr locale', async () => {
    const html = await frontDoorIn('fr');
    expect(html).toContain('Qui ment ?');
    expect(html).toContain('Tout commence par un vrai article');
    expect(html).toContain('>Jouer<');
    // Whole screen, not a sprinkling: the English copy must be gone.
    expect(html).not.toContain('Who is lying?');
    expect(html).not.toContain('It starts with a real article');
    expect(html).not.toContain('>Play<');
  });
});
