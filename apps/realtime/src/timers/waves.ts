// The item waves: one item per player, every thirty seconds, nine times.
//
// Carried over from `item_distribution_loop`, including the two things about it
// that are decisions rather than accidents: the **first** wave is thirty seconds
// in, so a round opens item-free, and there are nine of them, so a long round
// does not become an item festival.
//
// What the current loop is, and what this is not: an `asyncio.Task` on the room
// object. It dies with the process, it is cancelled by hand in three places, and
// D2's leak — a task still running for a room nobody is in — is one of the three
// being forgotten. A delayed job has none of those failure modes.
import { ITEM_IDS, type ItemInstance } from '@wikifake/protocol';

/** From `asyncio.sleep(30)`. */
export const WAVE_INTERVAL_SECONDS = 30;
/** From `range(1, 10)`. */
export const WAVES_PER_ROUND = 9;

/** One item per player, drawn afresh. */
export type Grants = Readonly<Record<string, ItemInstance>>;

/**
 * Draws a wave.
 *
 * The draw is a parameter, not `Math.random()` inside: the same reason
 * `selectTopic` takes a seed. A test that cannot pin which item landed cannot
 * assert anything about what happens next.
 *
 * `instanceId` carries the player and the wave, as today: a player can hold two
 * SCANNERs, and spending one must not spend both.
 */
export function drawWave(
  players: readonly string[],
  wave: number,
  pick: (upperBound: number) => number,
): Grants {
  const grants: Record<string, ItemInstance> = {};

  for (const player of players) {
    const itemId = ITEM_IDS[pick(ITEM_IDS.length) % ITEM_IDS.length] ?? ITEM_IDS[0];
    grants[player] = { instanceId: `${player}_${String(wave)}_${itemId}`, itemId };
  }

  return grants;
}

/** A uniform draw. The one place in this service that reaches for randomness. */
export function randomPick(upperBound: number): number {
  return Math.floor(Math.random() * upperBound);
}
