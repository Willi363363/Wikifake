/** @vitest-environment jsdom */

// What the model has cost — step K.9, on the screen.
//
// Amended when the section became the digest. The ordinary state of this page
// is still **tokens plus an explanation**, because no rate is configured by
// default, and that has to read as a deliberate answer rather than as a broken
// figure — which is what most of these cases check.
//
// K.9 adds two claims of its own. Each row carries what it cost, computed by
// `spendOf` in the reader rather than multiplied again on the screen; and the
// **rate is printed where the money is**, because a number whose rate is not
// beside it is a number nobody can check.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CostSection } from './cost-screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { CostView } from './cost.js';

afterEach(() => {
  cleanup();
});

function view(over: Partial<CostView> = {}): CostView {
  return {
    days: [
      {
        day: '2026-09-10',
        calls: 12,
        failed: 1,
        inputTokens: 12_000,
        outputTokens: 8_000,
        spend: null,
      },
      {
        day: '2026-09-11',
        calls: 30,
        failed: 0,
        inputTokens: 30_000,
        outputTokens: 20_000,
        spend: null,
      },
    ],
    byKind: [
      {
        kind: 'topic_choice',
        calls: 20,
        failed: 0,
        inputTokens: 2_000,
        outputTokens: 400,
        spend: null,
      },
      {
        kind: 'falsification',
        calls: 22,
        failed: 1,
        inputTokens: 40_000,
        outputTokens: 27_600,
        spend: null,
      },
    ],
    totals: {
      calls: 42,
      failed: 1,
      inputTokens: 42_000,
      outputTokens: 28_000,
      withoutTokens: 0,
      gamesGenerated: 20,
      players: 35,
    },
    rate: null,
    spend: null,
    perGame: null,
    perPlayer: null,
    tokensPerGame: 3_500,
    ...over,
  };
}

describe('K.9 — with no rate configured', () => {
  it('says why there is no money on the page', () => {
    render(<CostSection cost={view()} />);

    expect(screen.getByText(/No token rate is configured/)).not.toBeNull();
    expect(screen.getByText(/would go stale without saying so/)).not.toBeNull();
  });

  it('shows an em dash for every money figure, and tokens anyway', () => {
    render(<CostSection cost={view()} />);

    // Five now: the three unit figures, plus the cost column on each of the
    // two rows — the rows are priced through the same function as the total,
    // so they go absent together rather than one of them inventing a zero.
    expect(screen.getAllByText('—')).toHaveLength(5);
    // Tokens per game needs no rate, so it is there regardless.
    expect(screen.getByText('3.5K')).not.toBeNull();
  });

  it('charts tokens rather than money, and names the curve for what it is', () => {
    render(<CostSection cost={view()} />);

    expect(screen.getByText('Tokens per day')).not.toBeNull();
    expect(screen.queryByText('Spend per day')).toBeNull();
    expect(
      screen.getByText(/Money is a multiplication a deployment opts into/),
    ).not.toBeNull();
  });
});

describe('K.9 — with a rate configured', () => {
  const priced = view({
    rate: { inputPerMTok: 0.215, outputPerMTok: 1.29 },
    spend: 12.5,
    perGame: 0.625,
    perPlayer: 0.357,
    tokensPerGame: 3_500,
  });

  it('shows the money, and says it is priced', () => {
    render(<CostSection cost={priced} />);

    expect(screen.getByText('12.5')).not.toBeNull();
    expect(screen.getByText('0.625')).not.toBeNull();
    expect(screen.getByText(/Priced with the configured rate/)).not.toBeNull();
  });

  it('says what each figure is divided by', () => {
    render(<CostSection cost={priced} />);

    expect(screen.getByText('42 calls')).not.toBeNull();
    expect(
      screen.getByText(/20 rounds generated is what the per-round figure/),
    ).not.toBeNull();
  });

  it('prints the rate the figures were priced at, beside the money', () => {
    // A number whose rate is not on the screen with it is a number nobody can
    // check — and this one changes whenever a provider's price list does.
    render(<CostSection cost={priced} />);

    expect(
      screen.getByText(
        '0.215 in / 1.29 out per million tokens, from the two environment variables.',
      ),
    ).not.toBeNull();
    expect(screen.getByText('Spend per day')).not.toBeNull();
  });
});

describe('K.9 — the two things that would understate the spend', () => {
  it('says how many calls failed and still cost tokens', () => {
    render(<CostSection cost={view()} />);

    expect(screen.getByText('1 call failed and still cost tokens')).not.toBeNull();
  });

  it('says nothing about failures when there are none', () => {
    render(<CostSection cost={view({ totals: { ...view().totals, failed: 0 } })} />);

    expect(screen.queryByText(/failed and still cost/)).toBeNull();
  });

  it('warns when calls reported no token count at all', () => {
    // `sum` skips a null, so the totals would fall while the spend rose.
    render(
      <CostSection cost={view({ totals: { ...view().totals, withoutTokens: 4 } })} />,
    );

    expect(screen.getByRole('note').textContent).toContain(
      '4 calls reported no token count',
    );
  });
});

describe('K.9 — the curve and the table', () => {
  it('lists the kinds in the order a round calls them', () => {
    render(<CostSection cost={view()} />);

    const rows = screen.getAllByRole('row').map((row) => row.textContent);
    expect(rows[1]).toContain('topic_choice');
    expect(rows[2]).toContain('falsification');
  });

  it('draws a column per day, each readable as a figure and not only a height', () => {
    // I.6 listed the days as rows. The digest draws them, so each column
    // carries the day and the number it stands for rather than a length alone.
    render(<CostSection cost={view()} />);

    expect(
      screen.getAllByTitle(/2026-09/).map((bar) => bar.getAttribute('title')),
    ).toEqual(['2026-09-10 · 20000', '2026-09-11 · 50000']);
  });

  it('says so when there is nothing at all', () => {
    render(<CostSection cost={view({ days: [], byKind: [] })} />);

    expect(screen.getAllByText('No model calls recorded yet.')).toHaveLength(2);
  });

  it('says the same things in French', () => {
    renderIn('fr', <CostSection cost={view()} />);

    expect(screen.getAllByText('Coût').length).toBeGreaterThan(0);
    expect(screen.getByText(/Aucun tarif par jeton/)).not.toBeNull();
    expect(screen.getByText('Jetons par jour')).not.toBeNull();
  });
});
