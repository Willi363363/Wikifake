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
import { flagReportRequest, flagReportResponse } from './flags.js';
import { healthResponse, pingResponse, usageResponse } from './health.js';
import { createRoomRequest, createRoomResponse } from './rooms.js';

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
    method: 'POST',
    path: '/api/flag-report',
    request: flagReportRequest,
    response: flagReportResponse,
  },
];

/** `METHOD /path`, sorted: what the parity test compares. */
export const ROUTE_KEYS = ROUTES.map((route) => `${route.method} ${route.path}`).sort();
