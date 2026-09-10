// The REST surface, as data.
//
// One entry per route, carrying its method, its path and the schemas on each
// side. Two things read this: the parity test, which compares it to the route
// decorators in `backend/src/api/`, and the generated protocol documentation of
// step 1.10.
//
// This is the other half of C8.1. `test_architecture_doc.py` asserts today that
// the documented routes **equal** the route decorators; that test is regex
// Python and dies with the Python (C8.2). Holding the same line from a typed
// catalogue is what keeps a route from being added without anyone noticing.
import type { ZodType } from 'zod';

import {
  hintRequest,
  hintResponse,
  scanRequest,
  scanResponse,
  startGameRequest,
  startGameResponse,
  submitRequest,
  submitResponse,
} from './game.js';
import {
  claimPseudonymRequest,
  claimPseudonymResponse,
  deleteAccountRequest,
  deleteAccountResponse,
  exportAccountResponse,
} from './account.js';
import { flagReportRequest, flagReportResponse } from './flags.js';
import { healthResponse, pingResponse, usageResponse } from './health.js';
import { createRoomRequest, createRoomResponse } from './rooms.js';
import { claimQuestRequest, claimQuestResponse, questCronResponse } from './quests.js';
import { realtimeTicketRequest, realtimeTicketResponse } from './tickets.js';

export interface Route {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  /** Absent on a GET: there is no body to validate. */
  readonly request?: ZodType;
  readonly response: ZodType;
}

export const ROUTES: readonly Route[] = [
  { method: 'GET', path: '/ping', response: pingResponse },
  { method: 'GET', path: '/api/health', response: healthResponse },
  { method: 'GET', path: '/api/usage', response: usageResponse },
  {
    method: 'POST',
    path: '/api/multiplayer/create',
    request: createRoomRequest,
    response: createRoomResponse,
  },
  {
    method: 'POST',
    path: '/api/game/start',
    request: startGameRequest,
    response: startGameResponse,
  },
  {
    method: 'POST',
    path: '/api/game/hint',
    request: hintRequest,
    response: hintResponse,
  },
  {
    method: 'POST',
    path: '/api/game/scan',
    request: scanRequest,
    response: scanResponse,
  },
  {
    method: 'POST',
    path: '/api/game/submit',
    request: submitRequest,
    response: submitResponse,
  },
  {
    // Step E.3b.2. No `request`: the room and the nickname are what the ticket
    // is *bound* to, so they are in the address rather than in a body, and
    // nothing else is sent.
    method: 'POST',
    path: '/api/realtime/ticket',
    request: realtimeTicketRequest,
    response: realtimeTicketResponse,
  },
  {
    // Step E.3.2. A body rather than a query parameter: the pseudonym is what
    // the request sends, not what it is bound to, and a name in a URL is a name
    // in an access log.
    method: 'POST',
    path: '/api/account/pseudonym',
    request: claimPseudonymRequest,
    response: claimPseudonymResponse,
  },
  {
    // Step E.7. No `request`: a `GET` has no body, and the account is the
    // session's rather than a parameter — there is nothing to ask about.
    method: 'GET',
    path: '/api/account/export',
    response: exportAccountResponse,
  },
  {
    // Step E.7. `POST` and not `DELETE`: this is the one irreversible thing a
    // player can do here, and a method a prefetcher might reach for is the
    // wrong one to hang it on.
    method: 'POST',
    path: '/api/account/delete',
    request: deleteAccountRequest,
    response: deleteAccountResponse,
  },
  {
    method: 'POST',
    path: '/api/flag-report',
    request: flagReportRequest,
    response: flagReportResponse,
  },
  {
    // Step F.6. The one thing a player does to a quest.
    method: 'POST',
    path: '/api/quests/claim',
    request: claimQuestRequest,
    response: claimQuestResponse,
  },
  {
    // Step F.5. A `GET` that writes, which is Vercel's scheduler dictating the
    // method rather than a choice: it issues one, and a `POST` beside it would
    // be a second door onto the same room. No `request` — the only input is the
    // bearer token, and a token is not a body.
    method: 'GET',
    path: '/api/cron/quests',
    response: questCronResponse,
  },
];

/** `METHOD /path`, sorted: what the parity test compares. */
export const ROUTE_KEYS = ROUTES.map((route) => `${route.method} ${route.path}`).sort();
