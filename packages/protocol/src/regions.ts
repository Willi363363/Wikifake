// The regions a board is drawn for — step G.1.
//
// In `protocol` and not in `domain`, unlike the quest rule identifiers of F.1,
// and the difference is the rule rather than an inconsistency: these cross the
// wire in the step that introduces them. `POST /api/account/region` takes one
// from a browser, so it has to be validated against a closed list, and a
// contract is what `protocol` is for.
//
// What each region *means* — which country codes fall in it — is
// `@wikifake/domain`'s `regions.ts`. The identifiers are the contract; the
// mapping is a rule.
import { z } from 'zod';

/**
 * Europe, the Americas, and the rest.
 *
 * `other` is a region and not a fallback, which is why it is in the list a
 * player may choose from: somebody in Nairobi or Osaka has a board, and calling
 * it "unknown" would be telling them the game had failed to place them.
 */
export const REGION_IDS = ['europe', 'americas', 'other'] as const;

export const regionId = z.enum(REGION_IDS);
export type RegionId = z.infer<typeof regionId>;
