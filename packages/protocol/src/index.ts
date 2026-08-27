// The single source of the contracts: one schema per WebSocket message and per
// REST payload, and the types inferred from them rather than declared twice.
//
// The two message families are namespaced rather than flattened, because a
// message type can legitimately exist in both directions with different
// payloads — `chat_message` carries `content` on the way in and `sender` plus
// `content` on the way out. Flattening would force one of the two to be renamed
// for a reason that has nothing to do with the protocol.
//
// The REST payloads arrive with step 1.3 of plans/rewrite/phase-01-core.md.
export { decode } from './decode.js';
export type { Decoded } from './decode.js';

export * from './primitives.js';
export * from './errors.js';
export * from './accounting.js';
export * from './article.js';
export * from './score.js';
export * from './items.js';
export * from './rest/routes.js';

export * as clientMessages from './ws/incoming.js';
export * as serverMessages from './ws/outgoing.js';
export * as gameApi from './rest/game.js';
export * as healthApi from './rest/health.js';
export * as roomsApi from './rest/rooms.js';
export * as flagsApi from './rest/flags.js';
export { incomingMessage, INCOMING_TYPES } from './ws/incoming.js';
export type { IncomingMessage } from './ws/incoming.js';
export { outgoingMessage, OUTGOING_TYPES } from './ws/outgoing.js';
export type { OutgoingMessage } from './ws/outgoing.js';
