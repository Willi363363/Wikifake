// The figures the lab is drawn with, and the period that moves them.
//
// **Sample data, and the lab says so on screen.** Real numbers need a database
// and a session, and this route has neither by design — but a layout judged on
// `0` everywhere is a layout nobody can judge.
//
// Every field below exists in a reader today — `readPlayers`, `readActivation`,
// `readGames`, `readTraffic`, `readCost`, `readContent`, `readHealth` — so
// nothing drawn here is a figure the panel would have to learn to compute.
//
// **What the period moves, and what it does not, is not a detail.** Three of
// these figures are deliberately immune to it, and each one is immune for its
// own reason, read off the readers rather than guessed:
//
//   - `activeToday` and `activeThisWeek` are `countActiveSince` over *today*
//     and *this week*, never over the range. Picking "this year" does not make
//     "active today" mean a year.
//   - `mostActive` is `selectMostActive` with no window at all: cumulative
//     totals with no date.
//   - `health` is a live probe. A probe has no history to filter.
//
// A selector that silently moved them would be lying, so `sampleFor` leaves
// them alone and every layout that shows one says why where it shows it.

export type { FunnelStep, Kind, Mode, Player, Service, Topic } from './sample-figures.js';

import {
  BASE,
  INPUT_RATE,
  kindOf,
  modeOf,
  MOST_ACTIVE,
  OUTPUT_RATE,
  series,
  TOPICS,
  WHY,
  type FunnelStep,
  type Kind,
  type Mode,
  type Player,
  type Service,
  type Topic,
} from './sample-figures.js';

export interface Period {
  readonly id: string;
  readonly label: string;
  /** How much of a month this period is, for the figures it moves. */
  readonly scale: number;
  /** The dates the header prints under the title. */
  readonly covering: string;
  /** How many columns a per-day chart gets. */
  readonly buckets: number;
}

export const PERIODS: readonly Period[] = [
  { id: '24h', label: '24 h', scale: 1 / 30, covering: '13 September 2026', buckets: 12 },
  {
    id: 'week',
    label: 'This week',
    scale: 7 / 30,
    covering: '7 → 13 September 2026',
    buckets: 7,
  },
  {
    id: 'month',
    label: 'This month',
    scale: 1,
    covering: '15 August → 13 September 2026',
    buckets: 12,
  },
  {
    id: 'year',
    label: 'This year',
    scale: 8.4,
    covering: '1 January → 13 September 2026',
    buckets: 12,
  },
  {
    id: 'all',
    label: 'All',
    scale: 11.2,
    covering: 'Everything since the first round',
    buckets: 12,
  },
  {
    id: 'custom',
    label: '1 Jun → 13 Sep',
    scale: 3.5,
    covering: '1 June → 13 September 2026, inclusive',
    buckets: 12,
  },
];

export const DEFAULT_PERIOD = PERIODS[2] as Period;

export interface Sample {
  readonly period: Period;
  readonly players: {
    readonly accounts: number;
    readonly guests: number;
    readonly everPlayed: number;
    readonly activeInRange: number;
    /** Fixed windows. The period never moves these. */
    readonly activeToday: number;
    readonly activeThisWeek: number;
    readonly newPerDay: readonly number[];
    /** Cumulative, with no date. The period never moves this either. */
    readonly mostActive: readonly Player[];
  };
  readonly activation: {
    readonly steps: readonly FunnelStep[];
    readonly activation: number;
    readonly returnRate: number;
  };
  readonly games: {
    readonly rounds: number;
    readonly solo: number;
    readonly multiplayer: number;
    readonly open: number;
    readonly abandonRate: number;
    /** One row per mode, plus the total — `countRoundsByMode` and seats. */
    readonly modes: readonly Mode[];
    readonly total: Mode;
    readonly perDay: readonly number[];
  };
  readonly traffic: {
    readonly landing: number;
    readonly entry: number;
    readonly reach: number;
    readonly days: readonly number[];
    /** The entry screen, day by day, beside `days`. */
    readonly entryDays: readonly number[];
    /** The day the counter was switched on. Nothing exists before it. */
    readonly since: string;
    /**
     * Whether the chosen period reaches back past `since`.
     *
     * It matters because those days were not counted rather than empty: two
     * periods straddling that date are not comparable, and a chart that draws
     * zero there is drawing a measurement nobody took.
     */
    readonly beforeCounting: boolean;
  };
  readonly cost: {
    readonly spend: number;
    readonly perGame: number;
    readonly perPlayer: number;
    readonly tokensPerGame: number;
    readonly calls: number;
    readonly failed: number;
    /**
     * Calls that reported no token count at all.
     *
     * `input_tokens` is nullable because the model does not always say, and
     * `sum` skips a null — so the totals are missing these rather than
     * quietly understating. The page has to say so.
     */
    readonly withoutTokens: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly byKind: readonly Kind[];
    readonly perDay: readonly number[];
    /** Euros per million tokens, and the model they are for. */
    readonly model: string;
    readonly inputRate: number;
    readonly outputRate: number;
  };
  readonly content: {
    readonly games: number;
    readonly fromCache: number;
    readonly generated: number;
    readonly cacheHitRate: number;
    readonly distinctTopics: number;
    readonly topTopic: string;
    readonly topics: readonly Topic[];
    readonly falsificationCalls: number;
    readonly falsificationFailed: number;
    readonly topicCalls: number;
    readonly topicFailed: number;
  };
  readonly health: {
    readonly services: readonly Service[];
    readonly sameCommit: boolean;
    readonly version: string;
    readonly commit: string;
    readonly model: string;
    readonly llmConfigured: boolean;
  };
}

