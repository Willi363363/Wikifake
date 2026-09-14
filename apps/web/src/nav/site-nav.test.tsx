/** @vitest-environment jsdom */

// The bar, and the entry only one account gets — steps L.4 and L.5.
//
// Two claims carry these cases, and the second is the one with teeth.
//
// **Every destination is one click away.** That is the whole point of the step:
// before it the shop took three, through an underlined word in a paragraph.
//
// **A non-admin receives no element, not a hidden one.** I.1 decided nothing
// announces the panel to somebody who cannot open it, and `hidden` announces it
// to anybody who reads the source — so this asserts absence from the markup,
// not invisibility in it.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as Navigation from '../i18n/navigation.js';

let at = '/play';
vi.mock('../i18n/navigation.js', async () => {
  const real = await vi.importActual<typeof Navigation>('../i18n/navigation.js');
  return { ...real, usePathname: () => at };
});

import { DESTINATIONS } from './destinations.js';
import { SiteNav } from './site-nav.js';
import { render, renderIn } from '../i18n/testing.js';

afterEach(() => {
  cleanup();
  at = '/play';
});

/** Every route the bar offers, counted once however many times it is drawn. */
function routes(): string[] {
  return [
    ...new Set(
      screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('href') ?? '')
        .filter((href) => href !== ''),
    ),
  ];
}

describe('L.4 — every destination, one click away', () => {
  it('offers each one as a link', () => {
    render(<SiteNav isAdmin={false} />);

    for (const route of ['/play', '/quests', '/shop', '/leaderboard', '/profile']) {
      expect(routes()).toContain(route);
    }
  });

  it('links the brand home, so the bar is also the way back', () => {
    render(<SiteNav isAdmin={false} />);

    expect(routes()).toContain('/');
  });

  it('announces the page rather than only colouring it', () => {
    at = '/shop';
    render(<SiteNav isAdmin={false} />);

    // Twice: the bar and the phone menu are both in the markup, and the CSS
    // decides which is shown. Both must agree about where the reader is.
    for (const link of screen.getAllByRole('link', { current: 'page' })) {
      expect(link.getAttribute('href')).toBe('/shop');
    }
    expect(screen.getAllByRole('link', { current: 'page' }).length).toBeGreaterThan(0);
  });

  it('opens its narrow menu with a checkbox, not with state', () => {
    // A layout that needs JavaScript is unreadable exactly when JavaScript is
    // what broke — and that is when somebody most needs to leave the page.
    const { container } = render(<SiteNav isAdmin={false} />);

    expect(container.querySelector('input#site-menu[type="checkbox"]')).not.toBeNull();
    expect(container.querySelector('.peer-checked\\:flex')).not.toBeNull();
  });

  it('names the pages in French too', () => {
    renderIn('fr', <SiteNav isAdmin={false} />);

    expect(screen.getAllByText('Boutique').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quêtes').length).toBeGreaterThan(0);
  });
});

describe('L.5 — the entry only an admin is handed', () => {
  it('gives an admin the way in', () => {
    render(<SiteNav isAdmin />);

    expect(routes()).toContain('/admin');
  });

  it('gives everybody else no element at all', () => {
    // Not `hidden`, not `display: none` — absent. A hidden entry announces the
    // panel to anybody who opens the source, which is the whole thing I.1
    // refused to do.
    const { container } = render(<SiteNav isAdmin={false} />);

    expect(routes()).not.toContain('/admin');
    expect(container.innerHTML).not.toContain('/admin');
  });

  it('marks exactly one destination as the admin one', () => {
    // A second `adminOnly` added without thought would be a second thing the
    // bar reveals, and this is what makes that a failing test rather than a
    // quiet change.
    expect(DESTINATIONS.filter((one) => one.adminOnly === true)).toHaveLength(1);
  });
});
