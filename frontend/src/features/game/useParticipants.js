/**
 * Liste des participants affichee dans les classements.
 *
 * Pendant la partie : le roster + les scores provisoires du serveur.
 * Apres la partie : le classement final du serveur, tel quel.
 */

import { useMemo } from 'react';

import { NEUTRAL_PLAYER_COLOR } from '@/config/accents';
import { normalizeBreakdown } from '@/lib/breakdown';

export function useParticipants({ leaderboard, roster, playerName, liveScores }) {
  return useMemo(() => {
    const source = leaderboard ?? roster;
    return source
      .map((entry) => ({
        id: entry.name,
        name: entry.name,
        color: entry.color || NEUTRAL_PLAYER_COLOR,
        score: entry.score ?? liveScores[entry.name] ?? 0,
        breakdown: entry.breakdown,
        you: entry.name === playerName,
      }))
      .sort((a, b) => b.score - a.score);
  }, [leaderboard, roster, playerName, liveScores]);
}

/** Detail de score du joueur courant, deja normalise. */
export function useMyBreakdown({ soloResult, leaderboard, playerName }) {
  return useMemo(() => {
    if (soloResult) return normalizeBreakdown(soloResult.breakdown);
    const mine = leaderboard?.find((entry) => entry.name === playerName);
    return normalizeBreakdown(mine?.breakdown);
  }, [soloResult, leaderboard, playerName]);
}

/** Cibles du panneau Intel : une entree par falsification, indice si debloque. */
export function useIntelTargets(totalFakes, hints) {
  const targets = useMemo(
    () =>
      Array.from({ length: totalFakes }, (_, index) => {
        const unlocked = hints[index + 1];
        return {
          id: index + 1,
          hint: unlocked?.hint ?? '',
          truth: unlocked?.paragraphIndex
            ? `Paragraphe ${unlocked.paragraphIndex}`
            : (unlocked?.hint ?? ''),
        };
      }),
    [totalFakes, hints],
  );

  const levels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(hints).map(([index, value]) => [Number(index), value.level]),
      ),
    [hints],
  );

  return { targets, levels };
}
