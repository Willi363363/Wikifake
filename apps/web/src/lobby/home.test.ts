// Which quest the home's one quest tile shows — step L.6.
//
// The rest of `readHome` is composition: four reads that each have their own
// suite, and asserting them again here would be asserting the same rows twice.
// This is the one decision the reader makes on its own, and it is a decision a
// player notices — a tile offering a quest they finished this morning while an
// unfinished one sits behind it is a tile that wastes the space it takes.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dailyWorthShowing, readHome } from './home.js';
import type { LiveQuest } from '../quests/sets.js';

/*
 * Step R.3 — the reads, held open so the test can see which ones started.
 *
 * Every dependency records its name and then waits on one gate. `readHome` is
 * called and *not* awaited: what is asserted is which reads are in flight
 * before any of them has answered, which is the whole of the finding — the
 * board fed none of the others and none of them fed the board, and it was
 * awaited on its own line anyway.
 */
const probe = vi.hoisted(() => {
  const started: string[] = [];
  let open: () => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  let gate = new Promise<void>((resolve, reject) => {
    open = resolve;
    fail = reject;
  });
  // Nothing awaits `gate` itself — only the promises derived from it — so a
  // rejection here would be unhandled before the first mock is called.
  gate.catch(() => undefined);

  return {
    started,
    /** Records the call, then answers only once the gate is opened. */
    read: <T>(name: string, value: T): Promise<T> => {
      started.push(name);
      return gate.then(() => value);
    },
    openGate: (): void => {
      open();
    },
    failGate: (): void => {
      fail(new Error('the board is down'));
    },
    reset: (): void => {
      started.length = 0;
      gate = new Promise<void>((resolve, reject) => {
        open = resolve;
        fail = reject;
      });
      gate.catch(() => undefined);
    },
  };
});

vi.mock('../leaderboard/board.js', () => ({
  readBoard: () => probe.read('board', { rows: [], viewer: null }),
}));
vi.mock('../daily/tile.js', () => ({
  readDailyTile: () => probe.read('tile', { day: 0 }),
}));
vi.mock('../quests/sets.js', () => ({
  readLiveQuests: () => probe.read('quests', []),
}));
vi.mock('@wikifake/db', () => ({
  selectPlayerStats: () => probe.read('stats', null),
  selectGameHistory: () => probe.read('history', []),
}));

function quest(over: Partial<LiveQuest> = {}): LiveQuest {
  return {
    questId: 'q',
    ruleId: 'DAILY_FINISH_ROUNDS',
    period: 'daily',
    periodIndex: 0,
    target: 3,
    progress: 0,
    complete: false,
    reward: 20,
    claimedAt: null,
    ...over,
  };
}

describe('L.6 — the daily quest the home shows', () => {
  it('has none to show when the lot is empty', () => {
    expect(dailyWorthShowing([])).toBeNull();
  });

  it('ignores the weekly lot, which has a tile of its own on /quests', () => {
    expect(dailyWorthShowing([quest({ period: 'weekly', questId: 'w' })])).toBeNull();
  });

  it('prefers a reward waiting to be taken over one still to be earned', () => {
    const ready = quest({ questId: 'ready', complete: true });
    const started = quest({ questId: 'started', progress: 1 });

    expect(dailyWorthShowing([started, ready])?.questId).toBe('ready');
  });

  it('prefers anything at all over one already claimed', () => {
    const claimed = quest({ questId: 'claimed', complete: true, claimedAt: new Date() });
    const started = quest({ questId: 'started', progress: 1 });

    expect(dailyWorthShowing([claimed, started])?.questId).toBe('started');
  });

  it('shows a claimed one rather than nothing, when nothing else is left', () => {
    const claimed = quest({ questId: 'claimed', complete: true, claimedAt: new Date() });

    expect(dailyWorthShowing([claimed])?.questId).toBe('claimed');
  });
});

describe('R.3 — what the home starts before it waits', () => {
  const context = { db: {} } as Parameters<typeof readHome>[0];

  beforeEach(() => {
    probe.reset();
  });

  // The defect, stated as a test: `readBoard` was awaited on its own line, so
  // the four reads under it had not been started when it answered.
  it('starts every read a signed-in home needs before awaiting any of them', async () => {
    const view = readHome(context, 'ada', 0);

    expect([...probe.started].sort()).toEqual([
      'board',
      'history',
      'quests',
      'stats',
      'tile',
    ]);

    probe.openGate();
    await view;
  });

  // The guest path had the same shape with one fewer read: the day's tile does
  // not depend on the board either, and was waiting behind it.
  it('starts the board and the day’s tile together for a guest', async () => {
    const view = readHome(context, null, 0);

    expect([...probe.started].sort()).toEqual(['board', 'tile']);

    probe.openGate();
    await view;
  });

  // A promise created before a branch is the shape track Q spent five steps on,
  // and Q.2 is the one where an unheld one ended the process. Both paths carry
  // the board into a `Promise.all` with no `await` in between, which is what
  // makes a failing read a rejected `readHome` rather than an unhandled
  // rejection.
  it.each([
    ['a signed-in viewer', 'ada'],
    ['a guest', null],
  ] as const)('reports a failing read as a rejection, for %s', async (_who, viewer) => {
    const view = readHome(context, viewer, 0);
    probe.failGate();
    await expect(view).rejects.toThrow('the board is down');
  });
});
