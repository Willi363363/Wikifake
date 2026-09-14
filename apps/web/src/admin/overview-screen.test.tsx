/** @vitest-environment jsdom */

// Overview — step K.3, on the screen.
//
// The digest's job is to be four figures and two shapes, and the cases below
// are about the three ways a summary lies: it invents a number no section
// draws, it prints 0 % where there is no whole, and it shows money the panel
// was never given a rate for.
//
// Whether the figures themselves are right is each section's own suite against
// a real database.
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { OverviewSection } from './overview-screen.js';
import { render, renderIn } from '../i18n/testing.js';
import type { ActivationView } from './activation.js';
import type { CostView } from './cost.js';
import type { GamesView } from './games.js';
import type { HealthView } from './health.js';
import type { PlayersView } from './players.js';
import type { TrafficView } from './traffic.js';

afterEach(() => {
  cleanup();
});

const PLAYERS: PlayersView = {
  accounts: 1284,
  guests: 412,
  everPlayed: 948,
  activeToday: 73,
  activeThisWeek: 312,
  activeInRange: 596,
  mostActive: [],
};

const ACTIVATION: ActivationView = {
  activation: 0.5,
  returnRate: 0.25,
  funnel: [
    { name: 'created', count: 120, ofPrevious: null, ofCreated: null },
    { name: 'started', count: 90, ofPrevious: 0.75, ofCreated: 0.75 },
    { name: 'finished', count: 60, ofPrevious: 2 / 3, ofCreated: 0.5 },
    { name: 'returned', count: 15, ofPrevious: 0.25, ofCreated: 0.125 },
  ],
};

const seatless = { seats: 0, submitted: 0, abandoned: 0, abandonRate: null };
const GAMES: GamesView = {
  rows: [
    { mode: 'solo', rounds: 600, ended: 600, open: 0, ...seatless },
    { mode: 'multiplayer', rounds: 400, ended: 400, open: 0, ...seatless },
  ],
  total: { mode: 'all', rounds: 1000, ended: 1000, open: 0, ...seatless },
};

const TRAFFIC: TrafficView = {
  landing: 1902,
  entry: 781,
  reach: 0.41,
  // Most recent first, which is how `readTraffic` answers and how a table is
  // read; the chart reverses it, and one of the cases below is that reversal.
  days: [
    { day: '2026-09-10', landing: 300, entry: 120 },
    { day: '2026-09-09', landing: 200, entry: 80 },
  ],
  since: '2026-08-04',
};

const TOTALS = {
  calls: 1024,
  failed: 7,
  inputTokens: 6_124_000,
  outputTokens: 1_466_000,
  withoutTokens: 0,
  gamesGenerated: 512,
  players: 300,
};

function cost(over: Partial<CostView> = {}): CostView {
  return {
    days: [],
    byKind: [],
    totals: TOTALS,
    rate: { inputPerMTok: 0.215, outputPerMTok: 1.29 },
    spend: 4.17,
    perGame: 0.0081,
    perPlayer: 0.0139,
    tokensPerGame: 14_824,
    ...over,
  };
}

const HEALTH: HealthView = {
  readings: [
    { name: 'web', up: true, ms: 0, detail: '1.2.3', commit: 'a'.repeat(40) },
    { name: 'realtime', up: true, ms: 42, detail: '1.2.3', commit: 'a'.repeat(40) },
    { name: 'database', up: true, ms: 3, detail: 'answering' },
  ],
  sameCommit: true,
  identity: {
    status: 'ok',
    version: '1.2.3',
    commit: 'a'.repeat(40),
    commitShort: 'aaaaaaa',
    model: 'a-model',
    llmConfigured: true,
  },
};

function paint(over: { cost?: CostView; games?: GamesView; traffic?: TrafficView } = {}) {
  return render(
    <OverviewSection
      players={PLAYERS}
      activation={ACTIVATION}
      games={over.games ?? GAMES}
      traffic={over.traffic ?? TRAFFIC}
      cost={over.cost ?? cost()}
      health={HEALTH}
    />,
  );
}

