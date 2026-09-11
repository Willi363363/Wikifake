// H.6 — `POST /api/account/cosmetics`: what the player is wearing.
//
// Wiring and nothing else; the handler is in `src/account/cosmetics.ts`.
import {
  handleReadCosmetics,
  handleWearCosmetic,
} from '../../../../src/account/cosmetics.js';
import { cosmeticsContext } from '../../../../src/account/wiring.js';

/** Reads a cookie and writes a column. Never cached, never prerendered. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleWearCosmetic(cosmeticsContext(), request);
}

export function GET(request: Request): Promise<Response> {
  return handleReadCosmetics(cosmeticsContext(), request);
}
