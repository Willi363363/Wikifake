// The periods a board is drawn for — promoted here by step G.5.
//
// They lived in `@wikifake/domain` from G.3 until now, which was the right place
// for exactly as long as nothing outside that package read them. G.5 puts a
// period in a URL — `/leaderboard?period=weekly` — so it became a contract, and
// a value arriving from a browser has to be validated against a closed list.
//
// The same journey the quest rule identifiers took at F.7 and the regions took
// at G.1: `protocol` holds the identifiers that cross the wire, `domain` holds
// what they mean. What a period *covers* is still `boardWindowOf`'s.
import { z } from 'zod';

/**
 * Daily, weekly, all of history.
 *
 * The track's reason for the first two, kept beside them: *"an all-time board
 * alone is a wall the first hundred players build against everybody who arrives
 * later."*
 */
export const BOARD_PERIOD_IDS = ['daily', 'weekly', 'allTime'] as const;

export const boardPeriodId = z.enum(BOARD_PERIOD_IDS);
export type BoardPeriodId = z.infer<typeof boardPeriodId>;
