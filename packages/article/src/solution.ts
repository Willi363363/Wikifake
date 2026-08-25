// The solution as the **server** keeps it, which is not the solution as it
// travels.
//
// `falsifiedPosition` is the wire shape (C1.2): what a player is shown once the
// round is over. The database keeps one field more — the paragraph the model
// replaced — because `game_position.original_text` is `not null` and because
// auditing what the model actually changed is impossible without it.
//
// It lives here rather than in `@wikifake/protocol` on purpose: the protocol is
// the wire, and a wire schema with an `originalText` field in it is one careless
// spread away from C1.1 being a comment instead of a guarantee. Every schema that
// leaves the server — `startGameResponse`, `submitResponse`, `game_end` — is
// built on `falsifiedPosition`, so Zod strips this field on the way out whatever
// a handler hands it.
import { falsifiedPosition } from '@wikifake/protocol';
import { z } from 'zod';

export const storedPosition = falsifiedPosition.extend({
  /**
   * The paragraph as Wikipedia had it, before the model rewrote it.
   *
   * Carried through the cache too: a game served from a cached article is
   * recorded exactly like a freshly generated one, and an entry that dropped this
   * would make half the rounds unauditable for no reason a reader could see.
   */
  originalText: z.string().min(1),
});
export type StoredPosition = z.infer<typeof storedPosition>;
