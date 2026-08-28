/** @vitest-environment jsdom */

// Step 11.3 — the switch, driven the way a player drives it.
//
// The proxy tests hold the server half of the choice; this holds the client
// half: the switch offers every locale on the page the player is already on,
// marks the one they are in, and clicking the other one records the choice —
// the cookie the proxy reads ahead of `Accept-Language` on every request
// after, which is what "survives a reload" means from this side.
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { messagesFor } from './catalogue.js';
import type { Locale } from './locales.js';
import { LocaleSwitch } from './locale-switch.js';

// The pathname the player is on, with their locale's own prefix — what the
// app router would report for a French player reading the entry screen.
vi.mock(import('next/navigation'), async (importOriginal) => ({
  ...(await importOriginal()),
  usePathname: () => '/fr/play',
}));

async function switchIn(locale: Locale) {
  return render(
    <NextIntlClientProvider locale={locale} messages={await messagesFor(locale)}>
      <LocaleSwitch />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe('11.3 — the explicit switch', () => {
  it('offers each language under its own name', async () => {
    await switchIn('fr');
    expect(screen.getByRole('link', { name: 'English' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Français' })).toBeDefined();
  });

  it('marks the language the player is in, and only that one', async () => {
    await switchIn('fr');
    expect(screen.getByRole('link', { name: 'Français' }).getAttribute('aria-current')).toBe(
      'true',
    );
    expect(screen.getByRole('link', { name: 'English' }).getAttribute('aria-current')).toBeNull();
  });

  it('points each language at the page the player is on', async () => {
    // The whole interface at once, not a front door to start over from: the
    // link re-serves the current path under the other prefix — English on the
    // unprefixed URL, since English owns those (see `routing.ts`).
    await switchIn('fr');
    expect(screen.getByRole('link', { name: 'English' }).getAttribute('href')).toBe('/en/play');
    expect(screen.getByRole('link', { name: 'Français' }).getAttribute('href')).toBe('/fr/play');
  });

  it('records the choice where the proxy reads it', async () => {
    await switchIn('fr');
    // The click must run the component's handler but not jsdom's navigation,
    // which is not implemented; the cookie is written by the handler, before
    // this listener has its say.
    const swallow = (event: MouseEvent) => event.preventDefault();
    document.addEventListener('click', swallow);
    await userEvent.click(screen.getByRole('link', { name: 'English' }));
    document.removeEventListener('click', swallow);
    expect(document.cookie).toContain('NEXT_LOCALE=en');
  });
});
