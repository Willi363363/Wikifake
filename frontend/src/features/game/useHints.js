/**
 * Paid hints.
 *
 * Level 1 shows a nudge, level 2 reveals the truth; each costs points that are
 * subtracted at scoring time. Unlocking is monotonic — a player cannot go back
 * to a cheaper level once they have paid for a dearer one.
 */
import { useState, useCallback, useMemo } from 'react';
import { playSound } from '../../lib/sound.js';
import { SCORING } from '../../config.js';

export function useHints(fakes) {
  const [unlocks, setUnlocks] = useState({});

  const unlock = useCallback((fakeId, level) => {
    playSound('hint');
    setUnlocks((prev) => ({ ...prev, [fakeId]: Math.max(prev[fakeId] || 0, level) }));
  }, []);

  /** Tokens whose hint has been bought, so the article can highlight them. */
  const hintedTokenIds = useMemo(() => {
    const ids = new Set();
    for (const fake of fakes) {
      if ((unlocks[fake.id] || 0) >= 1) ids.add(fake.tokenId);
    }
    return ids;
  }, [unlocks, fakes]);

  const hintsUsed = Object.values(unlocks).filter((level) => level > 0).length;
  const hintPenalty = Object.values(unlocks).reduce(
    (total, level) => total + (level === 1 ? SCORING.hintCost : level === 2 ? SCORING.revealCost : 0),
    0,
  );

  return { unlocks, unlock, hintedTokenIds, hintsUsed, hintPenalty };
}
