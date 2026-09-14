// Which quest the home's one quest tile shows — step L.6.
//
// The rest of `readHome` is composition: four reads that each have their own
// suite, and asserting them again here would be asserting the same rows twice.
// This is the one decision the reader makes on its own, and it is a decision a
// player notices — a tile offering a quest they finished this morning while an
// unfinished one sits behind it is a tile that wastes the space it takes.
import { describe, expect, it } from 'vitest';

import { dailyWorthShowing } from './home.js';
import type { LiveQuest } from '../quests/sets.js';

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
