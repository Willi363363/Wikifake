// C1.1 — `POST /api/game/start`: the article, and how many paragraphs were
// falsified. Never which ones.
//
// This file is wiring and nothing else. What the route *does* lives in
// `src/game/start.ts`, which takes its collaborators as arguments so the leak
// assertion can drive the real handler with a frozen page and a mocked model.
import { handleStart } from '../../../../src/game/start.js';
import { startContext } from '../../../../src/game/wiring.js';

/** Reads cookies, writes rows, calls a model. Nothing here is prerenderable. */
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleStart(startContext(), request);
}
