'use client';

// The live ranking, and the number it ranks by.
//
// C2.4 says descending score. What it does not say, and what "four players see
// the same order" needs, is what happens on a tie — and ties are the common case
// here, because everyone starts on nothing and the scale moves in steps of 150.
// Sorted by score alone, four clients receiving the same numbers in four
// different orders produce four different rankings. So the tie-break is the
// name, which every client has and every client agrees on.
import { PER_TRUE_POSITIVE } from '@wikifake/domain';
import { useCallback, useEffect, useState } from 'react';

/**
 * The score a player broadcasts while the round runs.
 *
 * **Deliberately optimistic**: it counts every mark as correct. A live score
 * that reflected which marks were right would be the answer key, published to
 * the room fives times a second — which is why the server relays this number
 * rather than computing one (C1.1).
 *
 * The hint penalty is real, because it is not a secret: the player paid it.
 */
export function optimisticScore(marked: number, hintPenalty: number): number {
  return marked * PER_TRUE_POSITIVE - hintPenalty;
}

/** One line of the ranking. */
export interface Standing {
  readonly name: string;
  readonly colour: string;
  readonly score: number;
  readonly you: boolean;
}

/** By player name, as `live_score_update` reports them. */
export type LiveScores = Readonly<Record<string, number>>;

/**
 * The ranking, in the order every client will agree on.
 *
 * Everyone in the roster appears, whether or not they have sent a score: a
 * player missing from the list until they tick something reads as a player who
 * is not in the room.
 */
export function ranked(
  roster: readonly { readonly name: string; readonly colour: string }[],
  scores: LiveScores,
  me: string | null,
): readonly Standing[] {
  return roster
    .map((player) => ({
      name: player.name,
      colour: player.colour,
      score: scores[player.name] ?? 0,
      you: player.name === me,
    }))
    .sort((one, two) =>
      // Descending by score, then by name: a total order, so four clients with
      // the same numbers produce the same list.
      two.score === one.score ? one.name.localeCompare(two.name) : two.score - one.score,
    );
}

export interface LiveScoresState {
  readonly scores: LiveScores;
  /** A `live_score_update` arrived. */
  report(player: string, score: number): void;
}

const NOTHING: LiveScores = {};

/** The scores of one round. A new round starts everyone back at nothing. */
export function useLiveScores(roundKey: string): LiveScoresState {
  const [scores, setScores] = useState<LiveScores>(NOTHING);

  useEffect(() => {
    setScores(NOTHING);
  }, [roundKey]);

  const report = useCallback((player: string, score: number) => {
    setScores((was) => (was[player] === score ? was : { ...was, [player]: score }));
  }, []);

  return { scores, report };
}