/** Every figure the chosen period implies. The one thing the lab computes. */
export function sampleFor(period: Period): Sample {
  const at = (value: number) => Math.max(1, Math.round(value * period.scale));
  const created = at(BASE.activation.created);
  const started = at(BASE.activation.started);
  const finished = at(BASE.activation.finished);
  const returned = at(BASE.activation.returned);
  const counts = [created, started, finished, returned];
  const names = ['Created', 'Started', 'Finished', 'Returned'];

  const rounds = at(BASE.games.rounds);
  const landing = at(BASE.traffic.landing);
  const entry = at(BASE.traffic.entry);
  const spend = Number((BASE.cost.spend * period.scale).toFixed(2));
  const generated = at(BASE.content.generated);
  const activeInRange = at(BASE.players.activeInRange);
  const falsification = kindOf(
    'Falsification',
    at(1024),
    at(7),
    at(6_124_000),
    at(1_466_000),
  );
  const topicChoice = kindOf('Topic choice', at(618), at(12), at(247_000), at(31_000));
  const landingDays = series(period.buckets, Math.max(4, Math.round(landing / 12)));
  const solo = modeOf(
    'Solo',
    at(BASE.games.solo),
    8,
    at(BASE.games.soloSeats),
    at(BASE.games.soloSubmitted),
  );
  const rooms = modeOf(
    'Rooms',
    at(BASE.games.multiplayer),
    4,
    at(BASE.games.roomSeats),
    at(BASE.games.roomSubmitted),
  );
  const total = modeOf(
    'All',
    solo.rounds + rooms.rounds,
    solo.open + rooms.open,
    solo.seats + rooms.seats,
    solo.submitted + rooms.submitted,
  );

  return {
    period,
    players: {
      accounts: at(BASE.players.accounts),
      guests: at(BASE.players.guests),
      everPlayed: at(BASE.players.everPlayed),
      activeInRange,
      activeToday: 73,
      activeThisWeek: 312,
      newPerDay: series(period.buckets, Math.max(2, Math.round(created / 8))),
      mostActive: MOST_ACTIVE,
    },
    activation: {
      steps: counts.map((count, step) => ({
        name: names[step] as string,
        count,
        ofPrevious: step === 0 ? null : count / (counts[step - 1] as number),
        ofCreated: step === 0 ? null : count / created,
        why: WHY[step]?.why ?? '',
        lost: WHY[step]?.lost ?? '',
      })),
      activation: finished / created,
      returnRate: returned / finished,
    },
    games: {
      rounds,
      solo: at(BASE.games.solo),
      multiplayer: at(BASE.games.multiplayer),
      open: BASE.games.open,
      abandonRate: total.abandonRate,
      modes: [solo, rooms],
      total,
      perDay: series(period.buckets, Math.max(3, Math.round(rounds / 12))),
    },
    traffic: {
      landing,
      entry,
      reach: entry / landing,
      days: landingDays,
      entryDays: landingDays.map((day) => Math.max(1, Math.round(day * 0.41))),
      since: '4 August 2026',
      beforeCounting: period.scale > 2,
    },
    cost: {
      spend,
      perGame: spend / generated,
      perPlayer: spend / Math.max(1, activeInRange),
      tokensPerGame: BASE.cost.tokensPerGame,
      calls: falsification.calls + topicChoice.calls,
      failed: falsification.failed + topicChoice.failed,
      withoutTokens: at(3),
      inputTokens: falsification.inputTokens + topicChoice.inputTokens,
      outputTokens: falsification.outputTokens + topicChoice.outputTokens,
      byKind: [falsification, topicChoice],
      perDay: series(period.buckets, Math.max(2, Math.round((spend * 100) / 12))),
      model: 'gemini-3.1-flash-lite',
      inputRate: INPUT_RATE,
      outputRate: OUTPUT_RATE,
    },
    content: {
      games: rounds,
      fromCache: rounds - generated,
      generated,
      cacheHitRate: (rounds - generated) / rounds,
      distinctTopics: at(BASE.content.distinctTopics),
      topTopic: TOPICS[0]?.topic ?? 'Chat',
      topics: TOPICS.map((topic) => ({
        topic: topic.topic,
        games: at(topic.games),
        fromCache: at(topic.fromCache),
      })),
      falsificationCalls: falsification.calls,
      falsificationFailed: falsification.failed,
      topicCalls: topicChoice.calls,
      topicFailed: topicChoice.failed,
    },
    health: {
      services: [
        { name: 'Web', up: true, ms: 0 },
        { name: 'Realtime', up: true, ms: 84 },
        { name: 'Database', up: true, ms: 12 },
      ],
      sameCommit: true,
      version: '0.1.0',
      commit: '82dfc0d',
      model: 'gemini-3.1-flash-lite',
      llmConfigured: true,
    },
  };
}

/** A percentage, the way every admin screen already writes one. */
export function percent(share: number): string {
  return `${String(Math.round(share * 100))} %`;
}

/** A count with the thin spaces the interface uses for thousands. */
export function count(value: number): string {
  return value.toLocaleString('en-GB').replace(/,/g, ' ');
}

/** Euros, to the number of places the figure actually carries. */
export function euros(value: number, places = 2): string {
  return `€ ${value.toFixed(places)}`;
}
