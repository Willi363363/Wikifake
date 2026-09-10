/** @vitest-environment jsdom */

// What the model has cost — step I.6, on the screen.
//
// The ordinary state of this section is **tokens plus an explanation**, because
// no rate is configured by default. That has to read as a deliberate answer
// rather than as a broken figure, and it is what most of these cases check.
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
      },
      {
        day: '2026-09-11',
        calls: 30,
        failed: 0,
        inputTokens: 30_000,
        outputTokens: 20_000,
      },
    ],
    byKind: [
      {
        kind: 'topic_choice',
        calls: 20,
        failed: 0,
        inputTokens: 2_000,
        outputTokens: 400,
      },
      {
        kind: 'falsification',
        calls: 22,
        failed: 1,
        inputTokens: 40_000,
        outputTokens: 27_600,
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
    spend: null,
    perGame: null,
    perPlayer: null,
    tokensPerGame: 3_500,
    ...over,
  };
}

describe('I.6 — with no rate configured', () => {
  it('says why there is no money on the page', () => {
    render(<CostSection cost={view()} />);

    expect(screen.getByText(/No token rate is configured/)).not.toBeNull();
    expect(screen.getByText(/would go stale without saying so/)).not.toBeNull();
  });

  it('shows an em dash for every money figure, and tokens anyway', () => {
    render(<CostSection cost={view()} />);

    expect(screen.getAllByText('—')).toHaveLength(3);
    // Tokens per game needs no rate, so it is there regardless.
    expect(screen.getByText('3.5K')).not.toBeNull();
  });
});

describe('I.6 — with a rate configured', () => {
  const priced = view({
    spend: 12.5,
    perGame: 0.625,
    perPlayer: 0.357,
    tokensPerGame: 3_500,
  });

  it('shows the money, and says it is priced', () => {
    render(<CostSection cost={priced} />);

    expect(screen.getByText('12.5')).not.toBeNull();
    expect(screen.getByText('0.63')).not.toBeNull();
    expect(screen.getByText(/Priced with the configured rate/)).not.toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('says what each figure is divided by', () => {
    render(<CostSection cost={priced} />);

    expect(screen.getByText('42 calls')).not.toBeNull();
    expect(screen.getByText('20 generated')).not.toBeNull();
  });
});

describe('I.6 — the two things that would understate the spend', () => {
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

describe('I.6 — the tables', () => {
  it('lists the kinds in the order a round calls them', () => {
    render(<CostSection cost={view()} />);

    const rows = screen.getAllByRole('row').map((row) => row.textContent);
    expect(rows[1]).toContain('topic_choice');
    expect(rows[2]).toContain('falsification');
  });

  it('lists a day per day', () => {
    render(<CostSection cost={view()} />);

    expect(screen.getByText('2026-09-10')).not.toBeNull();
    expect(screen.getByText('2026-09-11')).not.toBeNull();
  });

  it('says so when there is nothing at all', () => {
    render(<CostSection cost={view({ days: [], byKind: [] })} />);

    expect(screen.getAllByText('No model calls recorded yet.')).toHaveLength(2);
  });

  it('says the same things in French', () => {
    renderIn('fr', <CostSection cost={view()} />);

    expect(screen.getByText('Coût')).not.toBeNull();
    expect(screen.getByText(/Aucun tarif par jeton/)).not.toBeNull();
  });
});
