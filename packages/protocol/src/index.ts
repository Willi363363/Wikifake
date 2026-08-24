// The single source of the contracts: one schema per WebSocket message and per
// REST payload, and the types inferred from them rather than declared twice.
//
// The schemas themselves arrive with steps 1.2 and 1.3 of
// plans/rewrite/phase-01-core.md. What is here is the decoding surface they
// all go through.
export { decode } from './decode.js';
export type { Decoded } from './decode.js';
