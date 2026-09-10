// H.7 — `POST /api/shop/buy`: spending coins on a cosmetic.
//
// Wiring and nothing else; the handler is in `src/shop/buy.ts`.
import { handleBuyCosmetic } from '../../../../src/shop/buy.js';
import { shopContext } from '../../../../src/shop/wiring.js';

/** Reads a cookie and writes to the ledger. Never cached, never prerendered. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleBuyCosmetic(shopContext(), request);
}
