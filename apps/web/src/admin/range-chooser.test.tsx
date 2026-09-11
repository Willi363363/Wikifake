/** @vitest-environment jsdom */

// The range control — step I.8.
//
// Links, not buttons: each preset is a different panel at a different address.
// And the sentence under them, which is the honest half of this step — it says
// **which sections the range moves**, because two of them cannot honour it.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RangeChooser } from './range-chooser.js';
import { rangeFrom } from './range.js';
import { render, renderIn } from '../i18n/testing.js';

afterEach(() => {
  cleanup();
});

const THURSDAY = Date.UTC(2026, 8, 10, 15, 0, 0);

describe('I.8 — the chooser', () => {
  it('offers every preset as a link, not a button', () => {
    // A range is bookmarkable, shareable, and survives the reload somebody
    // does when a figure surprises them.
    render(<RangeChooser range={rangeFrom('30d', THURSDAY)} />);

    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: '7 days' }).getAttribute('href')).toBe(
      '/admin?range=7d',
    );
  });

  it('announces the chosen one rather than only colouring it', () => {
    render(<RangeChooser range={rangeFrom('90d', THURSDAY)} />);

    const current = screen.getByRole('link', { current: 'page' });
    expect(current.textContent).toBe('90 days');
  });

  it('highlights the default when the query string is nonsense', () => {
    // The chooser must highlight what is *actually* being shown.
    render(<RangeChooser range={rangeFrom('yesterday', THURSDAY)} />);

    expect(screen.getByRole('link', { current: 'page' }).textContent).toBe('30 days');
  });

  it('says the dates it covers, inclusive of the last day', () => {
    render(<RangeChooser range={rangeFrom('7d', THURSDAY)} />);

    // 4 September to 10 September: the range ends at midnight after the 10th,
    // and the sentence names the last day that is in it rather than that
    // boundary.
    expect(screen.getByText(/Sep 4, 2026 to Sep 10, 2026, inclusive/)).not.toBeNull();
  });

  it('says everything rather than a pair of dates for all time', () => {
    render(<RangeChooser range={rangeFrom('all', THURSDAY)} />);

    expect(screen.getByText('Everything since the first round.')).not.toBeNull();
  });

  it('says which sections it moves, and which it cannot', () => {
    // The honest half. A control that silently left health and the most-active
    // list alone would be a control that lied about two thirds of a screen.
    render(<RangeChooser range={rangeFrom('7d', THURSDAY)} />);

    const said = screen.getByText(/It moves the players/).textContent ?? '';
    expect(said).toContain('Health is a live probe');
    expect(said).toContain('running totals with no date on them');
  });

  it('says the same things in French', () => {
    renderIn('fr', <RangeChooser range={rangeFrom('all', THURSDAY)} />);

    expect(screen.getByText('Tout depuis la première manche.')).not.toBeNull();
    expect(screen.getByRole('link', { current: 'page' }).textContent).toBe('Tout');
  });
});