describe('K.3 — the four figures', () => {
  it('leads with accounts, today, rounds and what the model cost', () => {
    paint();

    expect(screen.getByText('1,284')).not.toBeNull();
    expect(screen.getByText('73')).not.toBeNull();
    expect(screen.getByText('1,000')).not.toBeNull();
    expect(screen.getByText('4.17')).not.toBeNull();
  });

  it('says the two figures no period moves are not ranged', () => {
    // `activeToday` and `activeThisWeek` are fixed windows whatever the bar
    // says, and the tile carries the week beside the day so the pair reads as
    // two windows rather than one ranged number.
    paint();

    expect(screen.getByText('312 this week')).not.toBeNull();
    // Guests beside accounts, because a guest is a `user` row too and a panel
    // that added them together would report sign-ups that are not.
    expect(screen.getByText('412 guests besides')).not.toBeNull();
  });

  it('names the solo share beside the rounds, not below them', () => {
    paint();

    expect(screen.getByText('60% solo')).not.toBeNull();
  });
});

describe('K.3 — a summary that does not invent', () => {
  it('shows tokens, not money, when no rate is configured', () => {
    // The ordinary state of a deployment: `spendOf` answers null unless both
    // halves of the rate are set, and a digest that showed a zero there would
    // read as an unusually cheap month rather than a variable nobody set.
    paint({ cost: cost({ rate: null, spend: null, perGame: null, perPlayer: null }) });

    expect(screen.queryByText('4.17')).toBeNull();
    // Tokens per game, compact — the one cost figure that needs no rate, so it
    // is what the tile falls back to rather than a blank or a zero.
    expect(screen.getByText(/^15K$/)).not.toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows an em dash rather than 0% when there is nothing to divide', () => {
    paint({
      games: {
        rows: [],
        total: { mode: 'all', rounds: 0, ended: 0, open: 0, ...seatless },
      },
      traffic: { landing: 0, entry: 0, reach: null, days: [], since: null },
    });

    expect(screen.queryByText('0% solo')).toBeNull();
    expect(screen.getByText('— solo')).not.toBeNull();
  });

  it('says nothing was counted rather than drawing an empty chart', () => {
    paint({ traffic: { landing: 0, entry: 0, reach: null, days: [], since: null } });

    expect(screen.getByText('Nothing was counted in this range.')).not.toBeNull();
  });
});

describe('K.3 — the two shapes', () => {
  it('draws the funnel in order, each step named', () => {
    paint();

    const steps = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');
    expect(steps).toHaveLength(4);
    expect(steps[0]).toContain('Accounts created');
    expect(steps[3]).toContain('Came back another day');
  });

  it('reads the arrivals chart left to right, oldest first', () => {
    // `readTraffic` answers most recent first, because a table is read from
    // today backwards and a chart is not. One reversal, in the screen.
    paint();

    const bars = screen
      .getAllByTitle(/2026-09/)
      .map((bar) => bar.getAttribute('title') ?? '');
    expect(bars).toEqual(['2026-09-09 · 200', '2026-09-10 · 300']);
  });

  it('puts health on one line, with a swatch rather than a coloured word', () => {
    paint();

    expect(screen.getByText('Both services are running the same commit.')).not.toBeNull();
    expect(screen.getByText('42 ms')).not.toBeNull();
  });
});

describe('K.3 — in French', () => {
  it('says the same things', () => {
    renderIn(
      'fr',
      <OverviewSection
        players={PLAYERS}
        activation={ACTIVATION}
        games={GAMES}
        traffic={TRAFFIC}
        cost={cost()}
        health={HEALTH}
      />,
    );

    expect(screen.getByText('60 % en solo')).not.toBeNull();
    expect(screen.getByText(/50 % des nouveaux comptes/)).not.toBeNull();
  });
});
