/** @vitest-environment jsdom */

// The period bar — step K.2.
//
// It replaces `range-chooser.test.tsx`, and the claims are the same ones with
// one addition: the presets are links rather than buttons, the chosen one is
// announced rather than only coloured, the bar names the days it covers and
// says which sections it does not move — **and the custom period is a real
// form now**, which is the thing I.8 never had and the lab only mocked.
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as Navigation from '../i18n/navigation.js';
import type * as NextNavigation from 'next/navigation';

/*
 * The address the bar is at — the path it links back to, and the period it
 * reads. K.1 split the panel into eight routes, and a hardcoded `/admin` would
 * send anybody changing the period on a section back to the way in.
 */
let at = '/admin';
let query = '';

vi.mock('../i18n/navigation.js', async () => {
  const real = await vi.importActual<typeof Navigation>('../i18n/navigation.js');
  return { ...real, usePathname: () => at };
});

// The bar reads the query string, and the dialog's form action is the path as
// the browser actually has it — `next-intl`'s `usePathname` strips the locale.
vi.mock('next/navigation', async (importOriginal) => ({
  // Spread rather than replaced: `next-intl`'s navigation is built on this
  // module, so a mock that answered only these two would break the `Link` the
  // presets are.
  ...(await importOriginal<typeof NextNavigation>()),
  usePathname: () => at,
  useSearchParams: () => new URLSearchParams(query),
}));

import { PeriodBar } from './period-bar.js';
import { render, renderIn } from '../i18n/testing.js';

afterEach(() => {
  cleanup();
  at = '/admin';
  query = '';
});

/** A Thursday, mid-afternoon UTC. 7 September 2026 was the Monday before it. */
const THURSDAY = Date.UTC(2026, 8, 10, 15, 0, 0);

describe('K.2 — the presets', () => {
  it('offers every preset as a link, not a button', () => {
    // A period is bookmarkable, shareable, and survives the reload somebody
    // does when a figure surprises them — so a link, and a browser running no
    // JavaScript at all gets every one of them.
    render(<PeriodBar nowMs={THURSDAY} />);

    expect(screen.getAllByRole('link')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'This week' }).getAttribute('href')).toBe(
      '/admin?range=week',
    );
  });

  it('comes back to the page the period was chosen on', () => {
    at = '/admin/cost';

    render(<PeriodBar nowMs={THURSDAY} />);

    for (const [name, preset] of [
      ['24 h', '24h'],
      ['This year', 'year'],
      ['All', 'all'],
    ] as const) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(
        `/admin/cost?range=${preset}`,
      );
    }
  });

  it('announces the chosen one rather than only colouring it', () => {
    query = 'range=year';

    render(<PeriodBar nowMs={THURSDAY} />);

    expect(screen.getByRole('link', { current: 'page' }).textContent).toBe('This year');
  });

  it('highlights the default when the query string is nonsense', () => {
    // I.8's presets are exactly that now: a bookmark saying `30d` is a link
    // from before K.2, and it shows a month and says so.
    query = 'range=30d';

    render(<PeriodBar nowMs={THURSDAY} />);

    expect(screen.getByRole('link', { current: 'page' }).textContent).toBe('This month');
  });

  it('says the days it covers, inclusive of the last one', () => {
    query = 'range=week';

    render(<PeriodBar nowMs={THURSDAY} />);

    // Monday the 7th to Thursday the 10th: the period ends at midnight after
    // the 10th, and the sentence names the last day that is *in* it.
    expect(screen.getByText(/Sep 7, 2026 to Sep 10, 2026, inclusive/)).not.toBeNull();
  });

  it('says everything rather than a pair of dates for all time', () => {
    query = 'range=all';

    render(<PeriodBar nowMs={THURSDAY} />);

    expect(screen.getByText(/Everything since the first round/)).not.toBeNull();
  });

  it('says which figures it moves, and which it cannot', () => {
    // The honest half. A control that silently left health, the most-active
    // list and "today" alone would be a control that lied about a third of
    // every screen.
    render(<PeriodBar nowMs={THURSDAY} />);

    const said = screen.getByText(/The period moves/).textContent ?? '';
    expect(said).toContain('Health is a live probe');
    expect(said).toContain('running totals with no date on them');
    expect(said).toContain('today');
  });

  it('says the same things in French', () => {
    query = 'range=all';

    renderIn('fr', <PeriodBar nowMs={THURSDAY} />);

    expect(screen.getByRole('link', { current: 'page' }).textContent).toBe('Tout');
    expect(screen.getByText(/Tout depuis la première manche/)).not.toBeNull();
  });
});

describe('K.2 — the custom period', () => {
  it('is a button, because two dates are not a link the bar can carry', () => {
    render(<PeriodBar nowMs={THURSDAY} />);

    expect(screen.getByRole('button', { name: /Custom/ })).not.toBeNull();
  });

  it('names the two days when the address carries them', () => {
    query = 'range=custom&from=2026-08-01&to=2026-08-31';

    render(<PeriodBar nowMs={THURSDAY} />);

    expect(
      screen.getByRole('button', { name: '2026-08-01 → 2026-08-31' }),
    ).not.toBeNull();
    expect(screen.getByText(/Aug 1, 2026 to Aug 31, 2026, inclusive/)).not.toBeNull();
    // A custom period is not one of the presets, so none of them is current.
    expect(screen.queryByRole('link', { current: 'page' })).toBeNull();
  });

  it('asks for the two dates with a GET form, so the browser navigates', async () => {
    // Not a router call and not a server action: a period is a query string,
    // and a form is how HTML has always written one.
    at = '/admin/cost';
    await userEvent.click(
      render(<PeriodBar nowMs={THURSDAY} />).getByRole('button', { name: /Custom/ }),
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('method')).toBe('get');
    expect(dialog.getAttribute('action')).toBe('/admin/cost');
    expect(dialog.querySelector('input[name="range"]')?.getAttribute('value')).toBe(
      'custom',
    );
    expect(screen.getByLabelText('From').getAttribute('type')).toBe('date');
    expect(screen.getByLabelText('To').getAttribute('type')).toBe('date');
  });

  it('refuses to apply a pair that runs backwards, and says why', async () => {
    query = 'range=custom&from=2026-08-01&to=2026-08-31';
    const user = userEvent.setup();
    render(<PeriodBar nowMs={THURSDAY} />);

    await user.click(screen.getByRole('button', { name: /2026-08-01/ }));
    const from = screen.getByLabelText('From');
    await user.clear(from);
    await user.type(from, '2026-09-30');

    expect(screen.getByText('The first date is after the second.')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('counts both ends of the pair it is about to ask for', async () => {
    query = 'range=custom&from=2026-08-01&to=2026-08-31';

    await userEvent.click(
      render(<PeriodBar nowMs={THURSDAY} />).getByRole('button', { name: /2026-08-01/ }),
    );

    expect(screen.getByText('31 days selected')).not.toBeNull();
  });

  it('cannot be asked for a day that has not happened', async () => {
    await userEvent.click(
      render(<PeriodBar nowMs={THURSDAY} />).getByRole('button', { name: /Custom/ }),
    );

    for (const field of ['From', 'To']) {
      expect(screen.getByLabelText(field).getAttribute('max')).toBe('2026-09-10');
    }
  });
});
