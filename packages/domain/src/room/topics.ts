// Choosing what the round will be about.
//
// The topics are French because the game reads `fr.wikipedia.org`: that is data,
// not prose of ours, and it is the one exception the repository's language rule
// makes.
import { emit, type Reduced } from '../reducer.js';
import type { RoomEffect } from './events.js';
import type { RoomState } from './state.js';

/** Used when no ballot yields a usable article, carried over from `themes.py`. */
export const FALLBACK_TOPICS = [
  'Paris',
  'Chat',
  'Chocolat',
  'Football',
  'Soleil',
  'Lune',
  'Château',
  'Pizza',
  'Japon',
  'Cinéma',
] as const;

/**
 * Picks a topic out of the ballots and queues the rest as fallbacks.
 *
 * The draw is kept — it stops the fastest voter from always winning — but the
 * number comes in as a parameter, so the reducer stays pure and a test can pin
 * the outcome. `Math.random()` in here would have cost one or the other.
 *
 * `remaining` is built now rather than looked up later: the vote is what decides
 * the order, and by the time a generation fails the ballots are gone.
 */
export function selectTopic(
  state: RoomState,
  seed: number,
): Reduced<RoomState, RoomEffect> {
  const proposals = [...new Set(Object.values(state.ballots))];
  const candidates = proposals.length > 0 ? proposals : [...FALLBACK_TOPICS];
  // As above: the modulo is in range, the type does not know it.
  const chosen = candidates[Math.abs(seed) % candidates.length] ?? FALLBACK_TOPICS[0];
  const proposer =
    Object.entries(state.ballots).find(([, topic]) => topic === chosen)?.[0] ?? null;

  const remaining = [
    ...candidates.filter((candidate) => candidate !== chosen),
    ...FALLBACK_TOPICS.filter((fallback) => fallback !== chosen),
  ];

  const next: RoomState = {
    ...state,
    phase: 'generating',
    ballots: {},
    generating: { topic: chosen, proposer, remaining },
  };

  return emit(
    next,
    {
      kind: 'broadcast',
      message: {
        type: 'theme_selected',
        topic: chosen,
        proposer,
        ballots: state.ballots,
      },
    },
    { kind: 'generate_article', topic: chosen },
  );
}
